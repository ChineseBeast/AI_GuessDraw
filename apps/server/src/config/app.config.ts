/**
 * 应用配置常量
 * 集中管理配置，便于维护和测试
 */

export const appConfig = {
  jwt: {
    secret: process.env.JWT_SECRET || 'draw-guess-ai-dev-secret-key-2026-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    expiresInSeconds: parseInt(process.env.JWT_EXPIRES_IN_SECONDS || '86400', 10),
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    globalPrefix: 'api/v1',
  },
  aiService: {
    url: process.env.AI_SERVICE_URL || 'http://localhost:8000',
  },
} as const;
