/* 聚焦测试: AI 作为画者 — 验证 ai_status 状态流 + canvas_sync 笔画广播 + 轮次不提前结束
 * 循环建房间直到 AI 抽中第 1 轮画者(1/3 概率), 然后观测最多 120s(AI 绘画生成 ~50-70s)
 */
const { io } = require('socket.io-client');

const URL = 'http://localhost:3000';
const AI_ID = 'ai_player';
const DRAW_WAIT_MS = 120000;

let failures = 0;
function check(cond, msg) {
  console.log(`${cond ? 'PASS' : 'FAIL'} - ${msg}`);
  if (!cond) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function connect() {
  return new Promise((resolve, reject) => {
    const s = io(URL, { transports: ['websocket'], forceNew: true, reconnection: false });
    s.on('connect', () => resolve(s));
    s.on('connect_error', (e) => reject(e));
  });
}

async function tryRoom(attempt) {
  const host = await connect();
  const p2 = await connect();
  host.emit('create_room', { maxPlayers: 4, difficulty: 'medium', allowAI: true });
  const rc = await new Promise((r) => host.once('room_created', r));
  p2.emit('join_room', { inviteCode: rc.inviteCode });
  await new Promise((r) => p2.once('room_joined', r));

  const events = [];
  ['round_started', 'round_ended', 'game_ended', 'ai_status', 'ai_guess', 'canvas_sync', 'drawer_finished', 'error'].forEach((ev) => {
    host.on(ev, (d) => events.push({ ev, t: Date.now(), d }));
  });

  host.emit('start_game');
  const gs = await new Promise((r) => host.once('game_started', r));
  const r1 = await new Promise((r) => host.once('round_started', r));
  const t0 = Date.now();
  console.log(`[attempt ${attempt}] 第1轮画者: ${r1.drawerId}${r1.drawerId === AI_ID ? ' (AI)' : ''}, timeLimit=${r1.timeLimit}s`);

  if (r1.drawerId !== AI_ID) {
    // 不是 AI 画者: 关闭重试
    host.close();
    p2.close();
    return null;
  }

  check(Math.abs(r1.timeLimit - 150) <= 2, `AI 画者轮 timeLimit = ${r1.timeLimit}s (期望 150s)`);

  // 等待 AI 绘画完成: drawing → (canvas_sync 笔画) → draw_done
  const aiStatus = [];
  let canvasCount = 0;
  let roundEnded = false;
  const done = new Promise((resolve) => {
    host.on('ai_status', (d) => {
      aiStatus.push(d);
      if (d.status === 'draw_done') resolve('draw_done');
    });
    host.on('canvas_sync', () => { canvasCount++; });
    host.on('round_ended', () => { roundEnded = true; resolve('round_ended'); });
    host.on('game_ended', () => resolve('game_ended'));
  });

  const outcome = await Promise.race([done, sleep(DRAW_WAIT_MS).then(() => 'timeout')]);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  check(aiStatus.some((s) => s.status === 'drawing'), `收到 ai_status=drawing (${elapsed}s 内)`);
  check(outcome === 'draw_done', `AI 绘画完成: draw_done 到达 (用时 ${elapsed}s)`);
  check(canvasCount >= 1, `广播了 ${canvasCount} 条 canvas_sync 笔画`);
  check(!roundEnded, `绘画完成后轮次未提前结束 (roundEnded=${roundEnded})`);

  // 再等 5s 确认轮次仍在进行(AI 画者轮时长 150s, 不会在绘画后立即结束)
  await sleep(5000);
  console.log(`  事件汇总: ${events.map((e) => e.ev).join(', ')}`);

  host.close();
  p2.close();
  return { aiStatus, canvasCount, elapsed };
}

async function main() {
  for (let i = 1; i <= 6; i++) {
    const result = await tryRoom(i);
    if (result) {
      console.log(`\n===== AI 画者测试结果: ${failures === 0 ? '全部通过' : `${failures} 项失败`} =====`);
      process.exit(failures === 0 ? 0 : 1);
    }
    console.log(`  尝试 ${i} 未抽中 AI 画者, 重试...\n`);
    await sleep(1500);
  }
  console.log('FAIL - 6 次尝试均未抽中 AI 画者');
  process.exit(1);
}

main().catch((e) => { console.error('ERR', e); process.exit(1); });
