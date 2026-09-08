import { describe, expect, test } from "bun:test";
import { createRouter, Router, isLazyComponent, lazy } from "../src/router.ts";
import type { RouteDefinition } from "../src/types.ts";
import { cc } from "sinwan/component";
import { waitForLazyStatus } from "./helpers.tsx";

// ─── Test components ───────────────────────────────────────

const Home = cc(() => <div>Home</div>);
const About = cc(() => <div>About</div>);
const UserProfile = cc(() => <div>User</div>);

const lazyComponent = () => Promise.resolve({ default: About });
const staticComponent = Home;

// ─── Helpers ───────────────────────────────────────────────

function setupWindow() {
  const pathState = { value: "/" };
  const history = {
    pushState: (_state: unknown, _title: string, url: string) => {
      pathState.value = url;
    },
    replaceState: (_state: unknown, _title: string, url: string) => {
      pathState.value = url;
    },
  };
  (globalThis as any).window = {
    location: {
      get pathname() {
        return pathState.value.split("?")[0];
      },
      get search() {
        const q = pathState.value.indexOf("?");
        return q !== -1 ? pathState.value.slice(q) : "";
      },
    },
    history,
    addEventListener: (_event: string, _handler: () => void) => {},
    removeEventListener: (_event: string, _handler: () => void) => {},
  };
}

function teardownWindow() {
  delete (globalThis as any).window;
}

// ─── Tests ─────────────────────────────────────────────────

describe("isLazyComponent", () => {
  test("returns true for zero-arg import factories", () => {
    expect(isLazyComponent(lazyComponent)).toBe(true);
  });

  test("returns true for lazy() branded factories", () => {
    const branded = lazy(() => Promise.resolve({ default: About }));
    expect(isLazyComponent(branded)).toBe(true);
  });

  test("returns true when _SinwanLazy is set even if the function takes args", () => {
    const weird = Object.assign(
      (_unused: unknown) => Promise.resolve({ default: About }),
      { _SinwanLazy: true as const },
    );
    expect(isLazyComponent(weird)).toBe(true);
  });

  test("returns false for static cc components", () => {
    expect(isLazyComponent(staticComponent)).toBe(false);
  });

  test("returns false for functions that take props", () => {
    const plain = (_props: { id: string }) => Home;
    expect(isLazyComponent(plain)).toBe(false);
  });

  test("returns false for non-function values", () => {
    expect(isLazyComponent(null)).toBe(false);
    expect(isLazyComponent(undefined)).toBe(false);
    expect(isLazyComponent(42)).toBe(false);
    expect(isLazyComponent("hello")).toBe(false);
    expect(isLazyComponent({})).toBe(false);
  });
});

describe("Router", () => {
  const routes: RouteDefinition[] = [
    { path: "/", component: Home },
    { path: "/about", component: About },
    { path: "/users/:id", component: UserProfile },
  ];

  test("matches root route", () => {
    const router = new Router(routes, "/");
    expect(router.path).toBe("/");
    expect(router.matched?.route.path).toBe("/");
    expect(router.matched?.params).toEqual({});
  });

  test("matches literal route", () => {
    const router = new Router(routes, "/about");
    expect(router.matched?.route.path).toBe("/about");
  });

  test("matches route with params", () => {
    const router = new Router(routes, "/users/42");
    expect(router.matched?.route.path).toBe("/users/:id");
    expect(router.matched?.params).toEqual({ id: "42" });
    expect(router.params).toEqual({ id: "42" });
  });

  test("returns null for unmatched route", () => {
    const router = new Router(routes, "/nonexistent");
    expect(router.matched).toBeNull();
    expect(router.params).toEqual({});
  });

  test("exposes routes list", () => {
    const router = new Router(routes, "/");
    expect(router.routes).toHaveLength(3);
    expect(router.routes[0]!.path).toBe("/");
  });

  test("navigate updates path and params", () => {
    const router = new Router(routes, "/");
    expect(router.path).toBe("/");

    router.navigate("/users/42");
    expect(router.path).toBe("/users/42");
    expect(router.params).toEqual({ id: "42" });
  });

  test("navigate with replace option", () => {
    setupWindow();
    try {
      const router = new Router(routes, "/");
      router.navigate("/about", { replace: true });
      expect(router.path).toBe("/about");
    } finally {
      teardownWindow();
    }
  });

  test("navigate with state option", () => {
    setupWindow();
    try {
      const router = new Router(routes, "/");
      router.navigate("/about", { state: { from: "home" } });
      expect(router.path).toBe("/about");
    } finally {
      teardownWindow();
    }
  });

  test("navigate normalizes path", () => {
    const router = new Router(routes, "/");
    router.navigate("users/42");
    expect(router.path).toBe("/users/42");
  });

  test("searchParams extracts query string", () => {
    const router = new Router(routes, "/users/42?q=hello&page=2");
    expect(router.searchParams.get("q")).toBe("hello");
    expect(router.searchParams.get("page")).toBe("2");
  });

  test("navigate updates searchParams", () => {
    const router = new Router(routes, "/");
    router.navigate("/about?tab=info");
    expect(router.searchParams.get("tab")).toBe("info");
  });
});

describe("Router — nested routes", () => {
  const routes: RouteDefinition[] = [
    {
      path: "/users",
      component: Home,
      children: [
        { path: ":id", component: UserProfile },
        { path: "settings", component: About },
      ],
    },
  ];

  test("matches nested child route with params", () => {
    const router = new Router(routes, "/users/42");
    expect(router.matched?.route.path).toBe(":id");
    expect(router.matched?.params).toEqual({ id: "42" });
  });

  test("matches nested child route without params", () => {
    const router = new Router(routes, "/users/settings");
    expect(router.matched?.route.path).toBe("settings");
  });

  test("matches parent route", () => {
    const router = new Router(routes, "/users");
    expect(router.matched?.route.path).toBe("/users");
  });
});

describe("Router — lazy loading", () => {
  const routes: RouteDefinition[] = [
    { path: "/lazy", component: lazyComponent },
    { path: "/static", component: Home },
  ];

  test("resolveComponent resolves lazy component", async () => {
    const router = new Router(routes, "/");
    const comp = await router.resolveComponent(routes[0]!);
    expect(comp).toBe(About);
  });

  test("resolveComponent returns static component directly", async () => {
    const router = new Router(routes, "/");
    const comp = await router.resolveComponent(routes[1]!);
    expect(comp).toBe(Home);
  });

  test("resolveComponent caches lazy component", async () => {
    const router = new Router(routes, "/");
    const comp1 = await router.resolveComponent(routes[0]!);
    const comp2 = await router.resolveComponent(routes[0]!);
    expect(comp1).toBe(comp2);
  });

  test("prefetch does not throw for matching lazy route", () => {
    setupWindow();
    try {
      const router = new Router(routes, "/");
      expect(() => router.prefetch("/lazy")).not.toThrow();
    } finally {
      teardownWindow();
    }
  });

  test("prefetch is no-op on server (no window)", () => {
    const router = new Router(routes, "/");
    expect(() => router.prefetch("/lazy")).not.toThrow();
  });

  test("prefetch is no-op for non-matching path", () => {
    setupWindow();
    try {
      const router = new Router(routes, "/");
      expect(() => router.prefetch("/nonexistent")).not.toThrow();
    } finally {
      teardownWindow();
    }
  });

  test("prefetch is no-op for static route", () => {
    setupWindow();
    try {
      const router = new Router(routes, "/");
      expect(() => router.prefetch("/static")).not.toThrow();
    } finally {
      teardownWindow();
    }
  });
});

describe("Router — popstate listener", () => {
  test("registers popstate listener on window", () => {
    let registeredHandler: (() => void) | null = null;
    (globalThis as any).window = {
      location: { pathname: "/", search: "" },
      history: { pushState: () => {}, replaceState: () => {} },
      addEventListener: (_event: string, handler: () => void) => {
        registeredHandler = handler;
      },
      removeEventListener: () => {
        registeredHandler = null;
      },
    };

    const router = new Router(routes, "/");
    expect(registeredHandler).not.toBeNull();

    router.dispose();
    expect(registeredHandler).toBeNull();

    delete (globalThis as any).window;
  });

  test("does not register popstate on server", () => {
    delete (globalThis as any).window;
    const router = new Router(routes, "/");
    // Should not throw
    router.dispose();
  });

  test("popstate handler updates path and searchParams", () => {
    let registeredHandler: (() => void) | null = null;
    let currentPath = "/";
    let currentSearch = "";

    (globalThis as any).window = {
      location: {
        get pathname() {
          return currentPath;
        },
        get search() {
          return currentSearch;
        },
      },
      history: { pushState: () => {}, replaceState: () => {} },
      addEventListener: (_event: string, handler: () => void) => {
        registeredHandler = handler;
      },
      removeEventListener: () => {
        registeredHandler = null;
      },
    };

    const router = new Router(routes, "/");
    expect(registeredHandler).not.toBeNull();

    // Simulate popstate — change location and call handler
    currentPath = "/users/42";
    currentSearch = "?tab=info";
    registeredHandler!();

    expect(router.path).toBe("/users/42");
    expect(router.searchParams.get("tab")).toBe("info");

    router.dispose();
    delete (globalThis as any).window;
  });
});

describe("Router — getters", () => {
  test("pathSignal returns the path signal", () => {
    const router = new Router(routes, "/");
    const sig = router.pathSignal;
    expect(sig.value).toBe("/");
    sig.value = "/about";
    expect(router.path).toBe("/about");
  });

  test("matchedComputed returns the matched computed", () => {
    const router = new Router(routes, "/users/42");
    const comp = router.matchedComputed;
    expect(comp.value).not.toBeNull();
    expect(comp.value?.params).toEqual({ id: "42" });
  });
});

describe("Router — prefetch with window", () => {
  test("prefetch loads lazy component on client", async () => {
    const freshLazy = () => Promise.resolve({ default: Home });
    const lazyRoutes: RouteDefinition[] = [
      { path: "/fresh-lazy-prefetch-test", component: freshLazy },
    ];

    (globalThis as any).window = {
      location: { pathname: "/", search: "" },
      history: { pushState: () => {}, replaceState: () => {} },
      addEventListener: () => {},
      removeEventListener: () => {},
    };

    try {
      const router = new Router(lazyRoutes, "/");
      router.prefetch("/fresh-lazy-prefetch-test");
      // Wait for the async prefetch to complete
      await new Promise((resolve) => setTimeout(resolve, 10));
      // Should not throw and component should be cached
      const comp = await router.resolveComponent(lazyRoutes[0]!);
      expect(comp).toBe(Home);
    } finally {
      delete (globalThis as any).window;
    }
  });

  test("navigate with window uses history API", () => {
    let pushedUrl = "" as string;
    let replacedUrl = "" as string;

    (globalThis as any).window = {
      location: { pathname: "/", search: "" },
      history: {
        pushState: (_state: unknown, _title: string, url: string) => {
          pushedUrl = url as string;
        },
        replaceState: (_state: unknown, _title: string, url: string) => {
          replacedUrl = url as string;
        },
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    };

    try {
      const router = new Router(routes, "/");
      router.navigate("/about");
      expect(pushedUrl).toBe("/about");
      expect(router.path).toBe("/about");

      router.navigate("/users/42", { replace: true });
      expect(replacedUrl).toBe("/users/42");
      expect(router.path).toBe("/users/42");
    } finally {
      delete (globalThis as any).window;
    }
  });

  test("navigate with window and state option", () => {
    let pushedState: unknown = null;

    (globalThis as any).window = {
      location: { pathname: "/", search: "" },
      history: {
        pushState: (state: unknown, _title: string, _url: string) => {
          pushedState = state;
        },
        replaceState: () => {},
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    };

    try {
      const router = new Router(routes, "/");
      router.navigate("/about", { state: { from: "home" } });
      expect(pushedState).toEqual({ from: "home" });
    } finally {
      delete (globalThis as any).window;
    }
  });
});

describe("createRouter factory", () => {
  test("creates a Router instance", () => {
    const router = createRouter(routes, "/");
    expect(router).toBeInstanceOf(Router);
    expect(router.path).toBe("/");
  });
});

describe("Router — instance lazy cache", () => {
  test("prefetch and resolveComponent share this router's cache, not another instance", async () => {
    setupWindow();
    try {
      const loader = () => Promise.resolve({ default: About });
      const a = new Router([{ path: "/lazy", component: loader }], "/");
      const b = new Router([{ path: "/lazy", component: loader }], "/");
      a.prefetch("/lazy");
      await Promise.resolve();
      await Promise.resolve();
      expect(a.peekLazy("/lazy").status).toBe("ready");
      expect(b.peekLazy("/lazy").status).toBe("idle");
      const comp = await a.resolveComponent(a.routes[0]!);
      expect(comp).toBe(About);
    } finally {
      teardownWindow();
    }
  });

  test("dispose clears the lazy cache", async () => {
    setupWindow();
    try {
      const loader = () => Promise.resolve({ default: About });
      const router = new Router([{ path: "/lazy", component: loader }], "/");
      router.prefetch("/lazy");
      await Promise.resolve();
      await Promise.resolve();
      expect(router.peekLazy("/lazy").status).toBe("ready");
      router.dispose();
      expect(router.peekLazy("/lazy").status).toBe("idle");
    } finally {
      teardownWindow();
    }
  });

  test("ensureLazy is a no-op while loading, ready, or in error", async () => {
    let resolveMod: ((value: { default: typeof About }) => void) | undefined;
    const loader = () =>
      new Promise<{ default: typeof About }>((resolve) => {
        resolveMod = resolve;
      });
    const router = new Router([{ path: "/lazy", component: loader }], "/lazy");
    router.ensureLazy("/lazy", loader);
    router.ensureLazy("/lazy", loader);
    expect(router.peekLazy("/lazy").status).toBe("loading");
    resolveMod!({ default: About });
    await Promise.resolve();
    await Promise.resolve();
    expect(router.peekLazy("/lazy").status).toBe("ready");
    router.ensureLazy("/lazy", loader);
    expect(router.peekLazy("/lazy").status).toBe("ready");
  });

  test("failed lazy loads surface as error and do not auto-retry from ensureLazy", async () => {
    const boom = () => Promise.reject(new Error("nope"));
    const router = new Router([{ path: "/boom", component: boom }], "/boom");
    router.ensureLazy("/boom", boom);
    await waitForLazyStatus(router, "/boom", "error");
    router.ensureLazy("/boom", boom);
    expect(router.peekLazy("/boom").status).toBe("error");
  });

  test("prefetch retries after an error", async () => {
    setupWindow();
    try {
      let n = 0;
      const flaky = () => {
        n += 1;
        if (n === 1) return Promise.reject(new Error("once"));
        return Promise.resolve({ default: About });
      };
      const router = new Router([{ path: "/flaky", component: flaky }], "/");
      router.prefetch("/flaky");
      await waitForLazyStatus(router, "/flaky", "error");
      router.prefetch("/flaky");
      await waitForLazyStatus(router, "/flaky", "ready");
    } finally {
      teardownWindow();
    }
  });

  test("prefetch skips when already ready", async () => {
    setupWindow();
    try {
      let calls = 0;
      const loader = () => {
        calls += 1;
        return Promise.resolve({ default: About });
      };
      const router = new Router([{ path: "/lazy", component: loader }], "/");
      router.prefetch("/lazy");
      await Promise.resolve();
      await Promise.resolve();
      router.prefetch("/lazy");
      expect(calls).toBe(1);
    } finally {
      teardownWindow();
    }
  });

  test("resolveComponent uses the tree pattern, then falls back to route.path", async () => {
    const nested = lazy(() => Promise.resolve({ default: About }));
    const router = new Router(
      [
        {
          path: "/users",
          component: Home,
          children: [{ path: ":id", component: nested }],
        },
      ],
      "/",
    );
    const child = router.routes[1]!;
    const fromTree = await router.resolveComponent(child);
    expect(fromTree).toBe(About);

    const orphan = {
      path: "/orphan",
      component: lazy(() => Promise.resolve({ default: Home })),
    };
    const fromPath = await router.resolveComponent(orphan);
    expect(fromPath).toBe(Home);
  });

  test("resolveComponent walks wildcard nodes", async () => {
    const files = lazy(() => Promise.resolve({ default: About }));
    const router = new Router([{ path: "/files/*path", component: files }], "/");
    const comp = await router.resolveComponent(router.routes[0]!);
    expect(comp).toBe(About);
  });

  test("awaiting an in-flight resolveComponent reuses the same promise", async () => {
    let resolveMod: ((value: { default: typeof About }) => void) | undefined;
    const loader = () =>
      new Promise<{ default: typeof About }>((resolve) => {
        resolveMod = resolve;
      });
    const router = new Router([{ path: "/lazy", component: loader }], "/");
    const first = router.resolveComponent(router.routes[0]!);
    const second = router.resolveComponent(router.routes[0]!);
    resolveMod!({ default: About });
    expect(await first).toBe(About);
    expect(await second).toBe(About);
  });

  test("nested index child joins to the parent path", () => {
    const router = new Router(
      [
        {
          path: "/app",
          component: Home,
          children: [{ path: "/", component: About }],
        },
      ],
      "/app",
    );
    expect(router.matched?.route.component).toBe(About);
  });

  test("inserts a path without a leading slash", () => {
    const router = new Router([{ path: "bare", component: Home }], "/bare");
    expect(router.matched?.route.path).toBe("bare");
  });
});


const routes: RouteDefinition[] = [
  { path: "/", component: Home },
  { path: "/about", component: About },
  { path: "/users/:id", component: UserProfile },
];
