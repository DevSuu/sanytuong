import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import ts from "typescript-eslint";
import next from "@next/eslint-plugin-next";
import hooks from "eslint-plugin-react-hooks";
// Direct plugins avoid legacy ESLint 9-only dependencies in eslint-config-next.
export default defineConfig([
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "@next/next": next, "react-hooks": hooks },
    rules: {
      ...next.configs.recommended.rules,
      ...next.configs["core-web-vitals"].rules,
      ...hooks.configs.recommended.rules,
    },
  },
  {
    files: ["**/*.ts"],
    languageOptions: { globals: { process: "readonly", console: "readonly" } },
  },
  {
    files: ["scripts/*.mjs"],
    languageOptions: {
      globals: { process: "readonly", console: "readonly", URL: "readonly" },
    },
  },
  globalIgnores([
    ".next/**",
    "src/generated/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    "scripts/*.cjs",
  ]),
]);
