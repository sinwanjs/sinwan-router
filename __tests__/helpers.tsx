/**
 * Shared test helpers for sinwan-router.
 */

import { cc } from "sinwan/component";
import {
  createComponentInstance,
  getCurrentInstance,
  setCurrentInstance,
} from "sinwan/component";
import { RouterKey } from "../src/hooks.ts";
import type { Router } from "../src/router.ts";
import type { LinkClickEvent } from "../src/link-nav.ts";

export const Home = cc(() => <div>Home</div>);
export const About = cc(() => <div>About</div>);
export const Loading = cc(() => <div>Loading...</div>);
export const NotFound = cc(() => <div>404</div>);
export const Failed = cc<{ error?: unknown }>(() => <div>Failed</div>);

export function fakeClick(
  overrides: Partial<LinkClickEvent> = {},
): LinkClickEvent & { preventDefault: () => void } {
  let prevented = overrides.defaultPrevented ?? false;
  return {
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    button: 0,
    defaultPrevented: prevented,
    preventDefault: () => {
      prevented = true;
    },
    ...overrides,
  };
}

export function withRouter<T>(router: Router, run: () => T): T {
  const prev = getCurrentInstance();
  const inst = createComponentInstance(
    cc(() => null),
    {},
    null,
  );
  inst.provides[RouterKey] = router;
  setCurrentInstance(inst);
  try {
    return run();
  } finally {
    setCurrentInstance(prev);
  }
}

export function setupWindow(path = "/"): void {
  const pathState = { value: path };
  (globalThis as unknown as { window: unknown }).window = {
    location: {
      get pathname() {
        return pathState.value.split("?")[0];
      },
      get search() {
        const q = pathState.value.indexOf("?");
        return q !== -1 ? pathState.value.slice(q) : "";
      },
    },
    history: {
      pushState: (_state: unknown, _title: string, url: string) => {
        pathState.value = url;
      },
      replaceState: (_state: unknown, _title: string, url: string) => {
        pathState.value = url;
      },
    },
    addEventListener: (_event: string, _handler: () => void) => {},
    removeEventListener: (_event: string, _handler: () => void) => {},
  };
}

export function teardownWindow(): void {
  delete (globalThis as unknown as { window?: unknown }).window;
}

export async function waitForLazyStatus(
  router: Router,
  cacheKey: string,
  status: "ready" | "error" | "loading" | "idle",
): Promise<void> {
  for (let i = 0; i < 40; i++) {
    if (router.peekLazy(cacheKey).status === status) return;
    await Promise.resolve();
  }
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
  if (router.peekLazy(cacheKey).status === status) return;
  throw new Error(
    `timed out waiting for ${cacheKey} to be ${status}, got ${router.peekLazy(cacheKey).status}`,
  );
}

export type KeyVNode = {
  props: {
    when: () => string;
    children: () => { tag?: unknown; props?: Record<string, unknown> } | null;
  };
};

export function asVNode(node: unknown): {
  tag?: unknown;
  props: Record<string, unknown>;
} {
  if (node !== null && typeof node === "object" && "props" in node) {
    const props = (node as { props: unknown }).props;
    if (props !== null && typeof props === "object") {
      return {
        tag: (node as { tag?: unknown }).tag,
        props: props as Record<string, unknown>,
      };
    }
  }
  throw new Error("expected a vnode with props");
}

export function asKey(node: unknown): KeyVNode {
  const vnode = asVNode(node);
  const when = vnode.props.when;
  const children = vnode.props.children;
  if (typeof when !== "function" || typeof children !== "function") {
    throw new Error("expected a Key vnode");
  }
  return {
    props: {
      when: when as KeyVNode["props"]["when"],
      children: children as KeyVNode["props"]["children"],
    },
  };
}
