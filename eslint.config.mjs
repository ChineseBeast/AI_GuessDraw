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
  }
);
