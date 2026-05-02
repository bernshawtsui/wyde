import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "src-tauri/target",
      "src-tauri/gen",
      "node_modules",
      "coverage",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.es2022 },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // React 19's "you might not need an effect" guidance is too aggressive
      // for desktop apps that legitimately sync state with external systems
      // (file watchers, drag-drop, async IO results). Off by design.
      "react-hooks/set-state-in-effect": "off",
      // Ref reads inside event handlers passed via createElement trigger a
      // false-positive (the ref is only read at event time, not render).
      // Off — we use this pattern intentionally for edit-lifecycle guards.
      "react-hooks/refs": "off",
    },
  }
);
