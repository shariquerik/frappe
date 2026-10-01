// Minimal stand-in for Node's `assert` in a browser bundle; @babel/helper-module-imports
// calls `require("assert")(value, message)`, so this must be CommonJS.
module.exports = function assert(value, message) {
  if (!value) throw new Error(message ?? "assertion failed");
};
