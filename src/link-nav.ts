/**
 * Link click interception and JSX class adapter.
 */

import type { Reactive } from "sinwan/component";

/** Fields read from a click event to decide client-side navigation. */
export interface LinkClickEvent {
  button: number;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
}

export interface LinkInterceptOptions {
  target?: string;
  download?: string | boolean;
}

/**
 * Sinwan JSX types `class` as `string`; the renderer accepts Reactive<string>.
 * Isolated here so call sites do not use `any`.
 */
export function jsxClass(value: Reactive<string>): string {
  return value as string;
}

/** True when the href should be left to the browser (other origin or scheme). */
export function isExternalHref(href: string): boolean {
  if (href.startsWith("//")) return true;
  const colon = href.indexOf(":");
  if (colon <= 0) return false;
  const slash = href.indexOf("/");
  if (slash !== -1 && slash < colon) return false;
  return true;
}

/** True when the href is an in-page hash (no path change). */
export function isHashOnlyHref(href: string, currentPath: string): boolean {
  if (href.startsWith("#")) return true;
  const hashIdx = href.indexOf("#");
  if (hashIdx === -1) return false;
  const beforeHash = href.slice(0, hashIdx);
  if (beforeHash === "") return true;
  const qIdx = beforeHash.indexOf("?");
  const pathPart = qIdx === -1 ? beforeHash : beforeHash.slice(0, qIdx);
  if (pathPart === "" || pathPart === ".") return true;
  const normalized =
    pathPart.startsWith("/") ? pathPart : "/" + pathPart;
  const stripped =
    normalized.length > 1 && normalized.endsWith("/")
      ? normalized.slice(0, -1)
      : normalized;
  return stripped === currentPath;
}

/** Whether this click should be handled by the client router. */
export function shouldInterceptLinkClick(
  event: LinkClickEvent,
  href: string,
  currentPath: string,
  options: LinkInterceptOptions = {},
): boolean {
  if (event.defaultPrevented) return false;
  if (event.button !== 0) return false;
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
    return false;
  }
  if (options.target != null && options.target !== "" && options.target !== "_self") {
    return false;
  }
  if (options.download !== undefined && options.download !== false) {
    return false;
  }
  if (isExternalHref(href)) return false;
  if (isHashOnlyHref(href, currentPath)) return false;
  return true;
}
