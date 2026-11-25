import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
mkdirSync('.test-build', { recursive: true });
const entries=['weapon-bursts','projectile-traits','projectile-flight','bell-abilities','bell-modifiers','progression','progression-capacity','three-builds','combat-config','rules','cat-passives','navigation','run-navigation','battle-geometry','arena-layout','render-frames','release-pages','touch-compatibility','ui-assets','atlas','image-budget','image-budget-wiring','level-config','enemy-behavior','ordinary-enemies','elite-boss','elite-boss-ui','reward-presentation','r1-ui','r2-ui','r2-rewards'];
entries.push('mobile-home-window','playtest-summary');
entries.push('courtyard-background');
entries.push('area-abilities','experience-pickups');
entries.push('hunt-targeting','hunt-growth','hot-start','return-upgrades','normal-growth-pool');
entries.push('player-defense','sentinel','fortress-fusion');
entries.push('sustain-rewards');
entries.push('contracts');
entries.push('stances');
entries.push('normal50-growth-pool','opening','onboarding','chapter','chapter-motion','reward-receipt');
// Preserve forbidden Phaser import edges without parsing browser-only engine dependencies.
const { metafile } = await build({ entryPoints: entries.map(name=>'tests/'+name+'.test.ts'), bundle: true, platform: 'node', format: 'esm', target: 'node22', outdir: '.test-build',outExtension:{'.js':'.mjs'}, metafile: true, external: ['phaser','phaser/*'] });
for (const name of ['onboarding','opening','normal50-growth-pool','stances','contracts','sustain-rewards','fortress-fusion','sentinel','player-defense','area-abilities','experience-pickups','weapon-bursts','projectile-traits','projectile-flight','hunt-targeting','hunt-growth','hot-start','return-upgrades','normal-growth-pool','bell-abilities','bell-modifiers','progression','progression-capacity','three-builds','combat-config','rules','cat-passives','battle-geometry','arena-layout','image-budget','level-config','enemy-behavior','elite-boss']) {
  const entry = 'tests/'+name+'.test.ts';
  const pending = [{ path: entry, chain: [entry] }];
  const visited = new Set();
  while (pending.length) {
    const { path, chain } = pending.pop();
    if (visited.has(path)) continue;
    visited.add(path);
    const normalized = path.replaceAll('\\','/');
    if (normalized === 'phaser' || normalized.startsWith('phaser/') ||
      /(^|\/)node_modules\/phaser\//.test(normalized) ||
      /(^|\/)src\/(battle\.ts|phaser-entry\.cjs)$/.test(normalized)) {
      throw new Error('ADR-0008 RULE-6: pure rule dependency reaches the Phaser runtime: '+chain.join(' -> '));
    }
    for (const dependency of metafile.inputs[path]?.imports ?? []) {
      pending.push({ path: dependency.path, chain: [...chain, dependency.path] });
    }
  }
}
const nativeTests = [
  'courtyard-balance-export.test.mjs',
  'opening-engine.test.cjs','battle-hits.test.cjs','area-clock.test.cjs','sentinel-clock.test.cjs',
  'build-profiles.test.cjs','courtyard-build.test.mjs','h1-build.test.mjs',
  'f1-audio.test.mjs','f1-audio-ui.test.mjs','f1-audio-build.test.mjs','f1-audio-native.test.mjs',
  'f1-audio-boss.test.mjs','g5-combat-audio.test.mjs','g5-audio-audition.test.mjs',
  'g6-cat-presentation.test.mjs','held-presence.test.mjs','g6-held-presence.test.mjs','combat-impact-audio.test.mjs','combat-impact-runtime.test.mjs',
  'build-options.test.mjs','release-test-config.test.cjs','render-profile-geometry.test.cjs',
  'g8-packed-frames.test.mjs','image-dimensions.test.mjs','cat01-round-adoption.test.mjs',
  'onboarding-clock.test.cjs',
  'g6-normal-cli.test.cjs','n1-reward-audio.test.mjs','n1-story-audio.test.mjs','n1-story-pcm.test.mjs',
];
const result = spawnSync(process.execPath, ['--test', ...entries.map(name=>'.test-build/'+name+'.test.mjs'), ...nativeTests.map(name=>'tests/'+name)], { stdio: 'inherit', windowsHide: true });
process.exitCode = result.status ?? 1;
