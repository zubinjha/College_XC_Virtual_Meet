const fs = require('fs/promises');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const rendererDir = path.join(rootDir, 'renderer');
const serverDir = path.join(rootDir, 'server');
const scraperDir = path.join(rootDir, 'scraper');

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function ensureDirExists(dir, label) {
  try {
    await fs.access(dir);
  } catch {
    throw new Error(`Missing ${label} directory at ${dir}`);
  }
}

async function run() {
  await ensureDirExists(rendererDir, 'renderer');
  await ensureDirExists(serverDir, 'server');
  await ensureDirExists(scraperDir, 'scraper');

  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(distDir, { recursive: true });

  await copyDir(rendererDir, path.join(distDir, 'renderer'));
  await copyDir(serverDir, path.join(distDir, 'server'));
  await copyDir(scraperDir, path.join(distDir, 'scraper'));

  const pkgJson = path.join(rootDir, 'package.json');
  const lockFile = path.join(rootDir, 'package-lock.json');
  await fs.copyFile(pkgJson, path.join(distDir, 'package.json'));
  await fs.copyFile(lockFile, path.join(distDir, 'package-lock.json'));

  console.log('Build complete. Run `node dist/server/index.js` to serve the static bundle.');
}

run().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
