/**
 * After `playwright test --project=demo-videos`, copies each test's default
 * `test-results/<run-dir>/video.webm` into `docs/demo-videos/<stable-name>.webm`.
 *
 * Avoids page.video().saveAs() which can hang on long headless recordings.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.resolve(__dirname, '..');
const RESULTS_DIR = path.join(FRONTEND_DIR, 'test-results');
const OUT_DIR = path.resolve(FRONTEND_DIR, '../docs/demo-videos');

/** [folder substring match (case insensitive), output filename] */
const MAP = [
  ['01-storefront', '01-storefront-tour.webm'],
  ['02-register', '02-register-session.webm'],
  ['03-checkout', '03-checkout-flow.webm'],
  ['04-search', '04-search-catalog.webm'],
  ['05-sign-in', '05-sign-in-session.webm'],
  ['06-profile', '06-profile-orders.webm'],
];

function findRunVideos() {
  const out = [];
  if (!fs.existsSync(RESULTS_DIR)) return out;
  for (const name of fs.readdirSync(RESULTS_DIR)) {
    const videoPath = path.join(RESULTS_DIR, name, 'video.webm');
    if (fs.existsSync(videoPath)) {
      out.push({ dirname: name, videoPath });
    }
  }
  return out;
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const entries = findRunVideos();
/** @type {Map<string,{videoPath:string,mtime:number}>} */
const best = new Map();

for (const { dirname, videoPath } of entries) {
  const match = MAP.find(([key]) =>
    dirname.toLowerCase().includes(key.toLowerCase())
  );
  if (!match) continue;
  const [, outName] = match;
  const mtime = fs.statSync(videoPath).mtimeMs;
  const prev = best.get(outName);
  if (!prev || mtime > prev.mtime) best.set(outName, { videoPath, mtime });
}

let copied = 0;
for (const [file, { videoPath }] of best) {
  const dest = path.join(OUT_DIR, file);
  fs.copyFileSync(videoPath, dest);
  console.log(`sync-demo-webm: ${path.relative(FRONTEND_DIR, videoPath)} -> ../docs/demo-videos/${file}`);
  copied += 1;
}

if (!copied) {
  console.warn(
    'sync-demo-webm: no video.webm found under frontend/test-results. Run demo-videos project first.'
  );
  process.exitCode = 1;
} else {
  console.log(`sync-demo-webm: copied ${copied} file(s) to docs/demo-videos/`);
}
