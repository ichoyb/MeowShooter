import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const design = new URL('../../docs/ui/design-language/', import.meta.url);
const root = new URL('../', import.meta.url);
const read = (path, base = root) => readFileSync(new URL(path, base), 'utf8');
const fontFile = 'assets/ui/ResourceHanRoundedCN-Heavy.woff2';
const manifestFile = 'src/ui/design-language-font.json';

function extract(source, filename, add) {
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
  function literals(node) {
    if (ts.isStringLiteralLike(node) || ts.isTemplateLiteralToken(node)) {
      if (/[\u3000-\u9fff]/u.test(node.text) && !node.text.includes('<')) add(node.text);
    } else ts.forEachChild(node, literals);
  }
  function visit(node) {
    if (ts.isTemplateExpression(node)) {
      let preceding = node.head.text;
      for (const span of node.templateSpans) {
        if (/<(?:h[1-3]|button|strong)\b[^>]*>[^<>]*$/.test(preceding)) literals(span.expression);
        preceding = span.literal.text;
      }
    }
    if (ts.isStringLiteralLike(node) || ts.isTemplateLiteralToken(node)) {
      for (const match of node.text.matchAll(/<(?:h[1-3]|button|strong|span)\b([^<>]*?)>([^<>]*)(?=<|$)/g)) {
        const [, attributes, content] = match;
        if (/<span\b/.test(match[0]) && !/r1-select-action|court-detail-label|run-objective/.test(attributes)) continue;
        if (/[\u3000-\u9fff]/u.test(content)) add(content);
      }
      for (const match of node.text.matchAll(/class="(?:r1-level-caption[^"]*|run-objective)"[^>]*>([^<>]*)/g)) {
        if (/[\u3000-\u9fff]/u.test(match[1])) add(match[1]);
      }
    }
    if (ts.isCallExpression(node)) {
      const name = node.expression.getText(ast);
      if (/^(?:button|courtyardButton|header|courtyardHeader|courtyardBadge)$/.test(name)) {
        const label = node.arguments[name === 'button' || name === 'courtyardButton' ? 1 : 0];
        if (label) literals(label);
      } else if (name === 'sound' && filename === 'layers') {
        if (node.arguments[2]) literals(node.arguments[2]);
      } else if (/^\w+(?:\.textContent|\.replace)$/.test(name)) {
        for (const arg of node.arguments) if (ts.isStringLiteralLike(arg) && arg.text.length < 24) literals(arg);
      }
    }
    if ((ts.isPropertyAssignment(node) || ts.isVariableDeclaration(node)) && node.initializer &&
        /^(?:title|label|returnLabel|state|ammo|chapterNames)$/.test(node.name.getText(ast))) literals(node.initializer);
    ts.forEachChild(node, visit);
  }
  visit(ast);
}

export function displayGlyphs() {
  const glyphs = new Set();
  const add = value => {
    for (const char of value.normalize('NFC')) {
      if (!/\p{C}/u.test(char)) glyphs.add(char);
    }
  };
  add(Array.from({length: 95}, (_, i) => String.fromCodePoint(32 + i)).join(''));
  add('Ⅱ▶◆♥‹›→×·，。！？、：；％＋／－　');
  // Conditional template branches can split the element start and its text
  // over separate TypeScript tokens. These roles are exercised on real screens.
  add('开始守护该角色尚未开放选择猫咪换猫庭院首关第一章今晚先守住庭院拾取星光变强十分钟内击败巨兽装填中生命弹药确认选择');
  for (const filename of ['r1-home', 'hud', 'layers', 'courtyard-components', 'courtyard-pages', 'pages', 'progression', 'chapter', 'playtest-summary', 'reward-receipt-view', 'components']) {
    extract(read('src/ui/' + filename + '.ts'), filename, add);
  }
  extract(read('src/main.ts'), 'main.ts', add);
  for (const match of read('src/progression-content.ts').matchAll(/\bname:\s*['"]([^'"]+)['"]/g)) add(match[1]);
  const {cats, weapons, upgrades, synergies} = JSON.parse(read('src/ui/content.generated.json'));
  for (const item of [...cats, ...weapons, ...upgrades, ...synergies]) {
    if (item.name) add(item.name);
  }
  return [...glyphs].sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).join('');
}

function verifyFont() {
  const font = readFileSync(new URL(fontFile, root));
  const manifest = JSON.parse(read(manifestFile));
  const coverage = new Set(manifest.glyphs);
  const missing = [...displayGlyphs()].filter(char => !coverage.has(char));
  if (missing.length) throw new Error('展示字体缺字，请重新生成 WOFF2 子集：' + missing.join(''));
  if (createHash('sha256').update(font).digest('hex') !== manifest.sha256) {
    throw new Error('展示字体的文件指纹与子集记录不符');
  }
}

export function visualLanguageCSS() {
  verifyFont();
  const tokens = read('tokens.css', design);
  const icons = read('icons.svg', design);
  const values = Object.fromEntries([...tokens.matchAll(/^\s*(--vl-[-\w]+):\s*([^;]+);/gm)].map(([, key, value]) => [key, value]));
  function resolveValue(key) {
    const value = values[key];
    if (value === undefined) throw new Error('Missing visual token ' + key);
    return value.replace(/var\((--vl-[-\w]+)\)/g, (_, token) => resolveValue(token));
  }
  const used = ['burst', 'sprig', 'paw', 'check', 'heart', 'timer', 'reload', 'replay', 'sound', 'mute', 'gear', 'book', 'help', 'cards'];
  const cssIcons = used.map(id => {
    const shape = icons.match(new RegExp('<symbol id="i-' + id + '" viewBox="([^"]+)">([\\s\\S]*?)</symbol>'));
    if (!shape) throw new Error('Missing design icon ' + id);
    const body = shape[2].replace(/var\(--icon-fill,\s*var\((--vl-[-\w]+)\)\)/g, (_, token) => resolveValue(token))
      .replace(/var\((--vl-[-\w]+)\)/g, (_, token) => resolveValue(token));
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + shape[1] + '">' + body + '</svg>';
    return '  --ui-' + id + ': url("data:image/svg+xml,' + encodeURIComponent(svg) + '");';
  });
  const license = read('fonts/OFL-ResourceHanRounded.txt', design);
  return tokens + '\n/*\n' + license + '\n*/\n:root {\n' + cssIcons.join('\n') + '\n}\n' + read('src/ui/design-language.css');
}

if (process.argv.includes('--glyphs')) process.stdout.write(displayGlyphs());
