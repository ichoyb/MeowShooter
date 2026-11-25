import limits from '../asset-budget.json';

type DecodedSource = {naturalWidth: number; naturalHeight: number; complete: boolean};
type SourceMeasurement = {name: string; width: number; height: number; bytes: number};

// Accounting only: image ownership, loading and cache lifetime stay with callers.
export class ImageBudget {
  private readonly sources = new Map<DecodedSource, {measurement: SourceMeasurement; background: boolean}>();
  private total = 0;
  private backgroundTotal = 0;

  constructor(private readonly limit: number) {
    if (!Number.isSafeInteger(limit) || limit <= 0) throw new Error('图片预算无效');
  }

  register(name: string, image: DecodedSource): void {
    const width = image.naturalWidth, height = image.naturalHeight;
    const background = limits.backgroundSources.includes(name.replace(/^\.\//, ''));
    if (!name || !image.complete || !Number.isInteger(width) || !Number.isInteger(height) ||
        width <= 0 || height <= 0 || (!background && (width > limits.maxSourceEdge || height > limits.maxSourceEdge))) {
      throw new Error('图片尚未解码或尺寸无效：' + name);
    }
    const previous = this.sources.get(image);
    if (previous) {
      if (previous.measurement.width !== width || previous.measurement.height !== height) throw new Error('已注册图片尺寸改变：' + name);
      if (previous.background !== background) throw new Error('已注册图片分类改变：' + name);
      return;
    }
    const bytes = width * height * 4;
    if (!background && this.total + bytes > this.limit) throw new Error('共享图片源超过预算：' + name);
    this.sources.set(image, {measurement: {name, width, height, bytes}, background});
    if (background) this.backgroundTotal += bytes;
    else this.total += bytes;
  }

  // Call only when the owning failed-load/disposal path releases this source.
  release(image: DecodedSource): void {
    const previous = this.sources.get(image);
    if (!previous) return;
    this.sources.delete(image);
    if (previous.background) this.backgroundTotal -= previous.measurement.bytes;
    else this.total -= previous.measurement.bytes;
  }

  assertHeadroom(): void {
    if (this.limit - this.total < limits.minimumHeadroom) throw new Error('共享图片源预算余量不足');
  }

  snapshot() {
    const records = Array.from(this.sources.values());
    return {mode:'strict' as const,warnings:[] as string[],sourceLimitBytes: this.limit, sourceRGBA: this.total, headroom: this.limit - this.total,
      backgroundRGBA: this.backgroundTotal,
      sources: records.filter(record => !record.background).map(record => ({...record.measurement})),
      backgrounds: records.filter(record => record.background).map(record => ({...record.measurement}))};
  }
}
