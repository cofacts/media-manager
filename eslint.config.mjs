import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierRecommended from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'docs', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    plugins: { prettier: prettierRecommended },
    rules: {
      'prettier/prettier': 'error',
      // Existing code relies on these; tsdx's react-app config did not enable them.
      'no-async-promise-executor': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  }
);
