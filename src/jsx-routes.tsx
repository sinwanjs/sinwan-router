/**
 * JSX <Routes> / <Route> — the same fields as RouteDefinition.
 */

import { cc, provide, onDispose } from "sinwan/component";
import type { SinwanComponent, SinwanElement, SinwanNode } from "sinwan/component";
import { createRouter } from "./router.ts";
import { RouterOutlet } from "./components.tsx";
import { RouterKey } from "./hooks.ts";
import type { RouteComponent, RouteDefinition } from "./types.ts";

export const ROUTE_TYPE = Symbol.for("sinwan.router.Route");

/**
 * JSX props match {@link RouteDefinition}.
 * `children` may be nested `<Route>` elements or a `RouteDefinition[]`.
 */
export type RouteProps = Omit<RouteDefinition, "children"> & {
  children?: RouteDefinition | RouteDefinition[] | SinwanNode;
};

export interface RoutesProps {
  children?: SinwanNode;
  fallback?: SinwanComponent;
  notFound?: SinwanComponent;
  error?: SinwanComponent<{ error?: unknown }>;
  initialPath?: string;
}

function isElementLike(value: unknown): value is SinwanElement {
  return value != null && typeof value === "object" && "tag" in value;
}

function routePropsRecord(props: RouteProps): Record<string, unknown> {
  const record: Record<string, unknown> = {
    path: props.path,
    component: props.component,
  };
  if (props.meta !== undefined) record.meta = props.meta;
  if (props.children !== undefined) record.children = props.children;
  return record;
}

/** Marker for a single route. Same props as `RouteDefinition`. */
export function Route(props: RouteProps): SinwanElement {
  return {
    tag: ROUTE_TYPE,
    props: routePropsRecord(props),
    children: [],
  };
}

export function isRouteElement(value: unknown): value is SinwanElement {
  if (!isElementLike(value)) return false;
  return value.tag === ROUTE_TYPE || value.tag === Route;
}

function isRouteDefinition(value: unknown): value is RouteDefinition {
  if (value == null || typeof value !== "object") return false;
  if ("tag" in value) return false;
  const rec = value as { path?: unknown; component?: unknown };
  return typeof rec.path === "string" && rec.component != null;
}

function flattenNodes(node: unknown): unknown[] {
  if (node == null || typeof node === "boolean") return [];
  if (Array.isArray(node)) {
    const out: unknown[] = [];
    for (const child of node) {
      out.push(...flattenNodes(child));
    }
    return out;
  }
  if (isElementLike(node) && node.tag === "") {
    const fromKids = flattenNodes(node.children);
    if (fromKids.length > 0) return fromKids;
    return flattenNodes(node.props.children);
  }
  return [node];
}

function nestedDefinitions(source: unknown): RouteDefinition[] | undefined {
  if (source == null) return undefined;
  if (Array.isArray(source) && source.length > 0 && isRouteDefinition(source[0])) {
    const defs: RouteDefinition[] = [];
    for (const item of source) {
      if (isRouteDefinition(item)) defs.push(item);
    }
    return defs.length > 0 ? defs : undefined;
  }
  if (isRouteDefinition(source)) return [source];
  const collected = collectRouteDefinitions(source);
  return collected.length > 0 ? collected : undefined;
}

function routeNodeToDefinition(node: unknown): RouteDefinition | null {
  if (isRouteDefinition(node)) {
    const def: RouteDefinition = {
      path: node.path,
      component: node.component,
    };
    if (node.meta) def.meta = node.meta;
    if (node.children && node.children.length > 0) def.children = node.children;
    return def;
  }
  if (!isRouteElement(node)) return null;

  const props = node.props;
  const path = props.path;
  const component = props.component;
  if (typeof path !== "string" || component == null) return null;

  const def: RouteDefinition = {
    path,
    component: component as RouteComponent,
  };
  const meta = props.meta;
  if (meta != null && typeof meta === "object") {
    def.meta = meta as Record<string, unknown>;
  }
  const nested = nestedDefinitions(props.children ?? node.children);
  if (nested) def.children = nested;
  return def;
}

/** Walk JSX children (and fragments) into native `RouteDefinition[]`. */
export function collectRouteDefinitions(children: unknown): RouteDefinition[] {
  const defs: RouteDefinition[] = [];
  for (const node of flattenNodes(children)) {
    const def = routeNodeToDefinition(node);
    if (def) defs.push(def);
  }
  return defs;
}

/** Non-route siblings (nav, layout) to render beside the outlet. */
export function layoutNodes(children: unknown): SinwanNode[] {
  const out: SinwanNode[] = [];
  for (const node of flattenNodes(children)) {
    if (isRouteElement(node) || isRouteDefinition(node)) continue;
    out.push(node as SinwanNode);
  }
  return out;
}

/**
 * Declarative JSX router. Builds a `Router` from `<Route>` children
 * (same fields as `RouteDefinition`), provides `RouterKey` to layout
 * siblings such as `<NavLink>`, and renders a `<RouterOutlet />`.
 */
export const Routes = cc<RoutesProps>(
  ({ children, fallback, notFound, error, initialPath }) => {
    const router = createRouter(collectRouteDefinitions(children), initialPath);
    provide(RouterKey, router);
    onDispose(() => {
      router.dispose();
    });
    const outlet = (
      <RouterOutlet fallback={fallback} notFound={notFound} error={error} />
    );
    const layout = layoutNodes(children);
    if (layout.length === 0) return outlet;
    return (
      <>
        {layout}
        {outlet}
      </>
    );
  },
);
