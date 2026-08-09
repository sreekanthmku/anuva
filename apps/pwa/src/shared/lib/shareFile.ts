/**
 * Handing a downloaded file to another app (WhatsApp, Mail, Files) with its name intact.
 *
 * Sharing the page or a `blob:` URL instead sends a link no other app can resolve — the receiving
 * chat shows `blob:https://…` and an unnamed attachment. Web Share level 2 takes the bytes
 * themselves, so the file arrives as a real named document.
 */

export type ShareFileOutcome = 'shared' | 'downloaded' | 'cancelled';

/** Saves the file locally so the user can attach it by hand wherever sharing is unavailable. */
export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Revoked late on purpose: Safari cancels a download whose object URL dies in the same tick.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Must be called from a user gesture. iOS Safari also drops the gesture claim once an `await` has
 * resolved in between, which is why a non-abort failure falls back to a download rather than
 * surfacing an error — the user still ends up with the file.
 */
export async function shareOrDownloadFile(file: File, title?: string): Promise<ShareFileOutcome> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: title || file.name });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'cancelled';
      }
    }
  }

  downloadFile(file);
  return 'downloaded';
}
