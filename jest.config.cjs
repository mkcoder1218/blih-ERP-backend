/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  clearMocks: true,
  transform: {
    "^.+\\.[tj]sx?$": ["ts-jest", { diagnostics: false, tsconfig: { allowJs: true } }]
  },
  moduleNameMapper: {
    "^puppeteer$": "<rootDir>/tests/__mocks__/puppeteerMock.js"
  },
  transformIgnorePatterns: [
    "node_modules/(?!.*(sanitize-html|htmlparser2|dom.*|entities|puppeteer.*))"
  ]
};

