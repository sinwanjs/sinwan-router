import { describe, expect, test } from "bun:test";
import {
  isExternalHref,
  isHashOnlyHref,
  jsxClass,
  shouldInterceptLinkClick,
} from "../src/link-nav.ts";

describe("isExternalHref", () => {
  test("treats protocol-relative and schemed URLs as external", () => {
    expect(isExternalHref("//cdn.example.com/a.js")).toBe(true);
    expect(isExternalHref("https://example.com")).toBe(true);
    expect(isExternalHref("http://example.com")).toBe(true);
    expect(isExternalHref("mailto:hi@example.com")).toBe(true);
    expect(isExternalHref("tel:+15551212")).toBe(true);
  });

  test("treats app paths as internal", () => {
    expect(isExternalHref("/about")).toBe(false);
    expect(isExternalHref("about")).toBe(false);
    expect(isExternalHref("./about")).toBe(false);
    expect(isExternalHref("?q=1")).toBe(false);
    expect(isExternalHref("#section")).toBe(false);
  });
});

describe("isHashOnlyHref", () => {
  test("detects bare hashes and same-path hashes", () => {
    expect(isHashOnlyHref("#top", "/about")).toBe(true);
    expect(isHashOnlyHref("/about#top", "/about")).toBe(true);
    expect(isHashOnlyHref("/about/#top", "/about")).toBe(true);
    expect(isHashOnlyHref(".#frag", "/about")).toBe(true);
  });

  test("does not treat a different path with a hash as hash-only", () => {
    expect(isHashOnlyHref("/users#top", "/about")).toBe(false);
    expect(isHashOnlyHref("/about", "/about")).toBe(false);
  });

  test("strips query before comparing the hash path", () => {
    expect(isHashOnlyHref("/about?q=1#top", "/about")).toBe(true);
  });
});

describe("shouldInterceptLinkClick", () => {
  const base = {
    button: 0,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
  };

  test("intercepts a plain internal click", () => {
    expect(shouldInterceptLinkClick(base, "/about", "/")).toBe(true);
  });

  test("skips modified clicks, already-handled clicks, and non-primary buttons", () => {
    expect(shouldInterceptLinkClick({ ...base, altKey: true }, "/about", "/")).toBe(
      false,
    );
    expect(shouldInterceptLinkClick({ ...base, ctrlKey: true }, "/about", "/")).toBe(
      false,
    );
    expect(shouldInterceptLinkClick({ ...base, metaKey: true }, "/about", "/")).toBe(
      false,
    );
    expect(shouldInterceptLinkClick({ ...base, shiftKey: true }, "/about", "/")).toBe(
      false,
    );
    expect(shouldInterceptLinkClick({ ...base, button: 1 }, "/about", "/")).toBe(
      false,
    );
    expect(
      shouldInterceptLinkClick({ ...base, defaultPrevented: true }, "/about", "/"),
    ).toBe(false);
  });

  test("skips new-tab, download, external, and hash-only targets", () => {
    expect(
      shouldInterceptLinkClick(base, "/about", "/", { target: "_blank" }),
    ).toBe(false);
    expect(
      shouldInterceptLinkClick(base, "/about", "/", { target: "_self" }),
    ).toBe(true);
    expect(
      shouldInterceptLinkClick(base, "/file", "/", { download: false }),
    ).toBe(true);
    expect(
      shouldInterceptLinkClick(base, "/file", "/", { download: "name.txt" }),
    ).toBe(false);
    expect(shouldInterceptLinkClick(base, "https://example.com", "/")).toBe(
      false,
    );
    expect(shouldInterceptLinkClick(base, "#top", "/about")).toBe(false);
  });

  test("empty target still intercepts", () => {
    expect(shouldInterceptLinkClick(base, "/about", "/", { target: "" })).toBe(
      true,
    );
  });
});

describe("jsxClass", () => {
  test("returns the same getter instance for the JSX class slot", () => {
    const getter = () => "active";
    const result: unknown = jsxClass(getter);
    expect(result).toBe(getter);
  });
});
