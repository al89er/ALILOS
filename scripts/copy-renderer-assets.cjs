const fs = require("node:fs");
const path = require("node:path");

const sourceDir = path.join(__dirname, "..", "src", "renderer");
const targetDir = path.join(__dirname, "..", "dist", "renderer");

fs.mkdirSync(targetDir, { recursive: true });

for (const fileName of ["index.html", "styles.css"]) {
  fs.copyFileSync(path.join(sourceDir, fileName), path.join(targetDir, fileName));
}
