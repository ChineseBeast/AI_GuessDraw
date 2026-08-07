import baseConfig from '../../eslint.config.mjs';
import tseslint from 'typescript-eslint';

export default tseslint.config(...baseConfig, {
  files: ['**/*.ts'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    // NestJS DI 依赖 emitDecoratorMetadata，构造函数注入的 provider 必须用值导入，
    // consistent-type-imports 不感知该机制，会破坏单例/Provider 解析，故关闭。
    '@typescript-eslint/consistent-type-imports': 'off',
  },
});
