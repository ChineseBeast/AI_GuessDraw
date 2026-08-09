/* 最小观测: 记录 100s 内所有事件, 定位 round_ended 未到达的原因 */
const { io } = require('socket.io-client');

const URL = 'http://localhost:3000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const host = io(URL, { transports: ['websocket'], forceNew: true, reconnection: false });
  const p2 = io(URL, { transports: ['websocket'], forceNew: true, reconnection: false });
  await Promise.all([
    new Promise((r, j) => { host.on('connect', r); host.on('connect_error', j); }),
    new Promise((r, j) => { p2.on('connect', r); p2.on('connect_error', j); }),
  ]);
  console.log('connected');

  host.emit('create_room', { maxPlayers: 4, difficulty: 'medium', allowAI: true });
  const roomCreated = await new Promise((r) => host.once('room_created', r));
  console.log('room_created, invite=', roomCreated.inviteCode, 'players=', roomCreated.players.map((p) => p.nickname).join(','));

  p2.emit('join_room', { inviteCode: roomCreated.inviteCode });
  await new Promise((r) => p2.once('room_joined', r));
  console.log('p2 joined');

  const t0 = Date.now();
  const log = (ev) => (d) => console.log(`+${((Date.now() - t0) / 1000).toFixed(1)}s  ${ev} ${JSON.stringify(d)?.slice(0, 150)}`);
  ['game_started', 'round_started', 'round_ended', 'game_ended', 'ai_status', 'ai_guess', 'canvas_sync', 'correct_guess', 'error', 'player_joined', 'player_left', 'player_disconnected'].forEach((ev) => {
    host.on(ev, log(ev));
    p2.on(ev, log(ev));
  });

  host.emit('start_game');
  console.log('start_game emitted, observing 100s...');
  await sleep(100000);
  console.log('done');
  host.close();
  p2.close();
  process.exit(0);
}

main().catch((e) => { console.error('ERR', e); process.exit(1); });
