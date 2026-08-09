/* E2E: AI 参与联机游戏验证脚本
 * 场景: allowAI 建房间 → AI 玩家入座 → 开局 → 观测 AI 绘画(AI 当画者)或 AI 猜词(≥3s 间隔、精确匹配)
 */
const { io } = require('socket.io-client');

const URL = process.env.SERVER_URL || 'http://localhost:3000';
const AI_ID = 'ai_player';
const OBSERVE_R1_MS = 40000; // 第 1 轮观测窗口(覆盖 AI 绘画生成耗时)
const OBSERVE_R2_MS = 100000; // 第 2 轮观测窗口(AI 猜词 / AI 绘画生成 ~50s)

let failures = 0;
function check(cond, msg) {
  console.log(`${cond ? 'PASS' : 'FAIL'} - ${msg}`);
  if (!cond) failures++;
}

function connect(name) {
  return new Promise((resolve, reject) => {
    const s = io(URL, { transports: ['websocket'], forceNew: true, reconnection: false });
    s.on('connect', () => {
      console.log(`[${name}] connected (${s.id})`);
      resolve(s);
    });
    s.on('connect_error', (e) => reject(new Error(`${name} connect error: ${e.message}`)));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const host = await connect('host');
  const p2 = await connect('p2');
  const hostEvents = [];
  ['round_started', 'game_started', 'round_ended', 'game_ended', 'ai_status', 'ai_guess', 'canvas_sync', 'correct_guess', 'drawer_finished', 'error', 'room_created', 'player_joined'].forEach((ev) => {
    host.on(ev, (d) => hostEvents.push({ ev, t: Date.now(), d }));
  });

  // 1) 房主创建允许 AI 的房间
  host.emit('create_room', { maxPlayers: 4, difficulty: 'medium', allowAI: true });
  const roomCreated = await new Promise((res) => host.once('room_created', res));
  const aiInRoom = roomCreated.players.find((p) => p.isAI);
  check(!!aiInRoom, 'room_created 包含 AI 玩家 (isAI=true)');
  check(aiInRoom?.userId === AI_ID, `AI 玩家 userId = ${AI_ID}`);
  check(roomCreated.players.length >= 2, `AI 占用玩家位, 建房间后人数 = ${roomCreated.players.length}`);
  console.log(`  房间玩家: ${roomCreated.players.map((p) => `${p.nickname}${p.isAI ? '(AI)' : ''}`).join(', ')}`);

  // 2) 第二个玩家加入
  p2.emit('join_room', { inviteCode: roomCreated.inviteCode });
  await new Promise((res) => p2.once('room_joined', res));
  await sleep(1000);
  console.log('  [p2] joined room');

  // 3) 房主开局
  host.emit('start_game');
  const gameStarted = await new Promise((res) => host.once('game_started', res));
  check(gameStarted.drawerOrder.includes(AI_ID), `drawerOrder 包含 AI: [${gameStarted.drawerOrder.join(', ')}]`);
  check(gameStarted.totalRounds >= 2, `totalRounds = ${gameStarted.totalRounds}`);

  // 4) 第 1 轮: 观测 AI 行为
  const r1 = await new Promise((res) => host.once('round_started', res));
  const r1Start = Date.now();
  const aiIsDrawer1 = r1.drawerId === AI_ID;
  const expectedLimit = aiIsDrawer1 ? 150 : 60; // ROUND_DURATION 60s, AI 画者 +90s
  check(Math.abs(r1.timeLimit - expectedLimit) <= 2, `第1轮 timeLimit = ${r1.timeLimit}s (AI画者=${aiIsDrawer1}, 期望≈${expectedLimit}s)`);
  console.log(`  第1轮 画者: ${r1.drawerId}${aiIsDrawer1 ? ' (AI)' : ''}`);

  // 人类画者画几笔 + 提交, 让 AI 有内容可猜(若 AI 是画者则无需操作)
  if (!aiIsDrawer1) {
    const hostId = roomCreated.hostId;
    const drawer = r1.drawerId === hostId ? host : p2;
    for (let i = 0; i < 3; i++) {
      drawer.emit('canvas_action', {
        type: 'draw',
        brush: { color: '#e53935', size: 8, opacity: 1 },
        points: [
          { x: 150 + i * 30, y: 150 },
          { x: 150 + i * 30, y: 300 },
        ],
      });
      await sleep(250);
    }
    drawer.emit('finish_drawing');
    console.log('  [drawer] 第1轮已绘画并提交(提交后 AI 房本轮继续, AI 猜词循环不受影响)');
  }

  await sleep(OBSERVE_R1_MS);

  const r1Evts = hostEvents.filter((e) => e.t >= r1Start);
  const aiStatus1 = r1Evts.filter((e) => e.ev === 'ai_status');
  const aiGuess1 = r1Evts.filter((e) => e.ev === 'ai_guess');
  const canvas1 = r1Evts.filter((e) => e.ev === 'canvas_sync');

  if (aiIsDrawer1) {
    check(aiStatus1.some((e) => e.d.status === 'drawing'), 'AI 画者: 收到 ai_status=drawing');
    check(aiStatus1.some((e) => e.d.status === 'draw_done'), 'AI 画者: 收到 ai_status=draw_done');
    check(canvas1.length >= 1, `AI 画者: 广播了 ${canvas1.length} 条 canvas_sync 笔画`);
  } else {
    const guessTimes = aiGuess1.map((e) => e.t);
    let intervalOk = true;
    for (let i = 1; i < guessTimes.length; i++) {
      if (guessTimes[i] - guessTimes[i - 1] < 2800) intervalOk = false;
    }
    check(guessTimes.length >= 1, `AI 猜者: 第1轮收到 ${guessTimes.length} 次 ai_guess`);
    if (guessTimes.length >= 2) check(intervalOk, `AI 猜者: ai_guess 间隔均 ≥3s (${guessTimes.map((t, i) => (i ? t - guessTimes[i - 1] : 0)).join(', ')}ms)`);
    const g0 = aiGuess1[0]?.d;
    if (g0) console.log(`  AI 首次猜测: ${g0.guesses.map((g) => g.word).join('/')} | 精确命中: ${g0.isCorrect}`);
  }

  // 5) 等待第 1 轮结束, 进入第 2 轮
  const rEnd1 = await new Promise((res) => host.once('round_ended', res));
  check(!!rEnd1.scores, `第1轮 round_ended 含 scores: ${JSON.stringify(rEnd1.scores)}`);

  const r2 = await new Promise((res) => host.once('round_started', res));
  const r2Start = Date.now();
  const aiIsDrawer2 = r2.drawerId === AI_ID;
  console.log(`  第2轮 画者: ${r2.drawerId}${aiIsDrawer2 ? ' (AI)' : ''}`);

  // 人类画者画几笔 + 提交, 让 AI 有内容可猜(若 AI 是画者则无需操作)
  if (!aiIsDrawer2) {
    const hostId = roomCreated.hostId;
    const drawer = r2.drawerId === hostId ? host : p2;
    for (let i = 0; i < 3; i++) {
      drawer.emit('canvas_action', {
        type: 'draw',
        brush: { color: '#2196f3', size: 8, opacity: 1 },
        points: [
          { x: 150 + i * 30, y: 150 },
          { x: 150 + i * 30, y: 300 },
        ],
      });
      await sleep(250);
    }
    drawer.emit('finish_drawing');
    console.log('  [drawer] 已提交绘画(提交后 AI 房本轮继续, AI 猜词循环不受影响)');
  }

  await sleep(OBSERVE_R2_MS);

  const r2Evts = hostEvents.filter((e) => e.t >= r2Start);
  const aiGuess2 = r2Evts.filter((e) => e.ev === 'ai_guess');
  const aiStatus2 = r2Evts.filter((e) => e.ev === 'ai_status');
  const canvas2 = r2Evts.filter((e) => e.ev === 'canvas_sync');

  if (aiIsDrawer2) {
    check(aiStatus2.some((e) => e.d.status === 'drawing'), 'AI 画者(第2轮): ai_status=drawing');
    check(canvas2.length >= 1, `AI 画者(第2轮): ${canvas2.length} 条 canvas_sync`);
  } else {
    const guessTimes = aiGuess2.map((e) => e.t);
    let intervalOk = true;
    for (let i = 1; i < guessTimes.length; i++) {
      if (guessTimes[i] - guessTimes[i - 1] < 2800) intervalOk = false;
    }
    check(guessTimes.length >= 1, `AI 猜者(第2轮): ${guessTimes.length} 次 ai_guess`);
    check(intervalOk, `AI 猜者(第2轮): 间隔均 ≥3s (${guessTimes.map((t, i) => (i ? t - guessTimes[i - 1] : 0)).join(', ')}ms)`);
  }

  // 6) 收尾
  host.close();
  p2.close();
  console.log(`\n===== E2E 结果: ${failures === 0 ? '全部通过' : `${failures} 项失败`} =====`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('E2E 失败:', e);
  process.exit(1);
});
