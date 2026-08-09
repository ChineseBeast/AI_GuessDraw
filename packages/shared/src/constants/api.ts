/** API 路由 */
export const API_ROUTES = {
  // 用户
  AUTH: {
    LOGIN: '/api/v1/auth/login',
    REGISTER: '/api/v1/auth/register',
    REFRESH: '/api/v1/auth/refresh',
    WECHAT_LOGIN: '/api/v1/auth/wechat',
    GUEST: '/api/v1/auth/guest',
  },
  // 游戏
  GAME: {
    SINGLE_START: '/api/v1/game/single/start',
    SINGLE_GUESS: '/api/v1/game/single/guess',
    SINGLE_RESULT: '/api/v1/game/single/result',
  },
  // 房间
  ROOM: {
    CREATE: '/api/v1/rooms',
    JOIN: '/api/v1/rooms/join',
    LIST: '/api/v1/rooms',
    DETAIL: '/api/v1/rooms/:id',
    LEAVE: '/api/v1/rooms/:id/leave',
    START: '/api/v1/rooms/:id/start',
  },
  // 排行榜
  LEADERBOARD: {
    GLOBAL: '/api/v1/leaderboard',
    WEEKLY: '/api/v1/leaderboard/weekly',
    MONTHLY: '/api/v1/leaderboard/monthly',
  },
  // 故事
  STORY: {
    START: '/api/v1/stories/start',
    CHAPTER: '/api/v1/stories/:id/chapters/:chapter',
    SUBMIT: '/api/v1/stories/:id/chapters/:chapter/submit',
    PROGRESS: '/api/v1/stories/:id/progress',
  },
  // AI 服务
  AI: {
    RECOGNIZE: '/api/v1/ai/recognize',
    GENERATE_DRAWING: '/api/v1/ai/generate-drawing',
    GENERATE_STORY: '/api/v1/ai/generate-story',
    EVALUATE_DRAWING: '/api/v1/ai/evaluate-drawing',
  },
} as const;

/** WebSocket 事件 */
export const WS_EVENTS = {
  // 房间事件
  ROOM_PLAYER_JOINED: 'room:player_joined',
  ROOM_PLAYER_LEFT: 'room:player_left',
  ROOM_STARTED: 'room:started',
  ROOM_ENDED: 'room:ended',
  ROOM_STATE_UPDATE: 'room:state_update',

  // 游戏事件
  GAME_ROUND_START: 'game:round_start',
  GAME_CANVAS_SYNC: 'game:canvas_sync',
  GAME_GUESS_SUBMIT: 'game:guess_submit',
  GAME_GUESS_RESULT: 'game:guess_result',
  GAME_ROUND_END: 'game:round_end',
  GAME_FINAL_RESULT: 'game:final_result',

  // 连接事件
  CONNECTION_DISCONNECT: 'connection:disconnect',
  CONNECTION_RECONNECT: 'connection:reconnect',
} as const;
