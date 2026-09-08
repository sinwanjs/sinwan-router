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
import type { Router } from "./router.ts";
import type { MatchedRoute } from "./types.ts";
import {
  jsxClass,
  shouldInterceptLinkClick,
  type LinkInterceptOptions,
} from "./link-nav.ts";
import { computeOutletKey, getMatchAtDepth } from "./outlet.ts";

// ─── Link ──────────────────────────────────────────────────

export interface LinkProps {
  href: string;
  prefetch?: boolean;
  class?: string;
  children?: SinwanNode;
  target?: string;
  download?: string | boolean;
  rel?: string;
}

function onLinkClick(
  event: MouseEvent,
  href: string,
  router: Router,
  options: LinkInterceptOptions,
): void {
  if (!shouldInterceptLinkClick(event, href, router.path, options)) return;
  event.preventDefault();
  router.navigate(href);
}

function downloadAttr(
  download: string | boolean | undefined,
): string | undefined {
  if (download === undefined || download === false) return undefined;
  if (download === true) return "";
  return download;
}

/**
 * Link — client-side navigation anchor.
 * Uses the router from context (provide(RouterKey, router)).
 */
export const Link = cc<LinkProps>(
  ({
    href,
    prefetch = true,
    class: cls,
    children,
    target,
    download,
    rel,
  }) => {
    const router = useRouter();
    return (
      <a
        href={href}
        class={cls}
        target={target}
        download={downloadAttr(download)}
        rel={rel}
        onclick={(e: MouseEvent) => {
          onLinkClick(e, href, router, { target, download });
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
  ({
    href,
    prefetch = true,
    activeClass = "active",
    class: cls,
    children,
    target,
    download,
    rel,
  }) => {
    const router = useRouter();
    const className = computed(() =>
      router.path === href || router.path.startsWith(href + "/")
        ? `${cls ?? ""} ${activeClass}`.trim()
        : (cls ?? ""),
    );

    return (
      <a
        href={href}
        class={jsxClass(() => className.value)}
        target={target}
        download={downloadAttr(download)}
        rel={rel}
        onclick={(e: MouseEvent) => {
          onLinkClick(e, href, router, { target, download });
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
  error?: SinwanComponent<{ error?: unknown }>;
  /** Depth of this outlet (0 = top-level, 1 = nested in parent route). */
  depth?: number;
}

const DefaultNotFound = cc(() => <div>404 - Page not found</div>);
const DefaultLoading = cc(() => <div>Loading...</div>);
const DefaultError = cc<{ error?: unknown }>(() => (
  <div>Failed to load page</div>
));

function resolveOutletNode(
  matched: MatchedRoute,
  router: Router,
  fallback: SinwanComponent,
  errorComp: SinwanComponent<{ error?: unknown }>,
): SinwanNode {
  const route = matched.route;
  if (!isLazyComponent(route.component)) {
    const Comp = route.component;
    return <Comp />;
  }

  const cacheKey = matched.matchedPath;
  const state = router.peekLazy(cacheKey);
  if (state.status === "ready") {
    const Comp = state.component;
    return <Comp />;
  }
  if (state.status === "error") {
    const ErrorView = errorComp;
    return <ErrorView error={state.error} />;
  }

  router.ensureLazy(cacheKey, route.component);
  const Fallback = fallback;
  return <Fallback />;
}

/**
 * RouterOutlet — renders the matched route's component at a given depth.
 * For nested routes, place a <RouterOutlet /> inside the parent component.
 * Uses the router from context.
 */
export const RouterOutlet = cc<RouterOutletProps>(
  ({ fallback, notFound, error, depth = 0 }) => {
    const router = useRouter();
    const Fallback = fallback ?? DefaultLoading;
    const NotFound = notFound ?? DefaultNotFound;
    const ErrorView = error ?? DefaultError;

    return (
      <Key when={() => computeOutletKey(router, depth)}>
        {() => {
          const matched = getMatchAtDepth(router.matched, depth);
          if (!matched) {
            if (depth > 0) return null;
            return <NotFound />;
          }
          return resolveOutletNode(matched, router, Fallback, ErrorView);
        }}
      </Key>
    );
  },
);
