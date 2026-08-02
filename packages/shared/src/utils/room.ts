import { INVITE_CODE_LENGTH } from '../constants/game';

/** 邀请码字符集（排除容易混淆的 0/O/1/I/l） */
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * 生成指定长度的邀请码
 */
export function generateInviteCode(length: number = INVITE_CODE_LENGTH): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    const index = Math.floor(Math.random() * CODE_CHARS.length);
    code += CODE_CHARS[index];
  }
  return code;
}

/**
 * 验证房间 ID 格式
 */
export function validateRoomId(roomId: string): boolean {
  return /^[A-Z0-9]{6}$/.test(roomId);
}
