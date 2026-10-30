/**
 * Sinwan Router — scroll helpers for the `scroll: "top"` option.
 */

/** The fragment of an href or `location.hash`, without `#` (`""` when none). */
export function hashFromHref(href: string): string {
  const index = href.indexOf("#");
  return index === -1 ? "" : href.slice(index + 1);
}

/** The element a URL fragment points at, by id (percent-decoded when valid). */
export function findHashTarget(
  doc: Pick<Document, "getElementById">,
  hash: string,
): HTMLElement | null {
  let id = hash;
  try {
    id = decodeURIComponent(hash);
  } catch {
    // Malformed escape: look the raw fragment up instead.
  }
  return doc.getElementById(id);
}

/** Resolves on the next animation frame, after pending DOM updates paint. */
export function nextFrame(win: Pick<Window, "requestAnimationFrame">): Promise<void> {
  return new Promise((resolve) => {
    win.requestAnimationFrame(() => resolve());
  });
}
