const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const summaryPath = path.join(root, 'coverage', 'coverage-summary.json');
const finalPath = path.join(root, 'coverage', 'coverage-final.json');

function main() {
  if (!fs.existsSync(summaryPath)) {
    console.warn('coverage-summary.json not found; skipping total merge.');
    return;
  }

  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
  if (!summary.total) {
    console.warn('coverage-summary.json missing total; skipping total merge.');
    return;
  }

  let finalContent = {};
  if (fs.existsSync(finalPath)) {
    finalContent = JSON.parse(fs.readFileSync(finalPath, 'utf-8'));
  }

  finalContent.total = summary.total;
  fs.writeFileSync(finalPath, JSON.stringify(finalContent, null, 2));
  console.log('Updated coverage-final.json with total coverage metrics.');
}

main();
