const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "../dist/index.js");

if (!fs.existsSync(filePath)) {
  console.error("Error: dist/index.js does not exist!");
  process.exit(1);
}

const stats = fs.statSync(filePath);
const sizeInMB = stats.size / (1024 * 1024);
const MAX_MB = 2.0;

console.log(`dist/index.js size: ${sizeInMB.toFixed(3)} MB (${stats.size} bytes)`);

if (sizeInMB > MAX_MB) {
  console.error(`Error: Bundle size exceeds limit of ${MAX_MB} MB!`);
  process.exit(1);
}

console.log(`Bundle size check passed (<= ${MAX_MB} MB).`);
