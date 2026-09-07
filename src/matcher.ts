/**
 * Sinwan Router — Radix Tree Path Matching
 *
 * Segment-by-segment trie matching for O(depth) lookups.
 * No regex compilation — static segments are matched by direct
 * string comparison, params by position, and wildcards capture
 * the remaining path.
 *
 * Architecture mirrors the sinwan-engine HTTPRouter radix tree:
 *   - Static children checked first (fast path)
 *   - Param children checked second
 *   - Wildcard children checked last (catch-all)
 */

// ─── Radix Node ────────────────────────────────────────────

export interface RadixNode {
  /** Literal segment prefix, or `:param` / `*` marker. */
  prefix: string;
  /** Child nodes. */
  children: RadixNode[];
  /** Whether this node is a `:param` segment. */
  isParam: boolean;
  /** Param name (without the `:`). */
  paramName: string;
  /** Whether this node is a `*` wildcard. */
  isWildcard: boolean;
  /** Route data attached at this node (set at leaf). */
  route: RouteData | null;
}

/** Arbitrary data attached to a matched leaf node. */
export interface RouteData {
  [key: string]: unknown;
}

function createNode(prefix: string): RadixNode {
  return {
    prefix,
    children: [],
    isParam: prefix.startsWith(":"),
    paramName: prefix.startsWith(":") ? prefix.slice(1) : "",
    isWildcard: prefix === "*" || prefix.startsWith("*"),
    route: null,
  };
}

// ─── Path Utilities ────────────────────────────────────────

/**
 * Normalize a URL path: ensure leading slash, strip trailing slash
 * (except for root), and strip hash/query.
 */
export function normalizePath(path: string): string {
  // Strip query and hash
  const qIdx = path.indexOf("?");
  if (qIdx !== -1) path = path.slice(0, qIdx);
  const hIdx = path.indexOf("#");
  if (hIdx !== -1) path = path.slice(0, hIdx);

  // Ensure leading slash
  if (!path.startsWith("/")) path = "/" + path;

  // Strip trailing slash (except root)
  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }

  return path;
}

/** Split a path into segments, filtering empty strings. */
function splitSegments(path: string): string[] {
  return path.split("/").filter(Boolean);
}

/** Extract the search params from a URL string. */
export function extractSearchParams(path: string): URLSearchParams {
  const qIdx = path.indexOf("?");
  if (qIdx === -1) return new URLSearchParams();
  return new URLSearchParams(path.slice(qIdx + 1));
}

// ─── Radix Insert ──────────────────────────────────────────

/**
 * Insert a route into the radix tree.
 *
 * @param root The root node.
 * @param pattern Path pattern like `/users/:id` or `/files/*path`.
 * @param data   Arbitrary data to attach at the leaf.
 */
export function radixInsert(
  root: RadixNode,
  pattern: string,
  data: RouteData,
): void {
  const segments = splitSegments(normalizePath(pattern));
  insertNode(root, segments, 0, data);
}

function insertNode(
  node: RadixNode,
  segments: string[],
  depth: number,
  data: RouteData,
): void {
  if (depth === segments.length) {
    node.route = data;
    return;
  }

  const seg = segments[depth];
  if (seg === undefined) return;

  // Wildcard child
  if (seg === "*" || seg.startsWith("*")) {
    const existing = node.children.find((c) => c.isWildcard);
    if (existing) {
      insertNode(existing, segments, depth + 1, data);
      return;
    }
    const wc = createNode(seg);
    node.children.push(wc);
    insertNode(wc, segments, depth + 1, data);
    return;
  }

  // Param child
  if (seg.startsWith(":")) {
    const paramName = seg.slice(1);
    for (const child of node.children) {
      if (child.isParam && child.paramName === paramName) {
        insertNode(child, segments, depth + 1, data);
        return;
      }
    }
    const pc = createNode(seg);
    node.children.push(pc);
    insertNode(pc, segments, depth + 1, data);
    return;
  }

  // Static child
  for (const child of node.children) {
    if (child.isParam || child.isWildcard) continue;
    if (child.prefix === seg) {
      insertNode(child, segments, depth + 1, data);
      return;
    }
  }

  const sc = createNode(seg);
  node.children.push(sc);
  insertNode(sc, segments, depth + 1, data);
}

// ─── Radix Search ──────────────────────────────────────────

/** Result of a radix search. */
export interface MatchResult {
  /** The data attached to the matched leaf node. */
  data: RouteData;
  /** Extracted path parameters. */
  params: Record<string, string>;
  /** The full pattern that was matched. */
  matchedPath: string;
}

/**
 * Search the radix tree for a matching route.
 *
 * Static segments are checked first (fast path), then param
 * segments, then wildcard segments (catch-all).
 *
 * @returns `MatchResult` if found, `null` otherwise.
 */
export function radixSearch(root: RadixNode, path: string): MatchResult | null {
  const segments = splitSegments(normalizePath(path));
  const params: Record<string, string> = Object.create(null);
  const result = searchNode(root, segments, 0, params, "");
  if (!result) return null;
  return result;
}

function searchNode(
  node: RadixNode,
  segments: string[],
  depth: number,
  params: Record<string, string>,
  pathSoFar: string,
): MatchResult | null {
  // Reached the end of the path — check if this node has a route
  if (depth === segments.length) {
    if (node.route) {
      return {
        data: node.route,
        params: copyParams(params),
        matchedPath: pathSoFar,
      };
    }
    // Check for trailing wildcard (matches empty rest)
    for (const child of node.children) {
      if (child.isWildcard && child.route) {
        const paramName = child.prefix === "*" ? "" : child.prefix.slice(1);
        if (paramName) {
          params[paramName] = "";
        } else {
          params["_wildcard"] = "";
        }
        return {
          data: child.route,
          params: copyParams(params),
          matchedPath: pathSoFar + "/*",
        };
      }
    }
    return null;
  }

  const seg = segments[depth];
  if (seg === undefined) return null;

  // 1) Static children (fast path)
  for (const child of node.children) {
    if (child.isParam || child.isWildcard) continue;
    if (child.prefix !== seg) continue;
    const found = searchNode(
      child,
      segments,
      depth + 1,
      params,
      pathSoFar + "/" + child.prefix,
    );
    if (found) return found;
  }

  // 2) Param children
  for (const child of node.children) {
    if (!child.isParam) continue;
    params[child.paramName] = decodeURIComponent(seg);
    const found = searchNode(
      child,
      segments,
      depth + 1,
      params,
      pathSoFar + "/:" + child.paramName,
    );
    if (found) return found;
    delete params[child.paramName];
  }

  // 3) Wildcard children (catch-all)
  for (const child of node.children) {
    if (!child.isWildcard) continue;
    if (!child.route) continue;
    const rest = wildcardValue(segments, depth);
    // Extract param name: "*" → "_wildcard", "*path" → "path"
    const paramName = child.prefix === "*" ? "" : child.prefix.slice(1);
    if (paramName) {
      params[paramName] = rest;
    } else {
      params["_wildcard"] = rest;
    }
    return {
      data: child.route,
      params: copyParams(params),
      matchedPath: pathSoFar + "/*",
    };
  }

  return null;
}

/** Build the wildcard value from remaining segments. */
function wildcardValue(segments: string[], depth: number): string {
  let rest = "";
  for (let i = depth; i < segments.length; i += 1) {
    const seg = segments[i];
    if (seg === undefined || seg === "") continue;
    if (rest === "") rest = seg;
    else rest += "/" + seg;
  }
  return rest;
}

/** Fast key-by-key copy of params. */
function copyParams(src: Record<string, string>): Record<string, string> {
  const dst: Record<string, string> = Object.create(null);
  for (const key in src) dst[key] = src[key]!;
  return dst;
}

// ─── Radix Tree Factory ────────────────────────────────────

/** Create a new empty radix tree root. */
export function createRadixTree(): RadixNode {
  return createNode("");
}

// ─── Build Path (still useful for programmatic URL construction) ─

/**
 * Build a path from a pattern and params.
 *
 * @example
 * ```ts
 * buildPath("/users/:id", { id: "42" });  // "/users/42"
 * ```
 */
export function buildPath(
  pattern: string,
  params: Record<string, string> = {},
): string {
  return pattern.replace(/:(\w+)/g, (_match, name: string) => {
    const value = params[name];
    if (value === undefined) {
      throw new Error(`Missing param "${name}" for pattern "${pattern}"`);
    }
    return encodeURIComponent(value);
  });
}
