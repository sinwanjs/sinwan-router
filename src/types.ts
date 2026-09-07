/**
 * Sinwan Router — Type Definitions
 */

import type { SinwanComponent } from "sinwan/component";

// ─── Route Definitions ─────────────────────────────────────

/** A component that can be rendered by a route. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RouteComponent<P extends object = any> =
  | SinwanComponent<P>
  | LazyComponent<P>;

/** A lazy-loaded component factory. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LazyComponent<P extends object = any> = () => Promise<{
  default: SinwanComponent<P>;
}>;

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
