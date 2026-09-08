import { describe, expect, test } from "bun:test";
import { createRouter } from "../src/router.ts";
import {
  computeOutletKey,
  getMatchAtDepth,
  routeIdentity,
} from "../src/outlet.ts";
import { Home, About } from "./helpers.tsx";

describe("getMatchAtDepth", () => {
  test("returns null for a null match", () => {
    expect(getMatchAtDepth(null, 0)).toBeNull();
  });

  test("walks parent → child for nested routes", () => {
    const router = createRouter(
      [
        {
          path: "/users",
          component: Home,
          children: [{ path: ":id", component: Home }],
        },
      ],
      "/users/42",
    );
    const leaf = router.matched;
    expect(leaf).not.toBeNull();
    expect(getMatchAtDepth(leaf, 0)?.route.path).toBe("/users");
    expect(getMatchAtDepth(leaf, 1)?.route.path).toBe(":id");
    expect(getMatchAtDepth(leaf, 2)).toBeNull();
  });
});

describe("routeIdentity", () => {
  test("keeps parent layout identity stable across child params", () => {
    const router = createRouter(
      [
        {
          path: "/users",
          component: Home,
          children: [{ path: ":id", component: Home }],
        },
      ],
      "/users/1",
    );
    const parent = getMatchAtDepth(router.matched, 0)!;
    const child = getMatchAtDepth(router.matched, 1)!;
    expect(routeIdentity(parent)).toBe("/users");
    expect(routeIdentity(child)).toBe("/users/1");

    router.navigate("/users/2");
    const parent2 = getMatchAtDepth(router.matched, 0)!;
    const child2 = getMatchAtDepth(router.matched, 1)!;
    expect(routeIdentity(parent2)).toBe("/users");
    expect(routeIdentity(child2)).toBe("/users/2");
  });

  test("uses the concrete path for wildcard routes", () => {
    const router = createRouter(
      [{ path: "/files/*path", component: About }],
      "/files/a/b",
    );
    expect(routeIdentity(router.matched!)).toBe("/files/a/b");
  });

  test("falls back to the matched path when a param is missing from the pattern", () => {
    const identity = routeIdentity({
      route: { path: "/x/:missing", component: Home },
      params: { other: "1" },
      path: "/x/1",
      matchedPath: "/x/:missing",
    });
    expect(identity).toBe("/x/1");
  });
});

describe("computeOutletKey", () => {
  test("does not change the parent key when only the child param changes", () => {
    const router = createRouter(
      [
        {
          path: "/users",
          component: Home,
          children: [{ path: ":id", component: Home }],
        },
      ],
      "/users/1",
    );
    const parentKey = computeOutletKey(router, 0);
    const childKey = computeOutletKey(router, 1);
    router.navigate("/users/2");
    expect(computeOutletKey(router, 0)).toBe(parentKey);
    expect(computeOutletKey(router, 1)).not.toBe(childKey);
  });

  test("uses a not-found key at depth 0 and an empty key at nested depth", () => {
    const router = createRouter([{ path: "/", component: Home }], "/missing");
    expect(computeOutletKey(router, 0)).toBe("__notfound__");
    expect(computeOutletKey(router, 1)).toBe("__empty:1");
  });

  test("includes lazy status so a completed load changes the key without navigating", async () => {
    let resolveMod: ((value: { default: typeof About }) => void) | undefined;
    const loader = () =>
      new Promise<{ default: typeof About }>((resolve) => {
        resolveMod = resolve;
      });
    const router = createRouter(
      [{ path: "/lazy", component: loader }],
      "/lazy",
    );
    const before = computeOutletKey(router, 0);
    expect(before.endsWith(":idle") || before.endsWith(":loading")).toBe(true);
    router.ensureLazy("/lazy", loader);
    expect(computeOutletKey(router, 0).endsWith(":loading")).toBe(true);
    resolveMod!({ default: About });
    await Promise.resolve();
    await Promise.resolve();
    expect(computeOutletKey(router, 0).endsWith(":ready")).toBe(true);
  });
});
