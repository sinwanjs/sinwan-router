/**
 * Sinwan Router — Core Router
 *
 * Manages route state, navigation, and matching using Sinwan's reactivity.
 * Uses a radix tree for O(depth) route lookups — no regex compilation.
 * SSR-safe: all DOM access is guarded by `typeof window` checks.
 */

import { signal, computed, effect } from "sinwan/reactivity";
import type { Signal, Computed } from "sinwan/reactivity";
import type {
  RouteDefinition,
  MatchedRoute,
  NavigateOptions,
} from "./types.ts";
import {
  createRadixTree,
  radixInsert,
  radixSearch,
  normalizePath,
  extractSearchParams,
  type RadixNode,
} from "./matcher.ts";

/** Check if a value is a lazy component (function without _SinwanComponent). */
export function isLazyComponent(comp: unknown): comp is () => Promise<{
  default: import("sinwan/component").SinwanComponent<any>;
}> {
  return typeof comp === "function" && !(comp as any)._SinwanComponent;
}

/** Cache for lazy-loaded components. */
const lazyCache = new Map<
  string,
  import("sinwan/component").SinwanComponent<any>
>();

/** Internal leaf data stored in the radix tree. */
interface LeafData {
  route: RouteDefinition;
  fullPattern: string;
  /** Chain of (route, fullPattern) pairs from root to this leaf. */
  chain: { route: RouteDefinition; fullPattern: string }[];
  [key: string]: unknown;
}

/** The core router instance. */
export class Router {
  private readonly tree: RadixNode;
  private readonly routeList: RouteDefinition[];
  private readonly _path: Signal<string>;
  private readonly _searchParams: Signal<URLSearchParams>;
  private readonly _matched: Computed<MatchedRoute | null>;
  private readonly _params: Computed<Record<string, string>>;
  private popstateHandler: (() => void) | null = null;

  constructor(routes: RouteDefinition[], initialPath?: string) {
    this.tree = createRadixTree();
    this.routeList = [];

    // Insert all routes (including nested) into the radix tree.
    // Static segments are inserted first so they're checked before
    // param segments during search (insertion order within siblings
    // determines search order, and static children are always checked
    // first in searchNode regardless).
    for (const route of routes) {
      this.insertRoute(route, "");
    }

    const startPath =
      initialPath ??
      (typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "/");

    this._path = signal(normalizePath(startPath));
    this._searchParams = signal(extractSearchParams(startPath));

    this._matched = computed(() => {
      const path = normalizePath(this._path.value);
      const result = radixSearch(this.tree, path);
      if (!result) return null;

      const leaf = result.data as LeafData;
      const params = result.params;

      // Build the matched route chain (parent → child).
      // The returned matched route is the deepest (leaf) match,
      // with `parent` pointing up the chain to the root.
      let parent: MatchedRoute | undefined;
      let matched: MatchedRoute | undefined;
      for (let i = 0; i < leaf.chain.length; i++) {
        const entry = leaf.chain[i]!;
        const m: MatchedRoute = {
          route: entry.route,
          params,
          path,
          matchedPath: entry.fullPattern,
          parent: i > 0 ? parent : undefined,
        };
        parent = m;
        matched = m; // last one is the deepest
      }
      return matched ?? null;
    });

    this._params = computed(() => {
      const matched = this._matched.value;
      return matched ? matched.params : {};
    });

    // Listen to popstate on the client
    if (typeof window !== "undefined") {
      this.popstateHandler = () => {
        const url = window.location.pathname + window.location.search;
        this._path.value = normalizePath(url);
        this._searchParams.value = extractSearchParams(url);
      };
      window.addEventListener("popstate", this.popstateHandler);
    }
  }

  /** Recursively insert a route and its children into the tree. */
  private insertRoute(
    route: RouteDefinition,
    parentPath: string,
    parentChain: { route: RouteDefinition; fullPattern: string }[] = [],
  ): void {
    const fullPattern = joinPaths(parentPath, route.path);
    const chain = [...parentChain, { route, fullPattern }];
    const leafData: LeafData = { route, fullPattern, chain };

    radixInsert(this.tree, fullPattern, leafData);
    this.routeList.push(route);

    if (route.children) {
      for (const child of route.children) {
        this.insertRoute(child, fullPattern, chain);
      }
    }
  }

  /** Current URL path (reactive). */
  get path(): string {
    return this._path.value;
  }

  /** Current path signal (for fine-grained reactivity). */
  get pathSignal(): Signal<string> {
    return this._path;
  }

  /** Current matched route (reactive). */
  get matched(): MatchedRoute | null {
    return this._matched.value;
  }

  /** Current matched route computed (for fine-grained reactivity). */
  get matchedComputed(): Computed<MatchedRoute | null> {
    return this._matched;
  }

  /** Current route parameters (reactive). */
  get params(): Record<string, string> {
    return this._params.value;
  }

  /** Current search params (reactive). */
  get searchParams(): URLSearchParams {
    return this._searchParams.value;
  }

  /** All registered routes. */
  get routes(): RouteDefinition[] {
    return this.routeList;
  }

  /** Navigate to a new path. */
  navigate(to: string, options: NavigateOptions = {}): void {
    const normalized = normalizePath(to);

    if (typeof window !== "undefined") {
      if (options.replace) {
        window.history.replaceState(options.state ?? {}, "", to);
      } else {
        window.history.pushState(options.state ?? {}, "", to);
      }
    }

    this._path.value = normalized;
    this._searchParams.value = extractSearchParams(to);
  }

  /** Prefetch a route's lazy component. */
  prefetch(path: string): void {
    if (typeof window === "undefined") return;

    const normalized = normalizePath(path);
    const result = radixSearch(this.tree, normalized);
    if (!result) return;

    const leaf = result.data as LeafData;
    const route = leaf.route;
    if (!isLazyComponent(route.component)) return;

    const cacheKey = leaf.fullPattern;
    if (!lazyCache.has(cacheKey)) {
      route.component().then((mod) => {
        if (!lazyCache.has(cacheKey)) {
          lazyCache.set(cacheKey, mod.default);
        }
      });
    }
  }

  /** Resolve a lazy component, using cache if available. */
  async resolveComponent(
    route: RouteDefinition,
  ): Promise<import("sinwan/component").SinwanComponent<any>> {
    if (!isLazyComponent(route.component)) {
      return route.component;
    }

    const cacheKey = this.routeList.includes(route)
      ? (this.findFullPattern(route) ?? route.path)
      : route.path;
    const cached = lazyCache.get(cacheKey);
    if (cached) return cached;

    const mod = await route.component();
    lazyCache.set(cacheKey, mod.default);
    return mod.default;
  }

  /** Find the full pattern for a route. */
  private findFullPattern(route: RouteDefinition): string | undefined {
    // Search the tree for this route
    return this.searchForRoute(this.tree, route, "");
  }

  private searchForRoute(
    node: RadixNode,
    target: RouteDefinition,
    pathSoFar: string,
  ): string | undefined {
    if (node.route) {
      const leaf = node.route as LeafData;
      if (leaf.route === target) return leaf.fullPattern;
    }
    for (const child of node.children) {
      const seg = child.isParam
        ? "/:" + child.paramName
        : child.isWildcard
          ? "/*"
          : "/" + child.prefix;
      const found = this.searchForRoute(child, target, pathSoFar + seg);
      if (found) return found;
    }
    return undefined;
  }

  /** Clean up event listeners. */
  dispose(): void {
    if (this.popstateHandler && typeof window !== "undefined") {
      window.removeEventListener("popstate", this.popstateHandler);
      this.popstateHandler = null;
    }
  }
}

/** Join parent and child paths. */
function joinPaths(parent: string, child: string): string {
  if (child === "/") return parent || "/";
  // Strip leading slash from child so it's always relative
  const relativeChild = child.startsWith("/") ? child.slice(1) : child;
  if (parent === "/" || parent === "") return "/" + relativeChild;
  return parent + "/" + relativeChild;
}

/** Create a router instance. */
export function createRouter(
  routes: RouteDefinition[],
  initialPath?: string,
): Router {
  return new Router(routes, initialPath);
}
