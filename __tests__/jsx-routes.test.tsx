import { describe, expect, test } from "bun:test";
import {
  createComponentInstance,
  getCurrentInstance,
  setCurrentInstance,
  inject,
} from "sinwan/component";
import { cc } from "sinwan/component";
import {
  Route,
  Routes,
  collectRouteDefinitions,
  isRouteElement,
  layoutNodes,
  ROUTE_TYPE,
} from "../src/jsx-routes.tsx";
import { RouterOutlet } from "../src/components.tsx";
import { RouterKey, useRouter } from "../src/hooks.ts";
import { About, Failed, Home, Loading, NotFound, asKey, asVNode } from "./helpers.tsx";
import type { RouteDefinition } from "../src/types.ts";

const Layout = cc(() => <div>Layout</div>);

function withSetup<T>(run: () => T): T {
  const prev = getCurrentInstance();
  const inst = createComponentInstance(Routes, {}, null);
  setCurrentInstance(inst);
  try {
    return run();
  } finally {
    setCurrentInstance(prev);
  }
}

describe("isRouteElement", () => {
  test("recognizes Route() markers and JSX Route tags", () => {
    expect(isRouteElement(Route({ path: "/", component: Home }))).toBe(true);
    expect(isRouteElement({ tag: Route, props: { path: "/", component: Home }, children: [] })).toBe(
      true,
    );
    expect(isRouteElement({ tag: "div", props: {}, children: [] })).toBe(false);
    expect(isRouteElement(null)).toBe(false);
    expect(isRouteElement("x")).toBe(false);
  });
});

describe("collectRouteDefinitions", () => {
  test("collects JSX Route elements with native RouteDefinition fields", () => {
    const defs = collectRouteDefinitions(
      <>
        <Route path="/" component={Home} meta={{ title: "Home" }} />
        <Route path="/about" component={About} />
      </>,
    );
    expect(defs).toEqual([
      { path: "/", component: Home, meta: { title: "Home" } },
      { path: "/about", component: About },
    ]);
  });

  test("collects nested Route children into RouteDefinition.children", () => {
    const defs = collectRouteDefinitions(
      <Route path="/app" component={Layout} meta={{ area: "app" }}>
        <Route path="/" component={Home} />
        <Route path="settings" component={About} />
      </Route>,
    );
    expect(defs).toHaveLength(1);
    expect(defs[0]!.path).toBe("/app");
    expect(defs[0]!.component).toBe(Layout);
    expect(defs[0]!.meta).toEqual({ area: "app" });
    expect(defs[0]!.children).toEqual([
      { path: "/", component: Home },
      { path: "settings", component: About },
    ]);
  });

  test("accepts children as a RouteDefinition array", () => {
    const children: RouteDefinition[] = [
      { path: "/", component: Home },
      { path: "extra", component: About },
    ];
    const defs = collectRouteDefinitions(
      Route({ path: "/app", component: Layout, children }),
    );
    expect(defs[0]!.children).toEqual(children);
  });

  test("accepts a single RouteDefinition as children", () => {
    const child: RouteDefinition = { path: "one", component: About };
    const defs = collectRouteDefinitions(
      Route({ path: "/app", component: Layout, children: child }),
    );
    expect(defs[0]!.children).toEqual([child]);
  });

  test("accepts a raw RouteDefinition node", () => {
    const defs = collectRouteDefinitions({
      path: "/raw",
      component: Home,
      meta: { k: 1 },
      children: [{ path: "c", component: About }],
    });
    expect(defs[0]!.path).toBe("/raw");
    expect(defs[0]!.children?.[0]!.path).toBe("c");
  });

  test("omits empty children and non-object meta", () => {
    expect(
      collectRouteDefinitions({
        path: "/empty-kids",
        component: Home,
        children: [],
      }),
    ).toEqual([{ path: "/empty-kids", component: Home }]);
    expect(
      collectRouteDefinitions({
        tag: ROUTE_TYPE,
        props: { path: "/no-meta", component: Home, meta: 1 },
        children: [],
      }),
    ).toEqual([{ path: "/no-meta", component: Home }]);
    expect(
      collectRouteDefinitions(
        Route({ path: "/none", component: Layout, children: [] }),
      ),
    ).toEqual([{ path: "/none", component: Layout }]);
  });

  test("flattens nested arrays of route nodes", () => {
    const defs = collectRouteDefinitions([
      [Route({ path: "/", component: Home })],
    ]);
    expect(defs).toEqual([{ path: "/", component: Home }]);
  });

  test("skips non-route nodes, booleans, and incomplete Route elements", () => {
    const defs = collectRouteDefinitions([
      false,
      null,
      "text",
      <div>ignore</div>,
      <Route path="/" component={Home} />,
      { tag: Route, props: { path: "/" }, children: [] },
      { tag: ROUTE_TYPE, props: { component: Home }, children: [] },
    ]);
    expect(defs).toEqual([{ path: "/", component: Home }]);
  });

  test("reads fragment children from props when the child list is empty", () => {
    const defs = collectRouteDefinitions({
      tag: "",
      props: {
        children: Route({ path: "/from-props", component: About }),
      },
      children: [],
    });
    expect(defs).toEqual([{ path: "/from-props", component: About }]);
  });

  test("drops invalid entries from a mixed children array", () => {
    const defs = collectRouteDefinitions(
      Route({
        path: "/app",
        component: Layout,
        children: [
          { path: "ok", component: Home },
          { path: "nope" } as unknown as RouteDefinition,
        ],
      }),
    );
    expect(defs[0]!.children).toEqual([{ path: "ok", component: Home }]);
  });

  test("uses element.children when props.children is absent", () => {
    const defs = collectRouteDefinitions({
      tag: ROUTE_TYPE,
      props: { path: "/app", component: Layout },
      children: [Route({ path: "child", component: About })],
    });
    expect(defs[0]!.children).toEqual([{ path: "child", component: About }]);
  });

  test("returns an empty list for empty or boolean children", () => {
    expect(collectRouteDefinitions(undefined)).toEqual([]);
    expect(collectRouteDefinitions(true)).toEqual([]);
  });

  test("returns undefined nested children when the array is empty of definitions", () => {
    const defs = collectRouteDefinitions(
      Route({
        path: "/app",
        component: Layout,
        children: [{ nope: true } as unknown as RouteDefinition],
      }),
    );
    expect(defs[0]!.children).toBeUndefined();
  });
});

describe("layoutNodes", () => {
  test("keeps layout siblings and drops route markers", () => {
    const nav = <nav class="app-nav">links</nav>;
    const nodes = layoutNodes(
      <>
        {nav}
        <Route path="/" component={Home} />
        {null}
      </>,
    );
    expect(nodes).toHaveLength(1);
    expect(asVNode(nodes[0]).tag).toBe("nav");
  });

  test("returns an empty list when only routes are present", () => {
    expect(layoutNodes(<Route path="/" component={Home} />)).toEqual([]);
    expect(
      layoutNodes({ path: "/", component: Home } satisfies RouteDefinition),
    ).toEqual([]);
  });
});

describe("Routes", () => {
  test("provides a router and renders the matched route", () => {
    const child = withSetup(() => {
      Routes({
        initialPath: "/about",
        children: (
          <>
            <Route path="/" component={Home} />
            <Route path="/about" component={About} />
          </>
        ),
      });
      expect(useRouter().path).toBe("/about");
      return asKey(RouterOutlet({})).props.children();
    });
    expect(child?.tag).toBe(About);
  });

  test("passes outlet fallbacks and disposes the router", () => {
    const inst = createComponentInstance(Routes, {}, null);
    const prev = getCurrentInstance();
    setCurrentInstance(inst);
    try {
      const tree = Routes({
        initialPath: "/missing",
        notFound: NotFound,
        fallback: Loading,
        error: Failed,
        children: <Route path="/" component={Home} />,
      });
      const router = inject(RouterKey);
      expect(router).toBeDefined();
      expect(asVNode(tree).tag).toBe(RouterOutlet);
      const outlet = asKey(
        RouterOutlet({
          notFound: NotFound,
          fallback: Loading,
          error: Failed,
        }),
      );
      expect(outlet.props.children()?.tag).toBe(NotFound);
      expect(inst._disposeHooks).toHaveLength(1);
      for (const hook of inst._disposeHooks) hook();
      expect(router!.peekLazy("/").status).toBe("idle");
    } finally {
      setCurrentInstance(prev);
    }
  });

  test("renders layout siblings and keeps the outlet", () => {
    const tree = withSetup(() =>
      Routes({
        initialPath: "/",
        children: (
          <>
            <nav class="app-nav">links</nav>
            <Route path="/" component={Home} />
          </>
        ),
      }),
    );
    const vnode = asVNode(tree);
    expect(vnode.tag).toBe("");
    const rawKids = [
      ...((tree as { children?: unknown[] }).children ?? []),
      vnode.props.children,
    ].flat();
    const tags = rawKids
      .filter((node) => node != null && typeof node === "object")
      .map((node) => asVNode(node).tag);
    expect(tags).toContain("nav");
    expect(tags).toContain(RouterOutlet);
  });
});
