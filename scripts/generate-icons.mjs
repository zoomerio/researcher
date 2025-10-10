// Generate platform icons from kgeu_logo_svg.svg
// Requires devDeps: sharp, icon-gen
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import icongen from 'icon-gen';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const svgPath = path.join(root, 'kgeu_logo_svg.png');
const outDir = path.join(root, 'build', 'icons');

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true }).catch(() => {});
}

async function generatePngs() {
  const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
  const source = await fs.readFile(svgPath);
  await Promise.all(sizes.map(async (size) => {
    const out = path.join(outDir, `${size}x${size}.png`);
    await sharp(source).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(out);
  }));
}

async function generateIcoIcns() {
  const srcPng = path.join(outDir, '1024x1024.png');
  // icon-gen expects a PNG directory or file; use file path
  await icongen(srcPng, outDir, {
    report: false,
    ico: { name: 'icon' },
    icns: { name: 'icon' }
  });
}

async function main() {
  await ensureDir(outDir);
  await generatePngs();
  await generateIcoIcns();
  console.log(`[icons] Generated icons in ${outDir}`);
}

main().catch((err) => {
  console.error('[icons] Failed to generate icons:', err);
  process.exit(1);
});


