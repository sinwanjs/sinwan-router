import { afterEach, describe, expect, test } from "bun:test";
import {
  createComponentInstance,
  getCurrentInstance,
  inject,
  setCurrentInstance,
} from "sinwan/component";
import { createRouter, Router } from "../src/router.ts";
import { Route, Routes } from "../src/jsx-routes.tsx";
import { RouterKey } from "../src/hooks.ts";
import { findHashTarget, hashFromHref, nextFrame } from "../src/scroll.ts";
import type { RouteDefinition } from "../src/types.ts";
import { About, Home } from "./helpers.tsx";

type ScrollWindow = {
  scrollTo: unknown[];
  lookups: string[];
  revealed: string[];
};

/** Fake browser window that records scroll calls. Elements exist for every id except "missing". */
function setupWindow(url = "/"): ScrollWindow {
  const state = { url };
  const log: ScrollWindow = { scrollTo: [], lookups: [], revealed: [] };
  const part = (sep: string) => {
    const i = state.url.indexOf(sep);
    return i === -1 ? "" : state.url.slice(i);
  };
  Reflect.set(globalThis, "window", {
    location: {
      get pathname() {
        return state.url.split(/[?#]/)[0];
      },
      get search() {
        return part("?").split("#")[0];
      },
      get hash() {
        return part("#");
      },
    },
    history: {
      pushState: (_s: unknown, _t: string, to: string) => {
        state.url = to;
      },
      replaceState: (_s: unknown, _t: string, to: string) => {
        state.url = to;
      },
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    scrollTo: (options: unknown) => {
      log.scrollTo.push(options);
    },
    requestAnimationFrame: (cb: () => void) => setTimeout(cb, 0),
    document: {
      getElementById: (id: string) => {
        log.lookups.push(id);
        if (id === "missing") return null;
        return {
          scrollIntoView: () => {
            log.revealed.push(id);
          },
        };
      },
    },
  });
  return log;
}

/** Lets pending lazy loads and the fake animation frame run. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 5));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const routes: RouteDefinition[] = [
  { path: "/", component: Home },
  { path: "/about", component: About },
];

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
});

describe("scroll helpers", () => {
  test("hashFromHref returns the fragment without #", () => {
    expect(hashFromHref("/products#inventory")).toBe("inventory");
    expect(hashFromHref("#top")).toBe("top");
    expect(hashFromHref("/products")).toBe("");
    expect(hashFromHref("")).toBe("");
  });

  test("findHashTarget decodes the id and falls back to the raw fragment", () => {
    const ids: string[] = [];
    const doc = {
      getElementById: (id: string) => {
        ids.push(id);
        return null;
      },
    };
    expect(findHashTarget(doc, "caf%C3%A9")).toBeNull();
    expect(findHashTarget(doc, "bad%E0%A4%A")).toBeNull();
    expect(ids).toEqual(["café", "bad%E0%A4%A"]);
  });

  test("nextFrame resolves from requestAnimationFrame", async () => {
    let scheduled = false;
    await nextFrame({
      requestAnimationFrame: (cb) => {
        scheduled = true;
        cb(0);
        return 0;
      },
    });
    expect(scheduled).toBe(true);
  });
});

describe("Router scroll option", () => {
  test("defaults to preserve: navigate never scrolls", async () => {
    const log = setupWindow("/#intro");
    const router = createRouter(routes);
    expect(router.path).toBe("/");
    router.navigate("/about#team");
    await flush();
    expect(log.scrollTo).toEqual([]);
    expect(log.lookups).toEqual([]);
  });

  test("a string second argument is still the initial path", () => {
    setupWindow("/");
    expect(createRouter(routes, "/about").path).toBe("/about");
    expect(new Router(routes, { initialPath: "/about" }).path).toBe("/about");
  });

  test("top: navigate scrolls to the top", async () => {
    const log = setupWindow("/");
    const router = createRouter(routes, { scroll: "top" });
    router.navigate("/about");
    await flush();
    expect(log.scrollTo).toEqual([{ top: 0, left: 0, behavior: "instant" }]);
    expect(log.lookups).toEqual([]);
  });

  test("top: replace navigations scroll too", () => {
    const log = setupWindow("/");
    createRouter(routes, { scroll: "top" }).navigate("/about", { replace: true });
    expect(log.scrollTo).toHaveLength(1);
  });

  test("top: scroll: false skips one navigation", async () => {
    const log = setupWindow("/");
    const router = createRouter(routes, { scroll: "top" });
    router.navigate("/about#team", { scroll: false });
    await flush();
    expect(log.scrollTo).toEqual([]);
    expect(log.lookups).toEqual([]);
  });

  test("top: a hash reveals its element after the route renders", async () => {
    const log = setupWindow("/");
    const router = createRouter(routes, { scroll: "top" });
    router.navigate("/about#team");
    expect(log.revealed).toEqual([]);
    await flush();
    expect(log.scrollTo).toHaveLength(1);
    expect(log.revealed).toEqual(["team"]);
  });

  test("top: waits for lazy routes in the matched chain", async () => {
    const log = setupWindow("/");
    const load = deferred<{ default: typeof About }>();
    const router = createRouter(
      [
        { path: "/", component: Home },
        {
          path: "/docs",
          component: () => load.promise,
          children: [{ path: "guide", component: About }],
        },
      ],
      { scroll: "top" },
    );
    router.navigate("/docs/guide#install");
    await flush();
    expect(log.revealed).toEqual([]);
    load.resolve({ default: About });
    await flush();
    expect(log.revealed).toEqual(["install"]);
  });

  test("top: a failed lazy load still reveals the hash", async () => {
    const log = setupWindow("/");
    const load = deferred<{ default: typeof About }>();
    const router = createRouter(
      [{ path: "/docs", component: () => load.promise }],
      { scroll: "top" },
    );
    router.navigate("/docs#faq");
    load.reject(new Error("offline"));
    await flush();
    expect(router.peekLazy("/docs").status).toBe("error");
    expect(log.revealed).toEqual(["faq"]);
  });

  test("top: a newer navigation cancels a pending hash reveal", async () => {
    const log = setupWindow("/");
    const router = createRouter(routes, { scroll: "top" });
    router.navigate("/about#team");
    router.navigate("/");
    await flush();
    expect(log.scrollTo).toHaveLength(2);
    expect(log.revealed).toEqual([]);
  });

  test("top: a missing target leaves the page at the top", async () => {
    const log = setupWindow("/");
    const router = createRouter(routes, { scroll: "top" });
    router.navigate("/about#missing");
    await flush();
    expect(log.lookups).toEqual(["missing"]);
    expect(log.revealed).toEqual([]);
  });

  test("top: reveals the hash of the first page load", async () => {
    const log = setupWindow("/about#team");
    const router = createRouter(routes, { scroll: "top" });
    expect(router.path).toBe("/about");
    await flush();
    expect(log.scrollTo).toEqual([]);
    expect(log.revealed).toEqual(["team"]);
  });

  test("top: no first-load reveal without a hash", async () => {
    const log = setupWindow("/about");
    createRouter(routes, { scroll: "top" });
    await flush();
    expect(log.lookups).toEqual([]);
  });

  test("dispose cancels a pending hash reveal", async () => {
    const log = setupWindow("/about#team");
    const router = createRouter(routes, { scroll: "top" });
    router.dispose();
    await flush();
    expect(log.revealed).toEqual([]);
  });

  test("top is a no-op without a window (SSR)", () => {
    const router = createRouter(routes, { scroll: "top" });
    expect(router.path).toBe("/");
    router.navigate("/about#team");
    expect(router.path).toBe("/about");
  });
});

describe("Routes scroll prop", () => {
  test("passes scroll to the router it creates", async () => {
    const log = setupWindow("/");
    const prev = getCurrentInstance();
    setCurrentInstance(createComponentInstance(Routes, {}, null));
    try {
      Routes({
        scroll: "top",
        children: (
          <>
            <Route path="/" component={Home} />
            <Route path="/about" component={About} />
          </>
        ),
      });
      inject(RouterKey)?.navigate("/about#team");
    } finally {
      setCurrentInstance(prev);
    }
    await flush();
    expect(log.scrollTo).toHaveLength(1);
    expect(log.revealed).toEqual(["team"]);
  });
});
