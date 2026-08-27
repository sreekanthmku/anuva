import type { FamilyShareChannel } from '@anuva/shared';

/**
 * Every share path here is synchronous up to the point the OS takes over, and that is deliberate:
 * `window.open` and `navigator.share` only work inside the user-gesture call stack. Awaiting a fetch
 * first would get the popup blocked on desktop and the share sheet refused on iOS — so the caller
 * fires the share, then records it.
 */

export function openWhatsAppShare(message: string): void {
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
}

export function canNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/**
 * iOS resolves this promise whether she sent the link or cancelled the sheet, and rejects with
 * `AbortError` only sometimes. There is no outcome worth branching on, so the caller treats an open
 * sheet as a share — an over-counted share costs one extra 7-minute window, an under-counted one
 * re-blocks a woman who did send the link.
 */
export async function openNativeShare(message: string): Promise<void> {
  try {
    await navigator.share({ text: message });
  } catch {
    /* cancelled, or unsupported mid-flight — nothing to recover */
  }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export const SHARE_CHANNELS: Record<'whatsapp' | 'native' | 'copy', FamilyShareChannel> = {
  whatsapp: 'whatsapp',
  native: 'native',
  copy: 'copy',
};
