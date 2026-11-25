// Keep decoded package images. New UI canvases draw these pixels directly;
// neither the host address nor Canvas export is required (file: can be tainted).
// Only 14 small UI assets are retained; the garden remains a package file.
export type UIAssetMapping = {logicalSize:{w:number;h:number};destination:{x:number;y:number;w:number;h:number}};
const mappings = new Map<string, UIAssetMapping>();
const loaded = new Map<string, HTMLImageElement>();
import {ImageBudget} from '../image-budget';
const defaultBudget = new ImageBudget(5 * 1024 * 1024);
export function registerUIAsset(name: string, image: HTMLImageElement, budget: ImageBudget = defaultBudget, mapping?: UIAssetMapping): void {
  if (loaded.has(name)) return;
  if (name === 'garden.jpeg') {
    budget.register('assets/ui/' + name, image);
    loaded.set(name, image);
    return;
  }
  const width = image.naturalWidth, height = image.naturalHeight;
  const bytes = width * height * 4;
  if (!image.complete || !width || !height || width > 512 || height > 512) throw new Error('UI图片尺寸无效：' + name);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  try {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('UI图片绘制能力不可用：' + name);
    context.drawImage(image, 0, 0);
    budget.register('ui/' + name, image);
    loaded.set(name, image);
    if (mapping) mappings.set(name, mapping);
  } finally { canvas.width = 0; canvas.height = 0; }
}
export function getUIAsset(name: string): HTMLImageElement {
  const image = loaded.get(name);
  if (!image) throw new Error('UI图片未加载：' + name);
  return image;
}
export function drawUIAssets(root: ParentNode): void {
  const dpr = typeof window === 'undefined' ? 1 : Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  root.querySelectorAll<HTMLCanvasElement>('canvas[data-ui-asset]').forEach(canvas => {
    const image = loaded.get(canvas.dataset.uiAsset || '');
    if (!image) return; // Loading page can exist before its image finishes.
    const mapping = mappings.get(canvas.dataset.uiAsset || '');
    const logicalWidth = mapping?.logicalSize.w ?? image.naturalWidth, logicalHeight = mapping?.logicalSize.h ?? image.naturalHeight;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    // Downsample once with the 2D filter, rather than asking CSS to shrink a
    // 384px texture into a small avatar with coarse texture filtering.
    const scale = Math.min(canvas.dataset.uiAsset?.endsWith('.svg') ? Infinity : 1, rect.width * dpr / logicalWidth, rect.height * dpr / logicalHeight);
    const width = Math.max(1, Math.round(logicalWidth * scale)), height = Math.max(1, Math.round(logicalHeight * scale));
    const key = width + 'x' + height;
    if (canvas.dataset.assetPaintKey === key) return;
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('UI图片绘制能力不可用');
    context.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in context) context.imageSmoothingQuality = 'high';
    if (mapping) {
      const d = mapping.destination;
      context.drawImage(image, d.x * width / logicalWidth, d.y * height / logicalHeight, d.w * width / logicalWidth, d.h * height / logicalHeight);
    } else context.drawImage(image, 0, 0, width, height);
    canvas.dataset.assetReady = 'true';
    canvas.dataset.assetPaintKey = key;
  });
}

// Live render surfaces are additional Canvas memory, never decoded-source
// budget entries. Query the current DOM so removed UI copies are not retained.
export function uiCanvasSnapshot(root: ParentNode) {
  const canvases = Array.from(root.querySelectorAll<HTMLCanvasElement>('canvas[data-ui-asset]'), canvas =>
    ({asset:canvas.dataset.uiAsset || '',width:canvas.width,height:canvas.height,bytes:canvas.width*canvas.height*4}));
  return {surfaceRGBA:canvases.reduce((total,canvas)=>total+canvas.bytes,0),canvases,
    scope:'LIVE_UI_RENDER_SURFACES_EXCLUDES_STAGE_TEXT_MAP_CACHE_AND_DECODED_SOURCES'};
}
