/**
 * Sinwan Router — Components
 *
 * Link, NavLink, and RouterOutlet that use useRouter() internally.
 * The router instance must be provided via provide(RouterKey, router).
 */

import { cc, getRawProps } from "sinwan/component";
import { Key } from "sinwan/control-flow";
import type { SinwanComponent, SinwanNode } from "sinwan/component";
import { computed } from "sinwan/reactivity";
import { useRouter } from "./hooks.ts";
import { isLazyComponent } from "./router.ts";
import type { Router } from "./router.ts";
import type { MatchedRoute } from "./types.ts";
import {
  shouldInterceptLinkClick,
  type LinkInterceptOptions,
} from "./link-nav.ts";
import { computeOutletKey, getMatchAtDepth } from "./outlet.ts";

// ─── Link ──────────────────────────────────────────────────

/**
 * Anchor props for client navigation. Extra keys (data-*, aria-*, ref,
 * mouse/focus handlers) are forwarded so Slot / asChild parents can merge
 * onto the real `<a>` (e.g. SidebarMenuButton tooltip).
 */
export type LinkProps = {
  href: string;
  prefetch?: boolean;
  class?: string;
  children?: SinwanNode;
  target?: string;
  download?: string | boolean;
  rel?: string;
  onclick?: (event: MouseEvent) => void;
  onmouseenter?: (event: MouseEvent) => void;
} & Record<string, unknown>;

const LINK_OWN_KEYS = new Set([
  "href",
  "prefetch",
  "class",
  "children",
  "target",
  "download",
  "rel",
  "onclick",
  "onmouseenter",
]);

function linkPassthrough(
  props: LinkProps,
): Record<string, unknown> {
  const raw = getRawProps(props) as Record<string, unknown>;
  const rest: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) {
    if (!LINK_OWN_KEYS.has(key)) rest[key] = raw[key];
  }
  return rest;
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
export const Link = cc<LinkProps>((props) => {
  const {
    href,
    prefetch = true,
    class: cls,
    children,
    target,
    download,
    rel,
    onclick,
    onmouseenter,
  } = props;
  const router = useRouter();
  const rest = linkPassthrough(props);
  return (
    <a
      {...rest}
      href={href}
      class={cls}
      target={target}
      download={downloadAttr(download)}
      rel={rel}
      onclick={(e: MouseEvent) => {
        onLinkClick(e, href, router, { target, download });
        onclick?.(e);
      }}
      onmouseenter={(e: MouseEvent) => {
        if (prefetch) router.prefetch(href);
        onmouseenter?.(e);
      }}
    >
      {children}
    </a>
  );
});

// ─── NavLink ───────────────────────────────────────────────

export type NavLinkClassOptions = {
  isActive: boolean;
};

export type NavLinkClassFunction = (
  options: NavLinkClassOptions,
) => string | false | null | undefined;

export type NavLinkProps = {
  href: string;
  prefetch?: boolean;
  /**
   * Static class string, or a callback that receives `{ isActive }` so
   * active/inactive styles never share conflicting Tailwind utilities.
   * When omitted, active links get the class `"active"` (CSS templates).
   */
  class?: string | NavLinkClassFunction;
  children?: SinwanNode;
  target?: string;
  download?: string | boolean;
  rel?: string;
  onclick?: (event: MouseEvent) => void;
  onmouseenter?: (event: MouseEvent) => void;
} & Record<string, unknown>;

function isNavLinkActive(path: string, href: string): boolean {
  return path === href || path.startsWith(href + "/");
}

function resolveNavLinkClass(
  cls: string | NavLinkClassFunction | undefined,
  isActive: boolean,
): string {
  if (typeof cls === "function") {
    return (cls({ isActive }) || "").trim();
  }
  if (cls != null && cls !== "") {
    return cls;
  }
  return isActive ? "active" : "";
}

/**
 * NavLink — Link with active state styling.
 * Uses the router from context.
 */
export const NavLink = cc<NavLinkProps>((props) => {
  const {
    href,
    prefetch = true,
    class: cls,
    children,
    target,
    download,
    rel,
    onclick,
    onmouseenter,
  } = props;
  const router = useRouter();
  const rest = linkPassthrough(props as LinkProps);
  const className = computed(() =>
    resolveNavLinkClass(
      cls,
      isNavLinkActive(router.path, href),
    ),
  );

  return (
    <a
      {...rest}
      href={href}
      class={className}
      target={target}
      download={downloadAttr(download)}
      rel={rel}
      onclick={(e: MouseEvent) => {
        onLinkClick(e, href, router, { target, download });
        onclick?.(e);
      }}
      onmouseenter={(e: MouseEvent) => {
        if (prefetch) router.prefetch(href);
        onmouseenter?.(e);
      }}
    >
      {children}
    </a>
  );
});

// ─── RouterOutlet ──────────────────────────────────────────

export interface RouterOutletProps {
  fallback?: SinwanComponent;
  notFound?: SinwanComponent;
  error?: SinwanComponent<{ error?: unknown }>;
  /** Depth of this outlet (0 = top-level, 1 = nested in parent route). */
  depth?: number;
}

/** Credit Blue palette (sinwan-ui default) — inline so the router needs no CSS import. */
const creditBlue = {
  background: "oklch(0.98 0.004 250)",
  foreground: "oklch(0.18 0.03 255)",
  primary: "oklch(0.55 0.22 262)",
  primaryForeground: "oklch(0.98 0.01 250)",
  secondary: "oklch(0.9 0.04 262)",
  secondaryForeground: "oklch(0.3 0.09 262)",
  tertiary: "oklch(0.72 0.14 230)",
  muted: "oklch(0.96 0.006 250)",
  mutedForeground: "oklch(0.5 0.02 255)",
  card: "oklch(1 0 0)",
  border: "oklch(0.9 0.01 255)",
  radius: "0.625rem",
  ambientBackground: [
    "radial-gradient(110% 85% at 0% 0%, oklch(0.72 0.14 230 / 0.08), transparent 60%)",
    "radial-gradient(110% 85% at 100% 0%, oklch(0.55 0.22 262 / 0.07), transparent 60%)",
    "radial-gradient(110% 85% at 100% 100%, oklch(0.72 0.14 230 / 0.08), transparent 60%)",
    "radial-gradient(110% 85% at 0% 100%, oklch(0.55 0.22 262 / 0.06), transparent 60%)",
    "oklch(0.98 0.004 250)",
  ].join(", "),
  brandGradient:
    "linear-gradient(150deg, oklch(0.72 0.14 230) 10%, oklch(0.55 0.22 262) 100%)",
} as const;

const defaultNotFoundShellStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "2.5rem 1.25rem",
  boxSizing: "border-box",
  background: creditBlue.ambientBackground,
  color: creditBlue.foreground,
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
} as const;

const defaultNotFoundCardStyle = {
  maxWidth: "28rem",
  width: "100%",
  textAlign: "center",
  padding: "2.25rem 1.75rem",
  borderRadius: "calc(0.625rem * 1.4)",
  background: creditBlue.card,
  border: `1px solid ${creditBlue.border}`,
  boxShadow: "0 18px 50px oklch(0.55 0.22 262 / 0.08)",
} as const;

const defaultNotFoundCodeStyle = {
  display: "inline-block",
  margin: "0 0.15em",
  padding: "0.12em 0.4em",
  borderRadius: "calc(0.625rem * 0.6)",
  background: creditBlue.muted,
  color: creditBlue.secondaryForeground,
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  fontSize: "0.88em",
  wordBreak: "break-all",
} as const;

const defaultNotFoundLinkStyle = {
  display: "inline-block",
  padding: "0.65rem 1.2rem",
  borderRadius: creditBlue.radius,
  background: creditBlue.brandGradient,
  color: creditBlue.primaryForeground,
  textDecoration: "none",
  fontSize: "0.9rem",
  fontWeight: 600,
  letterSpacing: "0.01em",
  boxShadow: "0 8px 20px oklch(0.55 0.22 262 / 0.28)",
} as const;

/** Built-in 404 when `notFound` is omitted from `RouterOutlet` / `Routes`. */
const DefaultNotFound = cc(() => {
  const router = useRouter();
  return (
    <div
      role="main"
      aria-labelledby="sinwan-router-not-found-title"
      style={defaultNotFoundShellStyle}
    >
      <div style={defaultNotFoundCardStyle}>
        <p
          aria-hidden="true"
          style={{
            margin: "0 0 0.85rem",
            fontSize: "clamp(3.5rem, 12vw, 5rem)",
            fontWeight: 700,
            letterSpacing: "-0.06em",
            lineHeight: 1,
            background: creditBlue.brandGradient,
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            color: "transparent",
          }}
        >
          404
        </p>
        <h1
          id="sinwan-router-not-found-title"
          style={{
            margin: "0 0 0.75rem",
            fontSize: "1.5rem",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: creditBlue.foreground,
          }}
        >
          Page not found
        </h1>
        <p
          style={{
            margin: "0 0 1.75rem",
            fontSize: "0.95rem",
            lineHeight: 1.55,
            color: creditBlue.mutedForeground,
          }}
        >
          No route matches{" "}
          <code style={defaultNotFoundCodeStyle}>{() => router.path}</code>
          .
        </p>
        <Link href="/" style={defaultNotFoundLinkStyle}>
          Back to home
        </Link>
      </div>
    </div>
  );
});

const defaultStatusShellStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "2rem 1.25rem",
  boxSizing: "border-box",
  background: creditBlue.ambientBackground,
  color: creditBlue.foreground,
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
} as const;

const defaultStatusCardStyle = {
  padding: "1.25rem 1.5rem",
  borderRadius: creditBlue.radius,
  background: creditBlue.card,
  border: `1px solid ${creditBlue.border}`,
  color: creditBlue.secondaryForeground,
  fontSize: "0.95rem",
  fontWeight: 500,
  boxShadow: "0 12px 32px oklch(0.55 0.22 262 / 0.06)",
} as const;

const DefaultLoading = cc(() => (
  <div role="status" aria-live="polite" style={defaultStatusShellStyle}>
    <div style={defaultStatusCardStyle}>Loading...</div>
  </div>
));

const DefaultError = cc<{ error?: unknown }>(() => (
  <div role="alert" style={defaultStatusShellStyle}>
    <div
      style={{
        ...defaultStatusCardStyle,
        borderColor: "oklch(0.55 0.22 262 / 0.35)",
        color: creditBlue.foreground,
      }}
    >
      Failed to load page
    </div>
  </div>
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

    // Arity ≥ 1: Key remount render-prop (not a reactive SinwanNode getter).
    // Zero-arity `() =>` remounts the layout on every `matched` change.
    return (
      <Key when={() => computeOutletKey(router, depth)}>
        {(_identity) => {
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
