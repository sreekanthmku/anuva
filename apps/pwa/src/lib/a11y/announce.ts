/**
 * Says something to a screen reader without showing it: "Saved", "Report ready", an error that
 * appeared somewhere she is not looking. One shared, visually hidden live region, created on first
 * use. `assertive` interrupts and is for errors only.
 */

const regions: Partial<Record<'polite' | 'assertive', HTMLElement>> = {};

const HIDDEN =
  'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;' +
  'clip:rect(0,0,0,0);white-space:nowrap;border:0;';

function regionFor(politeness: 'polite' | 'assertive'): HTMLElement {
  const existing = regions[politeness];
  if (existing?.isConnected) return existing;
  const el = document.createElement('div');
  el.setAttribute('aria-live', politeness);
  el.setAttribute('aria-atomic', 'true');
  if (politeness === 'assertive') el.setAttribute('role', 'alert');
  el.style.cssText = HIDDEN;
  document.body.appendChild(el);
  regions[politeness] = el;
  return el;
}

export function announce(message: string, politeness: 'polite' | 'assertive' = 'polite'): void {
  if (typeof document === 'undefined' || !message) return;
  const region = regionFor(politeness);
  // Cleared first: the same message twice in a row is otherwise not read the second time.
  region.textContent = '';
  window.setTimeout(() => {
    region.textContent = message;
  }, 50);
}
