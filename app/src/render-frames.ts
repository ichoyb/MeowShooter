// Presentation diagnostics only. Call record from Phaser's POST_RENDER event.
// Fixed 1ms bins through 10s; the overflow bin reports its observed upper bound.
const LAST_BIN = 10000;
export class RenderFrames {
  private bins = new Uint32Array(LAST_BIN + 1);
  private last: number | null = null;
  private samples = 0;
  private intervals = 0;
  private totalMs = 0;
  private slowMs = 0;
  private maxSlowMs = 0;
  private maxIntervalMs = 0;
  private percentileBin = 0;
  private belowPercentile = 0;
  record(now: number): void {
    this.samples++;
    if (this.last !== null) {
      const interval = Math.max(0, now - this.last), bin = Math.min(LAST_BIN, Math.ceil(interval));
      this.intervals++; this.totalMs += interval; this.maxIntervalMs = Math.max(this.maxIntervalMs, interval);
      this.slowMs = interval > 50 ? this.slowMs + interval : 0; this.maxSlowMs = Math.max(this.maxSlowMs, this.slowMs);
      this.bins[bin]++;
      if (bin < this.percentileBin) this.belowPercentile++;
      // Maintain the nearest-rank P95 cursor without sorting/copying history.
      const rank = Math.ceil(this.intervals * .95);
      while (this.percentileBin > 0 && this.belowPercentile >= rank) { this.percentileBin--; this.belowPercentile -= this.bins[this.percentileBin]; }
      while (this.belowPercentile + this.bins[this.percentileBin] < rank) { this.belowPercentile += this.bins[this.percentileBin]; this.percentileBin++; }
    }
    this.last = now;
  }
  suspend(): void { this.last = null; this.slowMs = 0; }
  reset(): void {
    this.bins.fill(0); this.last = null; this.samples = 0; this.intervals = 0; this.totalMs = 0;
    this.slowMs = 0; this.maxSlowMs = 0; this.maxIntervalMs = 0; this.percentileBin = 0; this.belowPercentile = 0;
  }
  snapshot() {
    const overflow = this.percentileBin === LAST_BIN;
    return { sampleCount: this.samples, intervalCount: this.intervals, avgFPS: this.totalMs > 0 ? this.intervals * 1000 / this.totalMs : null,
      p95IntervalMs: this.intervals ? overflow ? this.maxIntervalMs : this.percentileBin : null,
      maxConsecutiveSlowMs: this.maxSlowMs, intervalResolutionMs: overflow ? Math.max(1, this.maxIntervalMs - LAST_BIN + 1) : 1 };
  }
}
