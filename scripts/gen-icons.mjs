// Génère les icônes PWA à partir d'un SVG (logo « e » lime sur encre).
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const svg = (size, pad) => {
  const s = size - pad * 2;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" fill="#0B0C12"/>
  <g transform="translate(${size / 2} ${size / 2}) rotate(-6)">
    <rect x="${-s / 2}" y="${-s / 2}" width="${s}" height="${s}" rx="${s * 0.28}" fill="#C6F24E"/>
    <text x="0" y="${s * 0.2}" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="${s * 0.66}" fill="#0B0C12">e</text>
  </g></svg>`);
};
const out = [
  ["public/icons/icon-192.png", 192, 22],
  ["public/icons/icon-512.png", 512, 60],
  ["public/icons/maskable-512.png", 512, 110],
  ["src/app/icon.png", 512, 60],
  ["src/app/apple-icon.png", 180, 18],
];
for (const [file, size, pad] of out) {
  writeFileSync(file, await sharp(svg(size, pad)).png().toBuffer());
  console.log(file);
}
