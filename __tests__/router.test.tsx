import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { createRouter, Router, isLazyComponent } from "../src/router.ts";
import type { RouteDefinition } from "../src/types.ts";
import { cc } from "sinwan/component";

// ─── Test components ───────────────────────────────────────

const Home = cc(() => <div>Home</div>);
const About = cc(() => <div>About</div>);
const UserProfile = cc<{ id: string }>(({ id }) => <div>User {id}</div>);

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
  test("returns true for lazy components (function without _SinwanComponent)", () => {
    expect(isLazyComponent(lazyComponent)).toBe(true);
  });

  test("returns false for static components (cc components)", () => {
    expect(isLazyComponent(staticComponent)).toBe(false);
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

const routes: RouteDefinition[] = [
  { path: "/", component: Home },
  { path: "/about", component: About },
  { path: "/users/:id", component: UserProfile },
];
