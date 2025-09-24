// CommonJS config file so Jest can read it on Windows easily.
module.exports = {
  testEnvironment: "node",
  // Look for .mjs tests (ES modules) only inside the tests folder.
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.mjs"],
  // No Babel/TS transforms needed.
  transform: {}
};
