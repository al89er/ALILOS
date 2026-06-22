const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = process.cwd();

test("ALILOS app icon source is atom-like SVG and package references ICO", () => {
  const svg = fs.readFileSync(path.join(root, "assets", "app-icon.svg"), "utf8");
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const main = fs.readFileSync(path.join(root, "src", "main", "main.ts"), "utf8");

  assert.match(svg, /ALILOS atom icon/);
  assert.match(svg, /<ellipse\b/);
  assert.match(svg, /rotate\(60 128 128\)/);
  assert.equal(packageJson.build.win.icon, "assets/app-icon.ico");
  assert.match(main, /assets", "app-icon\.ico"/);
});

test("Windows app icon ICO includes common transparent PNG-backed sizes", () => {
  const ico = fs.readFileSync(path.join(root, "assets", "app-icon.ico"));
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);

  const count = ico.readUInt16LE(4);
  const entries = [];
  for (let index = 0; index < count; index += 1) {
    const offset = 6 + index * 16;
    const imageOffset = ico.readUInt32LE(offset + 12);
    entries.push({
      width: ico[offset] || 256,
      height: ico[offset + 1] || 256,
      bits: ico.readUInt16LE(offset + 6),
      bytes: ico.readUInt32LE(offset + 8),
      png: ico.toString("ascii", imageOffset + 1, imageOffset + 4) === "PNG"
    });
  }

  assert.deepEqual(entries.map((entry) => entry.width), [16, 24, 32, 48, 64, 128, 256]);
  assert.equal(entries.every((entry) => entry.width === entry.height), true);
  assert.equal(entries.every((entry) => entry.bits === 32), true);
  assert.equal(entries.every((entry) => entry.bytes > 0), true);
  assert.equal(entries.every((entry) => entry.png), true);
});
