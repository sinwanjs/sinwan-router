/**
 * Nested-outlet matching and Key identity.
 */

import { isLazyComponent } from "./router.ts";
import type { Router } from "./router.ts";
import type { MatchedRoute } from "./types.ts";

/**
 * Walk the matched route chain to a specific depth.
 * depth=0 → root match, depth=1 → first child, etc.
 */
export function getMatchAtDepth(
  matched: MatchedRoute | null,
  depth: number,
): MatchedRoute | null {
  if (!matched) return null;
  let current: MatchedRoute | undefined = matched;
  const chain: MatchedRoute[] = [];
  while (current) {
    chain.unshift(current);
    current = current.parent;
  }
  return chain[depth] ?? null;
}

/**
 * Stable identity for a match at one outlet depth.
 * Parent layouts ignore child param changes; param routes include their values.
 */
export function routeIdentity(matched: MatchedRoute): string {
  const pattern = matched.matchedPath;
  if (pattern.includes("*")) {
    return matched.path;
  }
  let concrete = pattern;
  for (const key of Object.keys(matched.params)) {
    const value = matched.params[key];
    if (value === undefined) continue;
    concrete = concrete.replace(":" + key, encodeURIComponent(value));
  }
  if (concrete.includes(":")) {
    return matched.path;
  }
  return concrete;
}

function lazyStatusSuffix(router: Router, matched: MatchedRoute): string {
  if (!isLazyComponent(matched.route.component)) return "sync";
  const state = router.peekLazy(matched.matchedPath);
  return state.status;
}

/**
 * Key value for `<Key>` at an outlet depth.
 * Reads `lazyTick` so load completion re-evaluates without a same-path navigate.
 * Unchanged identities do not remount parent layouts.
 */
export function computeOutletKey(router: Router, depth: number): string {
  void router.lazyTick;
  const matched = getMatchAtDepth(router.matched, depth);
  if (!matched) {
    return depth > 0 ? `__empty:${depth}` : "__notfound__";
  }
  return `${routeIdentity(matched)}:${lazyStatusSuffix(router, matched)}`;
}
