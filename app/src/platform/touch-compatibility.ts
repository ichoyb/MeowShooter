type TouchRecord = { identifier: number; clientX: number; clientY: number; pageX?: number; pageY?: number; target?: EventTarget | null };
type TouchFields = Event & { touches?: TouchRecord[]; targetTouches?: TouchRecord[]; changedTouches?: TouchRecord[] };
type TouchSummary = { identifier: number; clientX: number | null; clientY: number | null; pageX: number | null; pageY: number | null; hasTarget: boolean };
export type TouchInputObservation = {
  at: number; type: string; trusted: boolean; arrayBacked: boolean; normalized: boolean;
  changed: TouchSummary[]; changedAfter: TouchSummary[];
};
const TYPES = ['touchstart', 'touchmove', 'touchend', 'touchcancel'];
const FIELDS = ['touches', 'targetTouches', 'changedTouches'] as const;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const summary = (list: TouchRecord[] | undefined): TouchSummary[] => Array.from(list || []).slice(0, 8).map(t => ({
  identifier: t.identifier, clientX: finite(t.clientX) ? t.clientX : null, clientY: finite(t.clientY) ? t.clientY : null,
  pageX: finite(t.pageX) ? t.pageX : null, pageY: finite(t.pageY) ? t.pageY : null, hasTarget: !!t.target,
}));

/** Adapt array-backed host records at the DOM boundary; Phaser still owns input. */
export function bindCanvasTouchCompatibility(stage: HTMLElement, observe?: (record: TouchInputObservation) => void): () => void {
  const onTouch = (event: Event) => {
    const canvas = event.target;
    if (!(canvas instanceof HTMLCanvasElement) || !stage.contains(canvas)) return;
    const input = event as TouchFields;
    const changed = observe ? summary(input.changedTouches) : [];
    let normalized = false;
    for (const field of FIELDS) {
      const list = input[field];
      // Native TouchList is left intact, including identity and read-only fields.
      if (!Array.isArray(list)) continue;
      let altered = false;
      const next = list.map(t => {
        const x = !finite(t.pageX) && finite(t.clientX), y = !finite(t.pageY) && finite(t.clientY), target = !t.target;
        if (!x && !y && !target) return t;
        altered = true;
        return { ...t, identifier: t.identifier, clientX: t.clientX, clientY: t.clientY,
          pageX: x ? t.clientX + window.scrollX : t.pageX, pageY: y ? t.clientY + window.scrollY : t.pageY,
          target: target ? canvas : t.target };
      });
      if (altered) {
        // The host's generic Event properties are writable. An immutable event
        // remains untouched; compatibility must never break native delivery.
        try { input[field] = next; normalized = normalized || input[field] === next; } catch { /* keep original */ }
      }
    }
    if (observe) {
      try { observe({ at: Date.now(), type: event.type, trusted: event.isTrusted, arrayBacked: Array.isArray(input.changedTouches), normalized, changed, changedAfter: summary(input.changedTouches) }); }
      catch { /* Diagnostics never interfere with engine input. */ }
    }
  };
  TYPES.forEach(type => stage.addEventListener(type, onTouch, { capture: true, passive: true }));
  return () => TYPES.forEach(type => stage.removeEventListener(type, onTouch, true));
}
