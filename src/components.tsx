/**
 * Sinwan Router — Components
 *
 * Link, NavLink, and RouterOutlet that use useRouter() internally.
 * The router instance must be provided via provide(RouterKey, router).
 */

import { cc } from "sinwan/component";
import { Key } from "sinwan/component";
import type { SinwanComponent, SinwanNode } from "sinwan/component";
import { computed } from "sinwan/reactivity";
import { useRouter } from "./hooks.ts";
import { isLazyComponent } from "./router.ts";
import type { MatchedRoute } from "./types.ts";

// ─── Link ──────────────────────────────────────────────────

export interface LinkProps {
  href: string;
  prefetch?: boolean;
  class?: string;
  children?: SinwanNode;
}

/**
 * Link — client-side navigation anchor.
 * Uses the router from context (provide(RouterKey, router)).
 */
export const Link = cc<LinkProps>(
  ({ href, prefetch = true, class: cls, children }) => {
    const router = useRouter();
    return (
      <a
        href={href}
        class={cls}
        onclick={(e: MouseEvent) => {
          if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          router.navigate(href);
        }}
        onmouseenter={() => {
          if (prefetch) router.prefetch(href);
        }}
      >
        {children}
      </a>
    );
  },
);

// ─── NavLink ───────────────────────────────────────────────

export interface NavLinkProps extends LinkProps {
  activeClass?: string;
}

/**
 * NavLink — Link with active state styling.
 * Uses the router from context.
 */
export const NavLink = cc<NavLinkProps>(
  ({ href, prefetch = true, activeClass = "active", class: cls, children }) => {
    const router = useRouter();
    const isActive = computed(() => {
      const current = router.path;
      return current === href || current.startsWith(href + "/");
    });

    return (
      <a
        href={href}
        class={
          (() =>
            isActive.value
              ? `${cls ?? ""} ${activeClass}`.trim()
              : (cls ?? "")) as any
        }
        onclick={(e: MouseEvent) => {
          if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          router.navigate(href);
        }}
        onmouseenter={() => {
          if (prefetch) router.prefetch(href);
        }}
      >
        {children}
      </a>
    );
  },
);

// ─── RouterOutlet ──────────────────────────────────────────

export interface RouterOutletProps {
  fallback?: SinwanComponent;
  notFound?: SinwanComponent;
  /** Depth of this outlet (0 = top-level, 1 = nested in parent route). */
  depth?: number;
}

// Cache for lazy component resolution.
const lazyCache = new Map<string, SinwanComponent>();

/**
 * Resolve a route component (sync or lazy, with cache).
 * Returns null if the component is lazy and not yet loaded.
 */
function resolveRouteComponent(
  matched: MatchedRoute,
  router: ReturnType<typeof useRouter>,
  fallback?: SinwanComponent,
): SinwanComponent | null {
  const route = matched.route;
  const cacheKey = matched.matchedPath;

  if (!isLazyComponent(route.component)) {
    return route.component as SinwanComponent;
  }

  const cached = lazyCache.get(cacheKey);
  if (cached) return cached;

  // Kick off async load
  route.component().then((mod) => {
    lazyCache.set(cacheKey, mod.default);
    router.navigate(router.path, { replace: true });
  });

  return fallback ?? null;
}

/**
 * Walk the matched route chain to a specific depth.
 * depth=0 → root match, depth=1 → first child, etc.
 */
function getMatchAtDepth(
  matched: MatchedRoute | null,
  depth: number,
): MatchedRoute | null {
  if (!matched) return null;
  let current: MatchedRoute | undefined = matched;
  // Walk to the deepest match first, then walk back `depth` steps
  const chain: MatchedRoute[] = [];
  while (current) {
    chain.unshift(current);
    current = current.parent;
  }
  return chain[depth] ?? null;
}

/**
 * RouterOutlet — renders the matched route's component at a given depth.
 * For nested routes, place a <RouterOutlet /> inside the parent component.
 * Uses the router from context.
 */
export const RouterOutlet = cc<RouterOutletProps>(
  ({ fallback, notFound, depth = 0 }) => {
    const router = useRouter();

    const DefaultNotFound = cc(() => <div>404 - Page not found</div>);
    const DefaultLoading = cc(() => <div>Loading...</div>);

    return (
      <Key when={() => router.path}>
        {() => {
          const matched = getMatchAtDepth(router.matched, depth);
          if (!matched) {
            // Only show 404 at the top level; nested outlets render nothing
            if (depth > 0) return null as any;
            const NF = notFound ?? DefaultNotFound;
            return <NF />;
          }

          const Comp = resolveRouteComponent(
            matched,
            router,
            fallback ?? DefaultLoading,
          );
          if (!Comp) {
            const FB = fallback ?? DefaultLoading;
            return <FB />;
          }

          return <Comp />;
        }}
      </Key>
    );
  },
);
