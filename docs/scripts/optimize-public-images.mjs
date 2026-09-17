/**
 * Converts large PNG assets in public/ to WebP for faster LCP on mobile.
 *
 * Usage: node docs/scripts/optimize-public-images.mjs
 */
import { stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '../..');

const TARGETS = [
  'public/assets/images/home-hero-background.jpg',
  'public/categorias/guindastes-remocoes/guindaste-industrial-operacao.png',
  'public/categorias/guindastes-remocoes/munck-icamento-carga.png',
  'public/equipamentos/guindaste-industrial-munck-remocao-bh.png',
];

function formatKb(bytes) {
  return `${Math.round(bytes / 1024)} KB`;
}

for (const relativePath of TARGETS) {
  const inputPath = path.join(ROOT, relativePath);
  const outputPath = inputPath.replace(/\.(png|jpe?g)$/i, '.webp');

  const before = await stat(inputPath);
  await sharp(inputPath)
    .resize({ width: 1920, withoutEnlargement: true })
    .webp({ quality: 72, effort: 4 })
    .toFile(outputPath);
  const after = await stat(outputPath);

  console.log(`${relativePath}: ${formatKb(before.size)} → ${path.basename(outputPath)} ${formatKb(after.size)}`);
}
