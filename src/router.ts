/**
 * Sinwan Router — Core Router
 *
 * Manages route state, navigation, and matching using Sinwan's reactivity.
 * Uses a radix tree for O(depth) route lookups — no regex compilation.
 * SSR-safe: all DOM access is guarded by `typeof window` checks.
 */

import { signal, computed } from "sinwan/reactivity";
import type { Signal, Computed } from "sinwan/reactivity";
import type { SinwanComponent } from "sinwan/component";
import type {
  RouteDefinition,
  MatchedRoute,
  NavigateOptions,
  LazyComponent,
  LazyPeek,
} from "./types.ts";
import {
  createRadixTree,
  radixInsert,
  radixSearch,
  normalizePath,
  extractSearchParams,
  type RadixNode,
} from "./matcher.ts";

function hasTrueFlag(value: object, key: string): boolean {
  return key in value && (value as Record<string, unknown>)[key] === true;
}

/**
 * True for explicit `lazy()` factories, `_SinwanLazy` brands, and zero-arg
 * `() => import(...)` loaders. `cc` components and functions that take props
 * are not treated as lazy importers.
 */
export function isLazyComponent(comp: unknown): comp is LazyComponent {
  if (typeof comp !== "function") return false;
  if (hasTrueFlag(comp, "_SinwanComponent")) return false;
  if (hasTrueFlag(comp, "_SinwanLazy")) return true;
  return comp.length === 0;
}

/** Mark a dynamic import factory as a lazy route component. */
export function lazy(
  loader: () => Promise<{ default: SinwanComponent }>,
): LazyComponent {
  const factory = (): Promise<{ default: SinwanComponent }> => loader();
  return Object.assign(factory, { _SinwanLazy: true as const });
}

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
  private readonly lazyCache = new Map<string, SinwanComponent>();
  private readonly lazyErrors = new Map<string, unknown>();
  private readonly lazyInflight = new Map<string, Promise<SinwanComponent>>();
  private readonly _lazyTick: Signal<number>;
  private popstateHandler: (() => void) | null = null;

  constructor(routes: RouteDefinition[], initialPath?: string) {
    this.tree = createRadixTree();
    this.routeList = [];
    this._lazyTick = signal(0);

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

  private bumpLazyTick(): void {
    this._lazyTick.value = this._lazyTick.value + 1;
  }

  /** Reactive counter bumped when a lazy load succeeds or fails. */
  get lazyTick(): number {
    return this._lazyTick.value;
  }

  /** Current load snapshot for a lazy cache key (pattern). */
  peekLazy(cacheKey: string): LazyPeek {
    const cached = this.lazyCache.get(cacheKey);
    if (cached) return { status: "ready", component: cached };
    if (this.lazyInflight.has(cacheKey)) return { status: "loading" };
    if (this.lazyErrors.has(cacheKey)) {
      return { status: "error", error: this.lazyErrors.get(cacheKey) };
    }
    return { status: "idle" };
  }

  /**
   * Start a lazy import if needed. Does not retry a stored error
   * (the outlet keeps showing the error UI until navigation or prefetch).
   */
  ensureLazy(cacheKey: string, loader: LazyComponent): void {
    const state = this.peekLazy(cacheKey);
    if (state.status !== "idle") return;
    this.startLazyLoad(cacheKey, loader);
  }

  private startLazyLoad(
    cacheKey: string,
    loader: LazyComponent,
  ): Promise<SinwanComponent> {
    this.lazyErrors.delete(cacheKey);
    const pending = loader()
      .then((mod) => {
        this.lazyCache.set(cacheKey, mod.default);
        this.lazyErrors.delete(cacheKey);
        this.bumpLazyTick();
        return mod.default;
      })
      .catch((err: unknown) => {
        this.lazyErrors.set(cacheKey, err);
        this.bumpLazyTick();
        throw err;
      })
      .finally(() => {
        this.lazyInflight.delete(cacheKey);
      });
    this.lazyInflight.set(cacheKey, pending);
    pending.catch(() => {
      /* prefetch / outlet consume errors via peekLazy */
    });
    return pending;
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

  /** Prefetch a route's lazy component into this router's cache. */
  prefetch(path: string): void {
    if (typeof window === "undefined") return;

    const normalized = normalizePath(path);
    const result = radixSearch(this.tree, normalized);
    if (!result) return;

    const leaf = result.data as LeafData;
    const route = leaf.route;
    if (!isLazyComponent(route.component)) return;

    const cacheKey = leaf.fullPattern;
    const state = this.peekLazy(cacheKey);
    if (state.status === "ready" || state.status === "loading") return;
    this.startLazyLoad(cacheKey, route.component);
  }

  /** Resolve a lazy component, using this instance's cache if available. */
  async resolveComponent(
    route: RouteDefinition,
  ): Promise<SinwanComponent> {
    if (!isLazyComponent(route.component)) {
      return route.component;
    }

    const cacheKey = this.findFullPattern(route) ?? route.path;
    const cached = this.lazyCache.get(cacheKey);
    if (cached) return cached;

    const inflight = this.lazyInflight.get(cacheKey);
    if (inflight) return inflight;

    return this.startLazyLoad(cacheKey, route.component);
  }

  /** Find the full pattern for a route. */
  private findFullPattern(route: RouteDefinition): string | undefined {
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

  /** Clean up event listeners and drop this instance's lazy cache. */
  dispose(): void {
    if (this.popstateHandler && typeof window !== "undefined") {
      window.removeEventListener("popstate", this.popstateHandler);
      this.popstateHandler = null;
    }
    this.lazyCache.clear();
    this.lazyErrors.clear();
    this.lazyInflight.clear();
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
