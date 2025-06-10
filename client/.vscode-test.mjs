import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'out/test/**/*.test.js',
  version: 'stable',
  workspaceFolder: './test/fixtures',
  mocha: {
    ui: 'tdd',
    timeout: 20000,
    retries: 2
  },
  extensionDevelopmentPath: process.cwd(),
  env: {
    EXTENSION_DEV: 'true'
  }
});