import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules", "dist", "build", ".turbo", "**/*.js", "**/*.mjs", "**/*.cjs", "**/*.spec.ts", "jest.config.js"] },
  {
    files: ["**/*.ts", "**/*.tsx"],
    extends: [
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
    ],
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
    },
  },
  // NestJS DI 依赖 emitDecoratorMetadata，构造函数注入的 provider 必须用值导入，
  // 否则 reflect-metadata 拿不到运行时类型。consistent-type-imports 不感知
  // emitDecoratorMetadata，会强制改为 import type 从而破坏依赖注入，故对 server 关闭。
  // 必须放在 recommended 块之后，这样在按文件匹配合并时，server 块的同名规则会覆盖前面的规则。
  {
    files: ["apps/server/**/*.ts"],
    rules: {
      "@typescript-eslint/consistent-type-imports": "off",
    },
  }
);
