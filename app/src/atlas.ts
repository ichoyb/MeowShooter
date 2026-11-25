const frames: Record<string, object> = {};
['enemy-0', 'enemy-1', 'bell', 'crate', 'fish', 'bone', 'spirit', 'spirit-shot'].forEach((name, index) => {
  frames[name] = { frame: { x: index % 4 * 128, y: Math.floor(index / 4) * 128, w: 128, h: 128 }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: 128, h: 128 }, sourceSize: { w: 128, h: 128 } };
});
export const atlas = { frames, meta: { image: 'atlas.png', size: { w: 512, h: 256 }, scale: '1' } };
