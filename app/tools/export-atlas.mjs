import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Development-only: use the existing bundled Sharp, without adding a dependency.
assert.ok(process.env.SHARP_MODULE && path.isAbsolute(process.env.SHARP_MODULE), 'SHARP_MODULE must name the existing absolute Sharp module path');
const sharp = createRequire(import.meta.url)(process.env.SHARP_MODULE);
const app = fileURLToPath(new URL('../', import.meta.url));
const sourcePath = path.join(app, 'assets/atlas.svg'), outputPath = path.join(app, 'assets/atlas.png');
const sourcesPath = path.join(app, 'ASSET_SOURCES.json');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const source = readFileSync(sourcePath), sources = JSON.parse(readFileSync(sourcesPath, 'utf8'));
assert.equal(sha(source), '4d7a0dc3569980373cb8876b83483172f8a3b97a3b82b2496c31ca600dbb5830', 'approved vector source bytes must remain unchanged');
const parameters = {
  svgDensity: 144, intermediate: { width: 1024, height: 128 },
  frame: { width: 128, height: 128 }, columns: 4, rows: 2,
  png: { compressionLevel: 9, adaptiveFiltering: false, palette: false }
};
// Rasterize the original vectors at 2x. Never resize the old raster PNG.
const { data: raster, info } = await sharp(source, { density: parameters.svgDensity }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
assert.equal(info.width, parameters.intermediate.width); assert.equal(info.height, parameters.intermediate.height); assert.equal(info.channels, 4);
const cells = await Promise.all(sources.atlas.frames.map(async (_, index) => ({
  input: await sharp(raster, { raw: info }).extract({ left: index * 128, top: 0, width: 128, height: 128 }).png(parameters.png).toBuffer(),
  left: index % 4 * 128, top: Math.floor(index / 4) * 128
})));
const output = await sharp({ create: { width: 512, height: 256, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite(cells).png(parameters.png).toBuffer();
writeFileSync(outputPath, output);
Object.assign(sources.atlas, {
  width: 512, height: 256, sourceSha256: sha(source), outputSha256: sha(output),
  operation: 'Direct vector rasterization at density144 to 1024x128; eight 128x128 untrimmed cells repacked to four columns and two rows; original proportions and transparent padding preserved; static P2 runtime use',
  export: { tool: 'tools/export-atlas.mjs', toolSha256: sha(readFileSync(fileURLToPath(import.meta.url))), versions: { node: process.version, ...sharp.versions }, parameters }
});
writeFileSync(sourcesPath, JSON.stringify(sources, null, 2) + '\n');
console.log(JSON.stringify({ sourceSha256: sha(source), outputSha256: sha(output), bytes: output.length, versions: sources.atlas.export.versions, parameters }));
