/**
 * Sinwan Router — Type Definitions
 */

import type { SinwanComponent } from "sinwan/component";

// ─── Route Definitions ─────────────────────────────────────

/** A component that can be rendered by a route. */
export type RouteComponent =
  | SinwanComponent
  | LazyComponent;

/** A lazy-loaded component factory. */
export type LazyComponent = (() => Promise<{
  default: SinwanComponent;
}>) & {
  _SinwanLazy?: true;
};

/** A single route definition. */
export interface RouteDefinition {
  /** URL path pattern, e.g. `/`, `/users/:id`, `/posts/:slug/comments` */
  path: string;
  /** Component to render when the route matches. */
  component: RouteComponent;
  /** Optional child routes for nested routing. */
  children?: RouteDefinition[];
  /** Optional metadata for the route (e.g. title, breadcrumb). */
  meta?: Record<string, unknown>;
}

/** A matched route with extracted parameters. */
export interface MatchedRoute {
  /** The original route definition. */
  route: RouteDefinition;
  /** Extracted path parameters (e.g. `{ id: "42" }` for `/users/:id`). */
  params: Record<string, string>;
  /** The full URL path that was matched. */
  path: string;
  /** The portion of the URL consumed by this route (for nested routes). */
  matchedPath: string;
  /** Parent match in the route chain (for nested routing). */
  parent?: MatchedRoute;
}

// ─── Navigation ────────────────────────────────────────────

/** Options for navigation. */
export interface NavigateOptions {
  /** Replace the current history entry instead of pushing a new one. */
  replace?: boolean;
  /** Optional state object to associate with the history entry. */
  state?: unknown;
  /**
   * Set to `false` to skip the router's `scroll` handling for this one
   * navigation (for example, a query-param tab switch).
   */
  scroll?: boolean;
}

/**
 * Window scroll after client navigation.
 * - `"preserve"`: leave the scroll position alone (default).
 * - `"top"`: scroll to the top, or to the element named by the URL `#hash`
 *   once the route has rendered (lazy routes included).
 */
export type RouterScroll = "preserve" | "top";

/** Options for `createRouter` / `new Router`. */
export interface RouterOptions {
  /** Starting path. Defaults to `window.location` on the client, `/` on the server. */
  initialPath?: string;
  /**
   * Window scroll after `navigate()` (Link, NavLink, `useNavigate`).
   * With `"top"`, the hash of the first page load is revealed too.
   * Back/forward keep the browser's own scroll restoration.
   * @default "preserve"
   */
  scroll?: RouterScroll;
}

// ─── Router Context ────────────────────────────────────────

/** The router context value provided to descendant components. */
export interface RouterContextValue {
  /** Current URL path (reactive). */
  readonly path: string;
  /** Current matched route (reactive). */
  readonly matched: MatchedRoute | null;
  /** Current route parameters (reactive). */
  readonly params: Record<string, string>;
  /** Current search params (reactive). */
  readonly searchParams: URLSearchParams;
  /** Navigate to a new path. */
  navigate: (to: string, options?: NavigateOptions) => void;
  /** Prefetch a route's lazy component. */
  prefetch: (path: string) => void;
  /** All registered routes. */
  readonly routes: RouteDefinition[];
}

/** Snapshot of a lazy route's load state. */
export type LazyPeek =
  | { status: "ready"; component: SinwanComponent }
  | { status: "error"; error: unknown }
  | { status: "loading" }
  | { status: "idle" };
