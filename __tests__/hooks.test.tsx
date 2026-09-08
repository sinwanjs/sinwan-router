import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test";
import {
  useRouter,
  useParams,
  useSearchParams,
  useRoute,
  useNavigate,
  usePath,
  RouterKey,
} from "../src/hooks.ts";
import { createRouter } from "../src/router.ts";
import { provide, inject, getCurrentInstance, setCurrentInstance } from "sinwan/component";
import type { ComponentInstance } from "sinwan/component";
import { cc } from "sinwan/component";

// ─── Helpers ───────────────────────────────────────────────

function createMockInstance(
  provides: Record<string, unknown> = {},
): ComponentInstance {
  return {
    provides,
    props: {},
    state: {},
    slots: {},
    isMounted: false,
    isUnmounted: false,
    mountedHooks: [],
    unmountedHooks: [],
    updatedHooks: [],
    hydratedHooks: [],
    disposed: false,
    effects: [],
    computedDeps: [],
    ownerId: null,
    domNode: null,
  } as unknown as ComponentInstance;
}

const Home = cc(() => <div>Home</div>);
const UserProfile = cc(() => <div>User</div>);

const routes = [
  { path: "/", component: Home },
  { path: "/users/:id", component: UserProfile },
  { path: "/search", component: Home },
];

// ─── Tests ─────────────────────────────────────────────────

describe("Hooks", () => {
  let prevInstance: unknown;

  beforeEach(() => {
    prevInstance = getCurrentInstance();
  });

  afterEach(() => {
    setCurrentInstance(prevInstance as ComponentInstance | null);
  });

  test("useRouter returns the provided router", () => {
    const router = createRouter(routes, "/");
    const inst = createMockInstance();
    inst.provides[RouterKey as unknown as string] = router;
    setCurrentInstance(inst);

    expect(useRouter()).toBe(router);
  });

  test("useRouter throws when no router is provided", () => {
    const inst = createMockInstance();
    setCurrentInstance(inst);

    expect(() => useRouter()).toThrow("useRouter() called outside of a Router provider");
  });

  test("useRouter throws when called outside component", () => {
    setCurrentInstance(null);
    expect(() => useRouter()).toThrow();
  });

  test("useParams returns current params", () => {
    const router = createRouter(routes, "/users/42");
    const inst = createMockInstance();
    inst.provides[RouterKey as unknown as string] = router;
    setCurrentInstance(inst);

    expect(useParams()).toEqual({ id: "42" });
  });

  test("useParams returns empty object for route without params", () => {
    const router = createRouter(routes, "/");
    const inst = createMockInstance();
    inst.provides[RouterKey as unknown as string] = router;
    setCurrentInstance(inst);

    expect(useParams()).toEqual({});
  });

  test("useSearchParams returns current search params", () => {
    const router = createRouter(routes, "/search?q=hello&page=2");
    const inst = createMockInstance();
    inst.provides[RouterKey as unknown as string] = router;
    setCurrentInstance(inst);

    const params = useSearchParams();
    expect(params.get("q")).toBe("hello");
    expect(params.get("page")).toBe("2");
  });

  test("useRoute returns the matched route", () => {
    const router = createRouter(routes, "/users/42");
    const inst = createMockInstance();
    inst.provides[RouterKey as unknown as string] = router;
    setCurrentInstance(inst);

    const route = useRoute();
    expect(route).not.toBeNull();
    expect(route!.route.path).toBe("/users/:id");
    expect(route!.params).toEqual({ id: "42" });
  });

  test("useRoute returns null when no route matches", () => {
    const router = createRouter(routes, "/nonexistent");
    const inst = createMockInstance();
    inst.provides[RouterKey as unknown as string] = router;
    setCurrentInstance(inst);

    expect(useRoute()).toBeNull();
  });

  test("useNavigate returns a navigate function", () => {
    const router = createRouter(routes, "/");
    const inst = createMockInstance();
    inst.provides[RouterKey as unknown as string] = router;
    setCurrentInstance(inst);

    const navigate = useNavigate();
    expect(typeof navigate).toBe("function");
    navigate("/users/42");
    expect(router.path).toBe("/users/42");
  });

  test("useNavigate with options", () => {
    const router = createRouter(routes, "/");
    const inst = createMockInstance();
    inst.provides[RouterKey as unknown as string] = router;
    setCurrentInstance(inst);

    const navigate = useNavigate();
    navigate("/about", { replace: true });
    expect(router.path).toBe("/about");
  });

  test("usePath returns current path", () => {
    const router = createRouter(routes, "/users/42");
    const inst = createMockInstance();
    inst.provides[RouterKey as unknown as string] = router;
    setCurrentInstance(inst);

    expect(usePath()).toBe("/users/42");
  });

  test("RouterKey is a symbol", () => {
    expect(typeof RouterKey).toBe("symbol");
  });
});
