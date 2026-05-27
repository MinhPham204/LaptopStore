/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/__tests__/setup.js"],
  testMatch: ["**/__tests__/**/*.test.js"],
  clearMocks: true,
}
