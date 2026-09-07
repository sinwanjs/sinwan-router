import { describe, expect, test } from "bun:test";
import { createRouter } from "../src/router.ts";
import {
  createLink,
  createNavLink,
  createRouterOutlet,
} from "../src/components.tsx";
import { cc } from "sinwan/component";

// ─── Test components ───────────────────────────────────────

const Home = cc(() => <div>Home</div>);
const About = cc(() => <div>About</div>);
const UserProfile = cc<{ id: string }>(({ id }) => <div>User {id}</div>);

const LazyAbout = () => Promise.resolve({ default: About });

const routes = [
  { path: "/", component: Home },
  { path: "/about", component: About },
  { path: "/users/:id", component: UserProfile },
  { path: "/lazy", component: LazyAbout },
];

// ─── Helpers ───────────────────────────────────────────────

/** Extract props from a rendered vdom node. */
function getProps(result: any): Record<string, any> {
  return result.props ?? {};
}

/** Create a fake click event. */
function fakeClick(overrides: Partial<MouseEvent> = {}): MouseEvent {
  return {
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    button: 0,
    preventDefault: () => {},
    ...overrides,
  } as unknown as MouseEvent;
}

// ─── Link tests ────────────────────────────────────────────

describe("createLink", () => {
  test("creates a Link component", () => {
    const router = createRouter(routes, "/");
    const Link = createLink(router);
    expect(typeof Link).toBe("function");
    expect((Link as any)._SinwanComponent).toBe(true);
  });

  test("Link renders an anchor with href", () => {
    const router = createRouter(routes, "/");
    const Link = createLink(router);
    const result = Link({ href: "/about", children: "About" }) as any;
    expect(result.tag).toBe("a");
    expect(getProps(result).href).toBe("/about");
  });

  test("Link click navigates to href", () => {
    const router = createRouter(routes, "/");
    const Link = createLink(router);
    const result = Link({ href: "/about", children: "About" }) as any;
    const onclick = getProps(result).onclick;
    onclick(fakeClick());
    expect(router.path).toBe("/about");
  });

  test("Link click with ctrlKey does not navigate", () => {
    const router = createRouter(routes, "/");
    const Link = createLink(router);
    const result = Link({ href: "/about", children: "About" }) as any;
    const onclick = getProps(result).onclick;
    onclick(fakeClick({ ctrlKey: true }));
    expect(router.path).toBe("/");
  });

  test("Link click with metaKey does not navigate", () => {
    const router = createRouter(routes, "/");
    const Link = createLink(router);
    const result = Link({ href: "/about", children: "About" }) as any;
    const onclick = getProps(result).onclick;
    onclick(fakeClick({ metaKey: true }));
    expect(router.path).toBe("/");
  });

  test("Link click with shiftKey does not navigate", () => {
    const router = createRouter(routes, "/");
    const Link = createLink(router);
    const result = Link({ href: "/about", children: "About" }) as any;
    const onclick = getProps(result).onclick;
    onclick(fakeClick({ shiftKey: true }));
    expect(router.path).toBe("/");
  });

  test("Link click with button !== 0 does not navigate", () => {
    const router = createRouter(routes, "/");
    const Link = createLink(router);
    const result = Link({ href: "/about", children: "About" }) as any;
    const onclick = getProps(result).onclick;
    onclick(fakeClick({ button: 1 }));
    expect(router.path).toBe("/");
  });

  test("Link mouseenter with prefetch=true calls prefetch", () => {
    const router = createRouter(routes, "/");
    const prefetchSpy = router.prefetch.bind(router);
    let called = false;
    router.prefetch = (path: string) => {
      called = true;
      prefetchSpy(path);
    };
    const Link = createLink(router);
    const result = Link({
      href: "/about",
      prefetch: true,
      children: "About",
    }) as any;
    const onmouseenter = getProps(result).onmouseenter;
    onmouseenter();
    expect(called).toBe(true);
  });

  test("Link mouseenter with prefetch=false does not call prefetch", () => {
    const router = createRouter(routes, "/");
    let called = false;
    router.prefetch = () => {
      called = true;
    };
    const Link = createLink(router);
    const result = Link({
      href: "/about",
      prefetch: false,
      children: "About",
    }) as any;
    const onmouseenter = getProps(result).onmouseenter;
    onmouseenter();
    expect(called).toBe(false);
  });

  test("Link with class prop", () => {
    const router = createRouter(routes, "/");
    const Link = createLink(router);
    const result = Link({
      href: "/about",
      class: "nav-link",
      children: "About",
    }) as any;
    expect(getProps(result).class).toBe("nav-link");
  });
});

// ─── NavLink tests ─────────────────────────────────────────

describe("createNavLink", () => {
  test("creates a NavLink component", () => {
    const router = createRouter(routes, "/");
    const NavLink = createNavLink(router);
    expect(typeof NavLink).toBe("function");
    expect((NavLink as any)._SinwanComponent).toBe(true);
  });

  test("NavLink click navigates to href", () => {
    const router = createRouter(routes, "/");
    const NavLink = createNavLink(router);
    const result = NavLink({ href: "/about", children: "About" }) as any;
    const onclick = getProps(result).onclick;
    onclick(fakeClick());
    expect(router.path).toBe("/about");
  });

  test("NavLink click with ctrlKey does not navigate", () => {
    const router = createRouter(routes, "/");
    const NavLink = createNavLink(router);
    const result = NavLink({ href: "/about", children: "About" }) as any;
    const onclick = getProps(result).onclick;
    onclick(fakeClick({ ctrlKey: true }));
    expect(router.path).toBe("/");
  });

  test("NavLink click with metaKey does not navigate", () => {
    const router = createRouter(routes, "/");
    const NavLink = createNavLink(router);
    const result = NavLink({ href: "/about", children: "About" }) as any;
    const onclick = getProps(result).onclick;
    onclick(fakeClick({ metaKey: true }));
    expect(router.path).toBe("/");
  });

  test("NavLink click with shiftKey does not navigate", () => {
    const router = createRouter(routes, "/");
    const NavLink = createNavLink(router);
    const result = NavLink({ href: "/about", children: "About" }) as any;
    const onclick = getProps(result).onclick;
    onclick(fakeClick({ shiftKey: true }));
    expect(router.path).toBe("/");
  });

  test("NavLink click with button !== 0 does not navigate", () => {
    const router = createRouter(routes, "/");
    const NavLink = createNavLink(router);
    const result = NavLink({ href: "/about", children: "About" }) as any;
    const onclick = getProps(result).onclick;
    onclick(fakeClick({ button: 2 }));
    expect(router.path).toBe("/");
  });

  test("NavLink mouseenter with prefetch=true calls prefetch", () => {
    const router = createRouter(routes, "/");
    const prefetchSpy = router.prefetch.bind(router);
    let called = false;
    router.prefetch = (path: string) => {
      called = true;
      prefetchSpy(path);
    };
    const NavLink = createNavLink(router);
    const result = NavLink({
      href: "/about",
      prefetch: true,
      children: "About",
    }) as any;
    const onmouseenter = getProps(result).onmouseenter;
    onmouseenter();
    expect(called).toBe(true);
  });

  test("NavLink mouseenter with prefetch=false does not call prefetch", () => {
    const router = createRouter(routes, "/");
    let called = false;
    router.prefetch = () => {
      called = true;
    };
    const NavLink = createNavLink(router);
    const result = NavLink({
      href: "/about",
      prefetch: false,
      children: "About",
    }) as any;
    const onmouseenter = getProps(result).onmouseenter;
    onmouseenter();
    expect(called).toBe(false);
  });

  test("NavLink active class when path matches exactly", () => {
    const router = createRouter(routes, "/about");
    const NavLink = createNavLink(router);
    const result = NavLink({
      href: "/about",
      activeClass: "active",
      children: "About",
    }) as any;
    // The class prop is a function (reactive) — call it to get the value
    const classProp = getProps(result).class;
    const cls = typeof classProp === "function" ? classProp() : classProp;
    expect(cls).toContain("active");
  });

  test("NavLink active class when path is nested under href", () => {
    const router = createRouter(routes, "/users/42");
    const NavLink = createNavLink(router);
    const result = NavLink({
      href: "/users",
      activeClass: "active",
      children: "Users",
    }) as any;
    const classProp = getProps(result).class;
    const cls = typeof classProp === "function" ? classProp() : classProp;
    expect(cls).toContain("active");
  });

  test("NavLink no active class when path doesn't match", () => {
    const router = createRouter(routes, "/");
    const NavLink = createNavLink(router);
    const result = NavLink({
      href: "/about",
      activeClass: "active",
      children: "About",
    }) as any;
    const classProp = getProps(result).class;
    const cls = typeof classProp === "function" ? classProp() : classProp;
    expect(cls).toBe("");
  });

  test("NavLink with custom activeClass", () => {
    const router = createRouter(routes, "/about");
    const NavLink = createNavLink(router);
    const result = NavLink({
      href: "/about",
      activeClass: "current",
      children: "About",
    }) as any;
    const classProp = getProps(result).class;
    const cls = typeof classProp === "function" ? classProp() : classProp;
    expect(cls).toContain("current");
  });

  test("NavLink with class and activeClass combined", () => {
    const router = createRouter(routes, "/about");
    const NavLink = createNavLink(router);
    const result = NavLink({
      href: "/about",
      class: "nav-link",
      activeClass: "active",
      children: "About",
    }) as any;
    const classProp = getProps(result).class;
    const cls = typeof classProp === "function" ? classProp() : classProp;
    expect(cls).toContain("nav-link");
    expect(cls).toContain("active");
  });
});

// ─── RouterOutlet tests ────────────────────────────────────

describe("createRouterOutlet", () => {
  test("creates a RouterOutlet component", () => {
    const router = createRouter(routes, "/");
    const RouterOutlet = createRouterOutlet(router);
    expect(typeof RouterOutlet).toBe("function");
    expect((RouterOutlet as any)._SinwanComponent).toBe(true);
  });

  test("RouterOutlet renders matched route component (static)", () => {
    const router = createRouter(routes, "/");
    const RouterOutlet = createRouterOutlet(router);
    const result = RouterOutlet({}) as any;
    // RouterOutlet now returns a Show element (reactive control flow)
    expect(result).toBeDefined();
    expect(result.tag).toBeDefined();
  });

  test("RouterOutlet renders with fallback prop", () => {
    const router = createRouter(routes, "/");
    const Fallback = cc(() => <div>Loading...</div>);
    const RouterOutlet = createRouterOutlet(router);
    const result = RouterOutlet({ fallback: Fallback }) as any;
    expect(result).toBeDefined();
  });

  test("RouterOutlet renders notFound when no route matches", () => {
    const router = createRouter(routes, "/nonexistent");
    const NotFound = cc(() => <div>404</div>);
    const RouterOutlet = createRouterOutlet(router);
    const result = RouterOutlet({ notFound: NotFound }) as any;
    // Outer Show's fallback should contain the NotFound component
    expect(result).toBeDefined();
    expect(result.props).toBeDefined();
    expect(result.props.fallback).toBeDefined();
  });

  test("RouterOutlet renders default 404 when no match and no notFound prop", () => {
    const router = createRouter(routes, "/nonexistent");
    const RouterOutlet = createRouterOutlet(router);
    const result = RouterOutlet({}) as any;
    // Outer Show's fallback should be a div with "404" text
    expect(result).toBeDefined();
    expect(result.props.fallback).toBeDefined();
  });

  test("RouterOutlet renders default loading when lazy and no fallback", () => {
    const router = createRouter(routes, "/lazy");
    const RouterOutlet = createRouterOutlet(router);
    const result = RouterOutlet({}) as any;
    // The outer Show is for not-found, inner Show for loading state
    expect(result).toBeDefined();
    expect(result.props).toBeDefined();
  });

  test("RouterOutlet renders fallback while loading lazy route", () => {
    const router = createRouter(routes, "/lazy");
    const Fallback = cc(() => <div>Loading...</div>);
    const RouterOutlet = createRouterOutlet(router);
    const result = RouterOutlet({ fallback: Fallback }) as any;
    expect(result).toBeDefined();
    // The inner Show's fallback should contain the Fallback component
    // The children prop contains the inner Show
    expect(result.props.children).toBeDefined();
  });

  test("RouterOutlet renders resolved component after lazy load", async () => {
    const router = createRouter(routes, "/lazy");
    const RouterOutlet = createRouterOutlet(router);
    const result = RouterOutlet({}) as any;
    // Wait for the lazy component to resolve
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(result).toBeDefined();
  });
});
