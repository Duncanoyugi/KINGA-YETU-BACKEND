/**
 * Copies non-TypeScript runtime assets into dist so they exist next to the
 * compiled code in production.
 *
 * Nest's compilerOptions.assets is unreliable here: because `sourceRoot` is
 * `src` and `outDir` is `dist`, the emitted JavaScript lands in `dist/src/`
 * while assets get copied relative to `dist/`, so the two never line up and
 * the templates end up nested at `dist/notifications/templates/...`. A plain
 * copy keeps the asset tree byte-for-byte predictable.
 *
 * Templates are loaded at runtime via `__dirname`:
 *   - email.provider.ts            -> dist/src/notifications/templates/email
 *   - notification-queue.service.ts -> dist/src/notifications/templates/sms
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const COPY_DIRS = [
  {
    from: path.join(ROOT, 'src', 'notifications', 'templates'),
    to: path.join(ROOT, 'dist', 'src', 'notifications', 'templates'),
  },
];

function copyDir(from, to) {
  if (!fs.existsSync(from)) {
    throw new Error(`Asset source directory not found: ${from}`);
  }

  fs.mkdirSync(to, { recursive: true });

  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);

    if (entry.isDirectory()) {
      copyDir(source, target);
    } else if (entry.isFile()) {
      fs.copyFileSync(source, target);
    }
  }
}

for (const { from, to } of COPY_DIRS) {
  copyDir(from, to);
  console.log(`Copied assets ${path.relative(ROOT, from)} -> ${path.relative(ROOT, to)}`);
}
