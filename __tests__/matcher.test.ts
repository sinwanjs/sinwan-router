import { describe, expect, test } from "bun:test";
import {
  createRadixTree,
  radixInsert,
  radixSearch,
  buildPath,
  normalizePath,
  extractSearchParams,
  type RadixNode,
} from "../src/matcher.ts";

// ─── Helpers ───────────────────────────────────────────────

function buildTree(
  entries: { pattern: string; data?: Record<string, unknown> }[],
): RadixNode {
  const root = createRadixTree();
  for (const { pattern, data } of entries) {
    radixInsert(root, pattern, data ?? { pattern });
  }
  return root;
}

// ─── normalizePath ─────────────────────────────────────────

describe("normalizePath", () => {
  test("ensures leading slash", () => {
    expect(normalizePath("users")).toBe("/users");
    expect(normalizePath("users/42")).toBe("/users/42");
  });

  test("strips trailing slash (except root)", () => {
    expect(normalizePath("/users/")).toBe("/users");
    expect(normalizePath("/users/42/")).toBe("/users/42");
  });

  test("preserves root", () => {
    expect(normalizePath("/")).toBe("/");
  });

  test("strips query string", () => {
    expect(normalizePath("/users?q=test")).toBe("/users");
  });

  test("strips hash", () => {
    expect(normalizePath("/users#section")).toBe("/users");
  });

  test("strips both query and hash", () => {
    expect(normalizePath("/users?q=test#section")).toBe("/users");
  });
});

// ─── extractSearchParams ──────────────────────────────────

describe("extractSearchParams", () => {
  test("extracts search params from path with query", () => {
    const params = extractSearchParams("/search?q=hello&page=2");
    expect(params.get("q")).toBe("hello");
    expect(params.get("page")).toBe("2");
  });

  test("returns empty URLSearchParams for path without query", () => {
    const params = extractSearchParams("/users");
    expect(params.toString()).toBe("");
  });

  test("handles empty query string", () => {
    const params = extractSearchParams("/users?");
    expect(params.toString()).toBe("");
  });
});

// ─── buildPath ─────────────────────────────────────────────

describe("buildPath", () => {
  test("builds path with params", () => {
    expect(buildPath("/users/:id", { id: "42" })).toBe("/users/42");
  });

  test("builds path with multiple params", () => {
    expect(
      buildPath("/posts/:slug/comments/:cid", { slug: "hello", cid: "5" }),
    ).toBe("/posts/hello/comments/5");
  });

  test("encodes params", () => {
    expect(buildPath("/search/:query", { query: "hello world" })).toBe(
      "/search/hello%20world",
    );
  });

  test("builds path without params", () => {
    expect(buildPath("/about")).toBe("/about");
  });

  test("throws on missing param", () => {
    expect(() => buildPath("/users/:id", {})).toThrow('Missing param "id"');
  });
});

// ─── Radix Tree: Insert & Search ───────────────────────────

describe("radixInsert + radixSearch", () => {
  test("matches a literal root path", () => {
    const tree = buildTree([{ pattern: "/" }]);
    const result = radixSearch(tree, "/");
    expect(result).not.toBeNull();
    expect(result!.data).toEqual({ pattern: "/" });
  });

  test("matches a literal path", () => {
    const tree = buildTree([{ pattern: "/about" }]);
    const result = radixSearch(tree, "/about");
    expect(result).not.toBeNull();
    expect(result!.params).toEqual({});
  });

  test("returns null for non-matching literal path", () => {
    const tree = buildTree([{ pattern: "/about" }]);
    expect(radixSearch(tree, "/contact")).toBeNull();
  });

  test("matches a path with a named param", () => {
    const tree = buildTree([{ pattern: "/users/:id" }]);
    const result = radixSearch(tree, "/users/42");
    expect(result).not.toBeNull();
    expect(result!.params).toEqual({ id: "42" });
  });

  test("matches a path with multiple params", () => {
    const tree = buildTree([{ pattern: "/posts/:slug/comments/:cid" }]);
    const result = radixSearch(tree, "/posts/hello/comments/5");
    expect(result).not.toBeNull();
    expect(result!.params).toEqual({ slug: "hello", cid: "5" });
  });

  test("decodes URI-encoded params", () => {
    const tree = buildTree([{ pattern: "/search/:query" }]);
    const result = radixSearch(tree, "/search/hello%20world");
    expect(result).not.toBeNull();
    expect(result!.params).toEqual({ query: "hello world" });
  });

  test("returns null when param path has no segments after param", () => {
    const tree = buildTree([{ pattern: "/users/:id/posts" }]);
    expect(radixSearch(tree, "/users/42")).toBeNull();
  });

  test("matches a wildcard path", () => {
    const tree = buildTree([{ pattern: "/files/*path" }]);
    const result = radixSearch(tree, "/files/a/b/c");
    expect(result).not.toBeNull();
    expect(result!.params).toEqual({ path: "a/b/c" });
  });

  test("matches a wildcard without name", () => {
    const tree = buildTree([{ pattern: "/files/*" }]);
    const result = radixSearch(tree, "/files/a/b");
    expect(result).not.toBeNull();
    expect(result!.params).toEqual({ _wildcard: "a/b" });
  });

  test("wildcard matches single segment", () => {
    const tree = buildTree([{ pattern: "/files/*path" }]);
    const result = radixSearch(tree, "/files/x.txt");
    expect(result).not.toBeNull();
    expect(result!.params).toEqual({ path: "x.txt" });
  });

  test("prefers static segment over param segment", () => {
    const tree = buildTree([
      { pattern: "/users/settings" },
      { pattern: "/users/:id" },
    ]);
    // /users/settings should match the static route, not the param route
    const result = radixSearch(tree, "/users/settings");
    expect(result).not.toBeNull();
    expect(result!.data).toEqual({ pattern: "/users/settings" });
    expect(result!.params).toEqual({});
  });

  test("falls back to param segment when static doesn't match", () => {
    const tree = buildTree([
      { pattern: "/users/settings" },
      { pattern: "/users/:id" },
    ]);
    const result = radixSearch(tree, "/users/42");
    expect(result).not.toBeNull();
    expect(result!.params).toEqual({ id: "42" });
  });

  test("matches nested routes", () => {
    const tree = buildTree([
      { pattern: "/users" },
      { pattern: "/users/:id" },
      { pattern: "/users/:id/posts" },
      { pattern: "/users/:id/posts/:postId" },
    ]);

    expect(radixSearch(tree, "/users")!.data).toEqual({ pattern: "/users" });
    expect(radixSearch(tree, "/users/42")!.params).toEqual({ id: "42" });
    expect(radixSearch(tree, "/users/42/posts")!.params).toEqual({ id: "42" });
    expect(radixSearch(tree, "/users/42/posts/5")!.params).toEqual({
      id: "42",
      postId: "5",
    });
  });

  test("returns null for empty tree", () => {
    const tree = createRadixTree();
    expect(radixSearch(tree, "/anything")).toBeNull();
  });

  test("returns null for path deeper than any route", () => {
    const tree = buildTree([{ pattern: "/users" }]);
    expect(radixSearch(tree, "/users/42/extra")).toBeNull();
  });

  test("matches root with trailing slash", () => {
    const tree = buildTree([{ pattern: "/" }]);
    expect(radixSearch(tree, "/")).not.toBeNull();
  });

  test("matches path with trailing slash (normalized)", () => {
    const tree = buildTree([{ pattern: "/about" }]);
    expect(radixSearch(tree, "/about/")).not.toBeNull();
  });

  test("attached data is returned on match", () => {
    const tree = buildTree([
      { pattern: "/users/:id", data: { custom: "data", num: 42 } },
    ]);
    const result = radixSearch(tree, "/users/42");
    expect(result!.data).toEqual({ custom: "data", num: 42 });
  });

  test("matchedPath is returned for static route", () => {
    const tree = buildTree([{ pattern: "/about" }]);
    const result = radixSearch(tree, "/about");
    expect(result!.matchedPath).toBe("/about");
  });

  test("matchedPath is returned for param route", () => {
    const tree = buildTree([{ pattern: "/users/:id" }]);
    const result = radixSearch(tree, "/users/42");
    expect(result!.matchedPath).toBe("/users/:id");
  });

  test("wildcard at end of path matches empty rest", () => {
    const tree = buildTree([{ pattern: "/files/*path" }]);
    // /files/ with trailing slash normalizes to /files, which has no wildcard match
    // But /files itself should not match the wildcard (needs at least the /files segment)
    const result = radixSearch(tree, "/files");
    // The wildcard child exists but needs at least one more segment
    // Actually, the wildcard node is a child of "files" node, and depth would be
    // at segments.length, so it checks for trailing wildcard
    expect(result).not.toBeNull();
    expect(result!.params).toEqual({ path: "" });
  });

  test("unnamed wildcard at end of path matches empty rest", () => {
    const tree = buildTree([{ pattern: "/files/*" }]);
    const result = radixSearch(tree, "/files");
    expect(result).not.toBeNull();
    expect(result!.params).toEqual({ _wildcard: "" });
  });

  test("inserting two routes under the same wildcard reuses the node", () => {
    const root = createRadixTree();
    radixInsert(root, "/files/*path", { first: true });
    radixInsert(root, "/files/*path", { second: true });
    // The second insert should overwrite the route data on the same wildcard node
    const result = radixSearch(root, "/files/a/b");
    expect(result).not.toBeNull();
    expect(result!.data).toEqual({ second: true });
  });
});

// ─── Radix Tree: Multiple routes ───────────────────────────

describe("radixSearch with multiple routes", () => {
  test("matches the correct route among many", () => {
    const tree = buildTree([
      { pattern: "/", data: { name: "home" } },
      { pattern: "/about", data: { name: "about" } },
      { pattern: "/users", data: { name: "users" } },
      { pattern: "/users/:id", data: { name: "user" } },
      { pattern: "/users/:id/posts", data: { name: "userPosts" } },
      { pattern: "/posts/:slug", data: { name: "post" } },
      { pattern: "/files/*path", data: { name: "files" } },
    ]);

    expect(radixSearch(tree, "/")!.data).toEqual({ name: "home" });
    expect(radixSearch(tree, "/about")!.data).toEqual({ name: "about" });
    expect(radixSearch(tree, "/users")!.data).toEqual({ name: "users" });
    expect(radixSearch(tree, "/users/42")!.data).toEqual({ name: "user" });
    expect(radixSearch(tree, "/users/42/posts")!.data).toEqual({
      name: "userPosts",
    });
    expect(radixSearch(tree, "/posts/hello")!.data).toEqual({ name: "post" });
    expect(radixSearch(tree, "/files/a/b/c")!.data).toEqual({ name: "files" });
    expect(radixSearch(tree, "/nonexistent")).toBeNull();
  });
});

// ─── createRadixTree ───────────────────────────────────────

describe("createRadixTree", () => {
  test("creates an empty tree root", () => {
    const root = createRadixTree();
    expect(root.children).toEqual([]);
    expect(root.route).toBeNull();
    expect(root.isParam).toBe(false);
    expect(root.isWildcard).toBe(false);
  });
});
