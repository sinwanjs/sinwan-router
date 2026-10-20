import { describe, expect, test } from "bun:test";
import { resolve } from "sinwan/reactivity";
import { createRouter } from "../src/router.ts";
import { Link, NavLink, RouterOutlet } from "../src/components.tsx";
import {
  About,
  Failed,
  Home,
  Loading,
  NotFound,
  asKey,
  asVNode,
  fakeClick,
  setupWindow,
  teardownWindow,
  waitForLazyStatus,
  withRouter,
} from "./helpers.tsx";
import type { LinkClickEvent } from "../src/link-nav.ts";

const routes = [
  { path: "/", component: Home },
  { path: "/about", component: About },
  { path: "/users/:id", component: Home },
];

function clickHandler(
  node: { props: Record<string, unknown> },
): (event: LinkClickEvent) => void {
  const handler = node.props.onclick;
  if (typeof handler !== "function") {
    throw new Error("expected onclick");
  }
  return handler as (event: LinkClickEvent) => void;
}

function mouseEnterHandler(
  node: { props: Record<string, unknown> },
): () => void {
  const handler = node.props.onmouseenter;
  if (typeof handler !== "function") {
    throw new Error("expected onmouseenter");
  }
  return handler as () => void;
}

function classOf(node: { props: Record<string, unknown> }): string {
  const value = resolve(node.props.class);
  if (typeof value !== "string") {
    throw new Error("expected class string");
  }
  return value;
}

describe("Link", () => {
  test("renders an anchor with href and class", () => {
    const router = createRouter(routes, "/");
    const result = asVNode(
      withRouter(router, () =>
        Link({ href: "/about", class: "nav-link", children: "About" }),
      ),
    );
    expect(result.tag).toBe("a");
    expect(result.props.href).toBe("/about");
    expect(result.props.class).toBe("nav-link");
  });

  test("does not navigate when defaultPrevented is already true", () => {
    const router = createRouter(routes, "/");
    const result = asVNode(
      withRouter(router, () => Link({ href: "/about", children: "About" })),
    );
    clickHandler(result)(fakeClick({ defaultPrevented: true }));
    expect(router.path).toBe("/");
  });

  test("does not navigate for modifier keys, middle click, or alt", () => {
    const router = createRouter(routes, "/");
    const result = asVNode(
      withRouter(router, () => Link({ href: "/about", children: "About" })),
    );
    const onclick = clickHandler(result);
    onclick(fakeClick({ ctrlKey: true }));
    onclick(fakeClick({ metaKey: true }));
    onclick(fakeClick({ shiftKey: true }));
    onclick(fakeClick({ altKey: true }));
    onclick(fakeClick({ button: 1 }));
    expect(router.path).toBe("/");
  });

  test("click navigates to href", () => {
    const router = createRouter(routes, "/");
    const result = asVNode(
      withRouter(router, () => Link({ href: "/about", children: "About" })),
    );
    clickHandler(result)(fakeClick());
    expect(router.path).toBe("/about");
  });

  test("does not intercept target=_blank, download, or external hrefs", () => {
    const router = createRouter(routes, "/");
    withRouter(router, () => {
      clickHandler(
        asVNode(Link({ href: "/about", target: "_blank", children: "x" })),
      )(fakeClick());
      clickHandler(
        asVNode(Link({ href: "/about", download: true, children: "x" })),
      )(fakeClick());
      const named = asVNode(
        Link({
          href: "/about",
          download: "a.txt",
          rel: "noreferrer",
          children: "x",
        }),
      );
      expect(named.props.download).toBe("a.txt");
      expect(named.props.rel).toBe("noreferrer");
      clickHandler(named)(fakeClick());
      clickHandler(
        asVNode(Link({ href: "https://example.com", children: "x" })),
      )(fakeClick());
    });
    expect(router.path).toBe("/");
  });

  test("omits the download attribute when download is false", () => {
    const router = createRouter(routes, "/");
    const result = asVNode(
      withRouter(router, () =>
        Link({ href: "/file", download: false, children: "x" }),
      ),
    );
    expect(result.props.download).toBeUndefined();
  });

  test("passes download=true as an empty string attribute", () => {
    const router = createRouter(routes, "/");
    const result = asVNode(
      withRouter(router, () =>
        Link({ href: "/file", download: true, children: "x" }),
      ),
    );
    expect(result.props.download).toBe("");
  });

  test("mouseenter prefetches when enabled and skips when disabled", () => {
    setupWindow();
    try {
      const router = createRouter(
        [{ path: "/about", component: () => Promise.resolve({ default: About }) }],
        "/",
      );
      const on = asVNode(
        withRouter(router, () =>
          Link({ href: "/about", prefetch: true, children: "x" }),
        ),
      );
      mouseEnterHandler(on)();
      expect(
        router.peekLazy("/about").status === "loading" ||
          router.peekLazy("/about").status === "ready",
      ).toBe(true);

      let called = false;
      router.prefetch = () => {
        called = true;
      };
      const off = asVNode(
        withRouter(router, () =>
          Link({ href: "/about", prefetch: false, children: "x" }),
        ),
      );
      mouseEnterHandler(off)();
      expect(called).toBe(false);
    } finally {
      teardownWindow();
    }
  });

  test("forwards Slot passthrough props and composes mouseenter", () => {
    setupWindow();
    try {
      const router = createRouter(
        [{ path: "/about", component: () => Promise.resolve({ default: About }) }],
        "/",
      );
      let tipOpen = false;
      let leaveCount = 0;
      const node = asVNode(
        withRouter(router, () =>
          Link({
            href: "/about",
            prefetch: true,
            "data-slot": "sidebar-menu-button",
            "data-sidebar": "menu-button",
            onmouseenter: () => {
              tipOpen = true;
            },
            onmouseleave: () => {
              leaveCount += 1;
            },
            ref: () => {},
            children: "About",
          }),
        ),
      );
      expect(node.props["data-slot"]).toBe("sidebar-menu-button");
      expect(node.props["data-sidebar"]).toBe("menu-button");
      expect(typeof node.props.ref).toBe("function");
      expect(typeof node.props.onmouseleave).toBe("function");
      mouseEnterHandler(node)();
      expect(tipOpen).toBe(true);
      expect(
        router.peekLazy("/about").status === "loading" ||
          router.peekLazy("/about").status === "ready",
      ).toBe(true);
      const leave = node.props.onmouseleave;
      if (typeof leave !== "function") throw new Error("expected onmouseleave");
      leave();
      expect(leaveCount).toBe(1);
    } finally {
      teardownWindow();
    }
  });
});

describe("NavLink", () => {
  test("resolves class from an isActive callback", () => {
    const exact = asVNode(
      withRouter(createRouter(routes, "/about"), () =>
        NavLink({
          href: "/about",
          class: ({ isActive }) => (isActive ? "nav current" : "nav"),
          children: "About",
        }),
      ),
    );
    expect(classOf(exact)).toBe("nav current");

    const nested = asVNode(
      withRouter(createRouter(routes, "/users/42"), () =>
        NavLink({ href: "/users", children: "Users" }),
      ),
    );
    expect(classOf(nested)).toContain("active");

    const idle = asVNode(
      withRouter(createRouter(routes, "/"), () =>
        NavLink({
          href: "/about",
          class: ({ isActive }) => (isActive ? "nav current" : "nav"),
          children: "About",
        }),
      ),
    );
    expect(classOf(idle)).toBe("nav");
  });

  test("keeps a static class string", () => {
    const node = asVNode(
      withRouter(createRouter(routes, "/about"), () =>
        NavLink({ href: "/about", class: "nav-item", children: "About" }),
      ),
    );
    expect(classOf(node)).toBe("nav-item");
  });

  test("click and prefetch behave like Link", () => {
    const router = createRouter(routes, "/");
    const node = asVNode(
      withRouter(router, () => NavLink({ href: "/about", children: "About" })),
    );
    clickHandler(node)(fakeClick({ ctrlKey: true }));
    expect(router.path).toBe("/");
    clickHandler(node)(fakeClick());
    expect(router.path).toBe("/about");

    setupWindow();
    try {
      const lazyRouter = createRouter(
        [{ path: "/about", component: () => Promise.resolve({ default: About }) }],
        "/",
      );
      const hover = asVNode(
        withRouter(lazyRouter, () =>
          NavLink({ href: "/about", prefetch: true, children: "x" }),
        ),
      );
      mouseEnterHandler(hover)();
      expect(
        lazyRouter.peekLazy("/about").status === "loading" ||
          lazyRouter.peekLazy("/about").status === "ready",
      ).toBe(true);
    } finally {
      teardownWindow();
    }

    setupWindow();
    try {
      const lazyRouter = createRouter(
        [{ path: "/about", component: () => Promise.resolve({ default: About }) }],
        "/",
      );
      const off = asVNode(
        withRouter(lazyRouter, () =>
          NavLink({
            href: "/about",
            prefetch: false,
            target: "_blank",
            children: "x",
          }),
        ),
      );
      mouseEnterHandler(off)();
      clickHandler(off)(fakeClick());
      expect(lazyRouter.peekLazy("/about").status).toBe("idle");
      expect(lazyRouter.path).toBe("/");
    } finally {
      teardownWindow();
    }
  });

  test("forwards Slot passthrough props onto the anchor", () => {
    const router = createRouter(routes, "/");
    let tipOpen = false;
    const node = asVNode(
      withRouter(router, () =>
        NavLink({
          href: "/about",
          class: ({ isActive }) => (isActive ? "current" : undefined),
          "data-slot": "sidebar-menu-button",
          onmouseenter: () => {
            tipOpen = true;
          },
          onmouseleave: () => {},
          children: "About",
        }),
      ),
    );
    expect(node.props["data-slot"]).toBe("sidebar-menu-button");
    expect(typeof node.props.class === "function" || typeof node.props.class === "object").toBe(
      true,
    );
    mouseEnterHandler(node)();
    expect(tipOpen).toBe(true);
  });
});

describe("RouterOutlet", () => {
  test("renders a Key block whose when() tracks the route identity", () => {
    const router = createRouter(routes, "/");
    const node = asKey(withRouter(router, () => RouterOutlet({})));
    expect(node.props.when()).toContain("/");
  });

  test("renders the matched static component", () => {
    const router = createRouter(routes, "/");
    const child = withRouter(router, () => asKey(RouterOutlet({})).props.children());
    expect(child?.tag).toBe(Home);
    if (child && typeof child.tag === "function") {
      (child.tag as () => unknown)();
    }
  });

  test("renders notFound and the default 404", () => {
    const router = createRouter(routes, "/missing");
    const custom = withRouter(router, () =>
      asKey(RouterOutlet({ notFound: NotFound })).props.children(),
    );
    expect(custom?.tag).toBe(NotFound);
    if (custom && typeof custom.tag === "function") {
      (custom.tag as () => unknown)();
    }

    const fallback404 = withRouter(router, () =>
      asKey(RouterOutlet({})).props.children(),
    );
    expect(fallback404?.tag).toBeDefined();
    if (fallback404 && typeof fallback404.tag === "function") {
      const tree = withRouter(router, () =>
        (fallback404.tag as () => {
          props?: {
            role?: string;
            style?: Record<string, unknown>;
            children?: unknown;
          };
        })(),
      );
      expect(tree.props?.role).toBe("main");
      expect(tree.props?.style).toBeDefined();
      const serialized = JSON.stringify(tree);
      expect(serialized).toContain("Page not found");
      expect(serialized).toContain("Back to home");
      expect(serialized).toContain("/");
      const pathText = (node: unknown): string | undefined => {
        if (typeof node === "function") {
          const value = (node as () => unknown)();
          return typeof value === "string" ? value : undefined;
        }
        if (node == null || typeof node !== "object") return undefined;
        if (Array.isArray(node)) {
          for (const item of node) {
            const found = pathText(item);
            if (found !== undefined) return found;
          }
          return undefined;
        }
        const record = node as {
          tag?: unknown;
          children?: unknown;
          props?: { children?: unknown };
        };
        if (record.tag === "code") {
          return pathText(record.children ?? record.props?.children);
        }
        return (
          pathText(record.children) ??
          pathText(record.props?.children)
        );
      };
      expect(pathText(tree)).toBe("/missing");
    }
  });

  test("nested outlets render nothing when depth has no match", () => {
    const router = createRouter(routes, "/");
    const child = withRouter(router, () =>
      asKey(RouterOutlet({ depth: 1 })).props.children(),
    );
    expect(child).toBeNull();
  });

  test("shows fallback while lazy, then the loaded component after ensureLazy", async () => {
    const loader = () => Promise.resolve({ default: About });
    const router = createRouter([{ path: "/lazy", component: loader }], "/lazy");
    const loading = withRouter(router, () =>
      asKey(RouterOutlet({ fallback: Loading })).props.children(),
    );
    expect(loading?.tag).toBe(Loading);

    await router.resolveComponent(router.routes[0]!);
    const ready = withRouter(router, () =>
      asKey(RouterOutlet({ fallback: Loading })).props.children(),
    );
    expect(ready?.tag).toBe(About);
  });

  test("shows default loading when lazy and no fallback is passed", () => {
    const router = createRouter(
      [{ path: "/lazy", component: () => Promise.resolve({ default: About }) }],
      "/lazy",
    );
    const loading = withRouter(router, () =>
      asKey(RouterOutlet({})).props.children(),
    );
    expect(loading?.tag).toBeDefined();
    if (loading && typeof loading.tag === "function") {
      (loading.tag as () => unknown)();
    }
  });

  test("shows error UI when the lazy import rejects", async () => {
    const boom = () => Promise.reject(new Error("load-fail"));
    const router = createRouter([{ path: "/boom", component: boom }], "/boom");
    withRouter(router, () => asKey(RouterOutlet({ error: Failed })).props.children());
    await waitForLazyStatus(router, "/boom", "error");
    const errNode = withRouter(router, () =>
      asKey(RouterOutlet({ error: Failed })).props.children(),
    );
    expect(errNode?.tag).toBe(Failed);
    if (errNode && typeof errNode.tag === "function") {
      (errNode.tag as (props: { error?: unknown }) => unknown)({
        error: new Error("load-fail"),
      });
    }

    const defaultErr = withRouter(router, () =>
      asKey(RouterOutlet({})).props.children(),
    );
    expect(defaultErr?.tag).toBeDefined();
    if (defaultErr && typeof defaultErr.tag === "function") {
      (defaultErr.tag as (props: { error?: unknown }) => unknown)({
        error: new Error("load-fail"),
      });
    }
  });

  test("prefetch fills the same cache the outlet reads", async () => {
    setupWindow();
    try {
      const loader = () => Promise.resolve({ default: About });
      const router = createRouter([{ path: "/lazy", component: loader }], "/");
      router.prefetch("/lazy");
      await Promise.resolve();
      await Promise.resolve();
      router.navigate("/lazy");
      const ready = withRouter(router, () =>
        asKey(RouterOutlet({ fallback: Loading })).props.children(),
      );
      expect(ready?.tag).toBe(About);
    } finally {
      teardownWindow();
    }
  });
});
