import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { atlas } from '../src/atlas';

const ids = ['enemy-0', 'enemy-1', 'bell', 'crate', 'fish', 'bone', 'spirit', 'spirit-shot'];
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const sources = JSON.parse(readFileSync('ASSET_SOURCES.json', 'utf8'));

test('atlas retains eight IDs in 128px untrimmed cells across four columns and two rows', () => {
  assert.deepEqual(Object.keys(atlas.frames), ids);
  assert.deepEqual(atlas.meta, { image: 'atlas.png', size: { w: 512, h: 256 }, scale: '1' });
  ids.forEach((id, index) => assert.deepEqual(atlas.frames[id], {
    frame: { x: index % 4 * 128, y: Math.floor(index / 4) * 128, w: 128, h: 128 },
    rotated: false, trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: 128, h: 128 }, sourceSize: { w: 128, h: 128 }
  }));
});

test('real PNG dimensions and recorded hashes match the vector source and atlas description', () => {
  const png = readFileSync('assets/atlas.png'), source = readFileSync(sources.atlas.source);
  // Read the standard PNG IHDR only; decoding and transparent edges are tested
  // with Sharp and the real browser fixture, rather than a custom PNG decoder.
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.toString('ascii', 12, 16), 'IHDR');
  assert.equal(png.readUInt32BE(16), atlas.meta.size.w);
  assert.equal(png.readUInt32BE(20), atlas.meta.size.h);
  assert.deepEqual([sources.atlas.width, sources.atlas.height], [512, 256]);
  assert.deepEqual(sources.atlas.frames, ids);
  assert.equal(sha(source), '4d7a0dc3569980373cb8876b83483172f8a3b97a3b82b2496c31ca600dbb5830');
  assert.equal(sources.atlas.sourceSha256, sha(source));
  assert.equal(sources.atlas.outputSha256, sha(png));
});

test('atlas export records direct vector rasterization and the actual local tool', () => {
  const record = sources.atlas.export;
  assert.ok(record, 'vector export parameters are recorded');
  assert.equal(record.tool, 'tools/export-atlas.mjs');
  assert.equal(record.toolSha256, sha(readFileSync(record.tool)));
  assert.match(record.versions.sharp, /^\d+\.\d+\.\d+$/);
  assert.match(record.versions.node, /^v\d+\.\d+\.\d+$/);
  assert.deepEqual(record.parameters, {
    svgDensity: 144, intermediate: { width: 1024, height: 128 },
    frame: { width: 128, height: 128 }, columns: 4, rows: 2,
    png: { compressionLevel: 9, adaptiveFiltering: false, palette: false }
  });
});

test('atlas work preserves all three original runtime cats and the diagnostic cat bytes', () => {
  const originals: Record<string, string> = {
    CAT01: '07510c3166df258762f00e78411e4cb261a040a96c296115ad245e38e0630806',
    CAT02: 'cf5de387334ab3565b812e820d95e15b25be3c3591065dea6e8ec6c985a23452',
    CAT03: '57f500da07c4d71419c9c75fe359a192622523b66230ba5850f0da4b003c6384'
  };
  assert.deepEqual(sources.runtimeCats.map((cat: { id: string }) => cat.id), Object.keys(originals));
  for (const cat of sources.runtimeCats) {
    assert.equal(cat.sha256, originals[cat.id]);
    assert.equal(sha(readFileSync(cat.source)), originals[cat.id]);
  }
  assert.equal(sha(readFileSync('assets/cat.png')), '76f6222459d51a6cdcae5e10f5ee98be7b6c1b081355d37f414a773dbc293e2b');
});
