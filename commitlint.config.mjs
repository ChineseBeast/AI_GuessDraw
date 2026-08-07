export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [2, "always", [
      "feat", "fix", "docs", "style", "refactor", "test", "chore", "spec", "perf", "ci", "build", "revert"
    ]],
    "scope-enum": [2, "always", [
      "web", "miniprogram", "server", "ai-service", "shared", "design", "test", "spec", "repo"
    ]],
  },
};
