import type { Point } from './rules';

export type BattleBounds = { top: number; bottom: number };
export type TouchArea = { left: number; right: number; top: number; bottom: number };
export type Stick = Point & { id: number; dx: number; dy: number };

export const WORLD_WIDTH = 360;
export const MOVEMENT_DEAD_ZONE_CSS = 6;
export const MOVEMENT_MAX_THROW_CSS = 32;
const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value));
export class BattleInput {
  private currentOwner: Stick | null = null;
  private held = new Set<number>();
  private cssScale = 1;
  get owner(): Readonly<Stick> | null { return this.currentOwner; }
  beginTouch(id: number, x: number, y: number, area: TouchArea, cssPixelsPerLogicalUnit = 1, excludedAreas: readonly TouchArea[] = []): boolean {
    if (this.held.has(id)) return false;
    this.held.add(id);
    if (this.currentOwner || !Number.isFinite(x) || !Number.isFinite(y) ||
      x < area.left || x > area.right || y < area.top || y > area.bottom ||
      excludedAreas.some(excluded => x >= excluded.left && x <= excluded.right && y >= excluded.top && y <= excluded.bottom)) return false;
    this.cssScale = Number.isFinite(cssPixelsPerLogicalUnit) && cssPixelsPerLogicalUnit > 0 ? cssPixelsPerLogicalUnit : 1;
    this.currentOwner = { id, x, y, dx: 0, dy: 0 };
    return true;
  }
  moveTouch(id: number, x: number, y: number): void {
    const stick = this.currentOwner;
    if (stick?.id !== id || !Number.isFinite(x) || !Number.isFinite(y)) return;
    let dx = x - stick.x, dy = y - stick.y;
    const distance = Math.hypot(dx, dy);
    const maxThrow = MOVEMENT_MAX_THROW_CSS / this.cssScale;
    if (distance > maxThrow) {
      dx = dx / distance * maxThrow;
      dy = dy / distance * maxThrow;
      stick.x = x - dx;
      stick.y = y - dy;
    }
    stick.dx = dx; stick.dy = dy;
  }
  releaseTouch(id: number): void {
    this.held.delete(id);
    if (this.currentOwner?.id === id) this.currentOwner = null;
  }
  clear(): void { this.currentOwner = null; this.held.clear(); }
  movementVector(): Point {
    const stick = this.currentOwner;
    if (!stick) return { x: 0, y: 0 };
    const distance = Math.hypot(stick.dx, stick.dy);
    const cssDistance = distance * this.cssScale;
    if (cssDistance <= MOVEMENT_DEAD_ZONE_CSS) return { x: 0, y: 0 };
    const speed = clamp((cssDistance - MOVEMENT_DEAD_ZONE_CSS) / (MOVEMENT_MAX_THROW_CSS - MOVEMENT_DEAD_ZONE_CSS), 0, 1);
    return { x: stick.dx / distance * speed, y: stick.dy / distance * speed };
  }
}
