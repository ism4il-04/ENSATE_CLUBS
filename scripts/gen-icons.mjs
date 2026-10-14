// Génère les icônes de l'application à partir des sources de la marque (public/brand/*.svg).
// Usage : npm run icons
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";

const src = (f) => readFileSync(`public/brand/${f}`);
const png = (svg, size) => sharp(svg, { density: 400 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

const out = [
  ["public/icons/icon-192.png", "icone-app.svg", 192],
  ["public/icons/icon-512.png", "icone-app.svg", 512],
  ["public/icons/maskable-512.png", "icone-maskable.svg", 512], // Android : fond plein, étoile en zone de sécurité
  ["src/app/icon.png", "icone-app.svg", 512],
  ["src/app/apple-icon.png", "icone-apple.svg", 180], // iOS arrondit lui-même les coins
];
for (const [file, source, size] of out) {
  writeFileSync(file, await png(src(source), size));
  console.log(file);
}
// favicon.ico (16, 32, 48 px, PNG embarqués)
const tailles = [16, 32, 48];
const images = await Promise.all(tailles.map((t) => png(src("icone-app.svg"), t)));
const entete = Buffer.alloc(6 + 16 * images.length);
entete.writeUInt16LE(1, 2);
entete.writeUInt16LE(images.length, 4);
let offset = entete.length;
images.forEach((data, i) => {
  const o = 6 + 16 * i;
  entete.writeUInt8(tailles[i], o);
  entete.writeUInt8(tailles[i], o + 1);
  entete.writeUInt16LE(1, o + 4);
  entete.writeUInt16LE(32, o + 6);
  entete.writeUInt32LE(data.length, o + 8);
  entete.writeUInt32LE(offset, o + 12);
  offset += data.length;
});
writeFileSync("src/app/favicon.ico", Buffer.concat([entete, ...images]));
console.log("src/app/favicon.ico");
