/**
 * Sinwan Router — Public API
 *
 * Client-side router for Sinwan apps, built on Sinwan's reactivity system.
 *
 * @example
 * ```tsx
 * import { createRouter, RouterProvider, RouterOutlet, Link } from "sinwan-router";
 * import { cc, provide } from "sinwan/component";
 *
 * const router = createRouter([
 *   { path: "/", component: Home },
 *   { path: "/users/:id", component: UserProfile },
 *   { path: "/about", component: () => import("./About.tsx") },
 * ]);
 *
 * const App = cc(() => {
 *   provide(RouterKey, router);
 *   return (
 *     <div>
 *       <nav>
 *         <Link href="/">Home</Link>
 *         <Link href="/about">About</Link>
 *       </nav>
 *       <RouterOutlet />
 *     </div>
 *   );
 * });
 * ```
 */

// Core router
export { createRouter, Router, isLazyComponent } from "./router.ts";

// Path matching utilities (radix tree based)
export {
  createRadixTree,
  radixInsert,
  radixSearch,
  buildPath,
  normalizePath,
  extractSearchParams,
} from "./matcher.ts";
export type { RadixNode, RouteData, MatchResult } from "./matcher.ts";

// Components (direct exports — use useRouter() internally)
export { Link, NavLink, RouterOutlet } from "./components.tsx";
export type {
  LinkProps,
  NavLinkProps,
  RouterOutletProps,
} from "./components.tsx";

// Hooks
export {
  useRouter,
  useParams,
  useSearchParams,
  useRoute,
  useNavigate,
  usePath,
  RouterKey,
} from "./hooks.ts";

// Types
export type {
  RouteDefinition,
  RouteComponent,
  LazyComponent,
  MatchedRoute,
  NavigateOptions,
  RouterContextValue,
} from "./types.ts";
