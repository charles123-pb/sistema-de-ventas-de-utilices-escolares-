import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = new URL("../frontend/", import.meta.url);
const output = new URL("public/lectura/", root);
await mkdir(output, { recursive: true });
const copies = [
  ["tesseract.js/dist/worker.min.js", "worker.min.js"],
  ["tesseract.js/LICENSE.md", "LICENSE-tesseract.txt"],
  ["tesseract.js-core/LICENSE", "LICENSE-core.txt"],
  ["@tesseract.js-data/spa/4.0.0/spa.traineddata.gz", "spa.traineddata.gz"],
];
for (const variant of ["lstm", "simd-lstm", "relaxedsimd-lstm"]) {
  const file = `tesseract-core-${variant}.wasm.js`;
  copies.push([`tesseract.js-core/${file}`, file]);
}
for (const [source, target] of copies) {
  await copyFile(fileURLToPath(new URL(`node_modules/${source}`, root)), fileURLToPath(new URL(target, output)));
}
console.log("Lector de listas preparado con reconocimiento en español y archivos locales.");
