/**
 * Stable paths for demo WebM artifacts (committed under docs/demo-videos/).
 */
const fs = require('fs');
const path = require('path');

const DEMO_DIR = path.resolve(__dirname, '../../../docs/demo-videos');

function ensureDemoDir() {
  fs.mkdirSync(DEMO_DIR, { recursive: true });
}

function demoVideoPath(basename) {
  ensureDemoDir();
  const safe = basename.replace(/[^a-zA-Z0-9_-]/g, '-');
  return path.join(DEMO_DIR, `${safe}.webm`);
}

module.exports = { DEMO_DIR, demoVideoPath };
