/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.mjs"],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/.aws-sam/",
  ],
  modulePathIgnorePatterns: [
    "<rootDir>/.aws-sam/",
  ],
  transform: {},
};
