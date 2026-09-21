// Runs every *.test.js in this folder. Usage: node tests/terminal/run.js
// These test the terminal's pure logic (paths, amounts, food specs, servings, meals)
// with a stubbed app; nothing here needs a browser or a device.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

let failed = 0;
for (const file of fs.readdirSync(__dirname).filter(f => f.endsWith(".test.js")).sort()) {
  const result = spawnSync(process.execPath, [path.join(__dirname, file)], { encoding: "utf8" });
  const lines = result.stdout.trim().split("\n");
  const ok = result.status === 0;
  console.log((ok ? "PASS " : "FAIL ") + file + "  (" + lines.filter(l => l.startsWith("ok")).length + " checks)");
  if (!ok) {
    failed++;
    console.log(lines.filter(l => l.startsWith("FAIL")).join("\n") || result.stderr);
  }
}
process.exit(failed ? 1 : 0);
