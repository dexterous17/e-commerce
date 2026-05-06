import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";

/** eslint-plugin-react is not ESLint 10–compatible yet; hooks + jsx-a11y cover this codebase. */
export default [
  js.configs.recommended,
  jsxA11y.flatConfigs.recommended,
  {
    ignores: ["dist/**", "playwright-report/**", "coverage/**"],
  },
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
];
