import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import eslintComments from "eslint-plugin-eslint-comments";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
    "*.config.mjs",
    // Service worker is plain JS, not part of TypeScript build
    "public/firebase-messaging-sw.js",
  ]),
  {
    plugins: {
      "simple-import-sort": simpleImportSort,
      "@typescript-eslint": typescriptEslint,
      "eslint-comments": eslintComments,
    },
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_.*$",
          varsIgnorePattern: "^_.*$",
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "prefer-const": "error",
      "no-throw-literal": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      // Prevent disabling ESLint without a reason
      "eslint-comments/disable-enable-pair": [
        "error",
        { allowWholeFile: true },
      ],
      "eslint-comments/require-description": ["error", { ignore: [] }],
    },
  },
]);

export default eslintConfig;
