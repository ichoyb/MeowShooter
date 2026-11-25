import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import ts from 'typescript';
import {version as esbuildVersion} from 'esbuild';
import {loadRuntimeVendors} from './audio-vendors.mjs';
const sha = value => createHash('sha256').update(value).digest('hex');

// Shared by production and standalone fixtures; creating options writes no files.
export async function createBuildOptions(config, {testInputDiagnostics = false} = {}) {
const audioVendors=config.profile==='playtest'?await loadRuntimeVendors():null;
// Record the versions actually loaded for this build; package.json and its lockfile own the pins.
const versions = { phaser: JSON.parse(readFileSync('node_modules/phaser/package.json', 'utf8')).version, typescript: ts.version, esbuild: esbuildVersion };
const adapted = [];
const expected = {
  'device/Features.js': 'c0aefb460a4ead40d0f395c2f2e3a8aa875a345a0a19ba11be3c33599beec28f',
  'device/Fullscreen.js': '8706d77d4e0dfe84c0f8bf24c9fac54a9a891f59df6528612c57e4e692f250dc',
  'input/mouse/MouseManager.js': 'a8b549fa39fa8ff861a1977b0bae6358ccaa3b951db2cf88d7a77ae0320e9cad',
  'scale/ScaleManager.js': 'faf5f0c5cb510bf69895814f298d9a87b33cf2de454388874df72c3101bc5783',
  'input/touch/TouchManager.js': '9f8fdce244e419341847b2732c29c35b517fedc5e4e507fc485fa4336e751a9c',
};
function changeBodies(source, targets, remove = false) {
  const ast = ts.createSourceFile('vendor.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const edits = []; const found = [];
  function visit(node) {
    const name = node.name && node.name.getText(ast).replace(/['"]/g, '');
    if (name && Object.prototype.hasOwnProperty.call(targets, name)) {
      if (remove && ts.isPropertyAssignment(node)) {
        let end = node.end; while (/\s/.test(source[end] || '') && end < source.length) end++;
        if (source[end] !== ',') throw new Error('Expected property comma: ' + name);
        edits.push([node.getFullStart(), end + 1, '']); found.push(name); return;
      }
      const body = node.body || node.initializer?.body;
      if (body) { edits.push([body.getStart(ast), body.end, targets[name]]); found.push(name); return; }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (found.length !== Object.keys(targets).length) throw new Error('Unexpected vendor adaptation count');
  for (const [start, end, value] of edits.sort((a,b) => b[0] - a[0])) source = source.slice(0, start) + value + source.slice(end);
  return source;
}
const license = readFileSync('node_modules/phaser/LICENSE.md', 'utf8') + '\n\nEmbedded eventemitter3:\n' + readFileSync('node_modules/eventemitter3/LICENSE', 'utf8')+(audioVendors?'\n\nZzFX / ZzFXM:\n'+audioVendors.licenses.join('\n\n'):'');
const buildOptions = {
  entryPoints: ['src/main.ts'], bundle: true, format: 'iife', platform: 'browser', target: ['es2017', 'chrome61'], define:{__BUILD_PROFILE__:JSON.stringify(config.profile),__COURTYARD_ENABLED__:JSON.stringify(config.courtyardEnabled),__COMBAT_SLICE_ENABLED__:JSON.stringify(config.combatSliceEnabled),__TEST_INPUT_DIAGNOSTICS__:JSON.stringify(testInputDiagnostics === true)}, minify: true, sourcemap: false, legalComments: 'none', metafile: true, outfile: config.dist+'/assets/main.js',
  banner: { js: '/*! Phaser ' + versions.phaser + ' license\n' + license.replace(/\*\//g, '* /') + '\n*/' },
  plugins: [...(audioVendors?[audioVendors.plugin]:[]),{ name: 'phaser-canvas-minitool', setup(builder) {
    builder.onLoad({ filter: /[\\/]phaser[\\/]src[\\/].*\.js$/ }, args => {
      let source = readFileSync(args.path, 'utf8');
      const relative = args.path.replace(/\\/g, '/').split('/phaser/src/')[1];
      if (expected[relative]) {
        if (sha(source) !== expected[relative]) throw new Error('Vendor SHA changed: ' + relative);
        if (relative === 'device/Fullscreen.js') source = 'module.exports = { available:false, active:false, keyboard:false, request:"", cancel:"" };';
        if (relative === 'device/Features.js') source = changeBodies(source, { init: '{ Features.canvas = !!window.CanvasRenderingContext2D; Features.getUserMedia = false; Features.littleEndian = checkIsLittleEndian(); return Features; }' });
        if (relative === 'input/mouse/MouseManager.js') source = changeBodies(source, { requestPointerLock: '', releasePointerLock: '' }, true);
        if (relative === 'scale/ScaleManager.js') source = changeBodies(source, { startFullscreen: '{ return this; }', stopFullscreen: '{ return this; }' });
        if (relative === 'input/touch/TouchManager.js') {
          const token = 'if (_this.capture)';
          if (source.split(token).length !== 2) throw new Error('Unexpected touchcancel guard count');
          source = source.replace(token, 'if (_this.capture && event.cancelable)');
        }
        adapted.push({ module: relative, originalSha256: expected[relative], adaptedSha256: sha(source) });
      }
      source = source.replace(/typeof CANVAS_RENDERER/g, 'true').replace(/typeof (?:WEBGL_RENDERER|FEATURE_SOUND|WEBGL_DEBUG|PLUGIN_CAMERA3D|PLUGIN_FBINSTANT)/g, 'false');
      return { contents: source, loader: 'js', resolveDir: path.dirname(args.path) };
    });
  }}],
};
return {buildOptions,adapted,versions,audioVendors};
}
