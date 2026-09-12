<div align="left">
  <table border="0" width="100%" align="center">
    <tr>
      <td width="150" align="left">
        <img src="https://avatars.githubusercontent.com/u/252437356?s=400&v=4" alt="Sinwan Logo" width="150" />
      </td>
      <td align="left">
        <h1>Sinwan Router</h1>
        <p>Client-side router for Sinwan apps — declarative matching, params, lazy loading, and prefetching on Sinwan's reactivity system.</p>
        <p>
          <a href="https://github.com/sinwanjs/sinwan-router/stargazers"><img src="https://img.shields.io/github/stars/sinwanjs/sinwan-router.svg?color=ffce3b&label=stars&logo=github" alt="GitHub stars" /></a>
          <a href="https://www.npmjs.com/package/sinwan-router"><img src="https://img.shields.io/npm/dm/sinwan-router?color=42b883&label=downloads&logo=npm" alt="NPM Downloads" /></a>
          <a href="https://www.npmjs.com/package/sinwan-router"><img src="https://img.shields.io/npm/l/sinwan-router?color=35495e&label=license" alt="License" /></a>
        </p>
      </td>
    </tr>
  </table>
</div>

<br clear="both" />

Sinwan Router matches paths with a radix tree (no regex compilation), keeps route state in signals, and remounts only the outlet depth that actually changed.

## Why Sinwan Router?

- **Radix-tree matching** — static segments, `:params`, and `*wildcards` in O(depth). Static routes win over params; params win over catch-alls.
- **Fine-grained reactivity** — `path`, `matched`, `params`, and `searchParams` are signals/computeds. Navigation updates the DOM that reads them.
- **Nested outlets** — parent layouts stay mounted when only a child param changes. Key identity is depth-local, not the full URL.
- **Lazy routes + prefetch** — `() => import("./Page")` or `lazy(...)`. `Link` prefetch and `RouterOutlet` share one per-router cache.
- **Browser-safe links** — `Link` leaves `_blank`, `download`, modifier clicks (`ctrl` / `meta` / `shift` / `alt`), external URLs, and same-page hashes to the browser.

Peer dependency: **sinwan >= 1.3.3** (reactive native JSX attributes; `<Key>` remounts when `cache` is omitted).

## Install

```sh
npm install sinwan-router sinwan
```

```sh
bun add sinwan-router sinwan
```

JSX still comes from Sinwan:

```jsonc
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "sinwan",
  },
}
```

## Quick Start

```tsx
import { cc, provide } from "sinwan/component";
import {
  createRouter,
  RouterKey,
  RouterOutlet,
  Link,
  NavLink,
} from "sinwan-router";

const router = createRouter([
  { path: "/", component: Home },
  { path: "/users/:id", component: UserProfile },
  { path: "/about", component: () => import("./About.tsx") },
]);

const App = cc(() => {
  provide(RouterKey, router);
  return (
    <div>
      <nav>
        <Link href="/">Home</Link>
        <NavLink href="/about" activeClass="active">
          About
        </NavLink>
      </nav>
      <RouterOutlet />
    </div>
  );
});
```

There is no `RouterProvider` component. Provide the instance with `provide(RouterKey, router)` so hooks and outlet components can `inject` it. Or declare routes in JSX with `<Routes>` / `<Route>` — same fields as `RouteDefinition`.

## JSX routes

`<Route>` uses the native route fields: `path`, `component`, `children`, and `meta`. Nested `<Route>` elements become `children` on the parent definition.

```tsx
import { Routes, Route, Link } from "sinwan-router";

const App = cc(() => (
  <Routes>
    <nav>
      <Link href="/">Home</Link>
      <Link href="/users/1">Profile</Link>
    </nav>
    <Route path="/" component={Home} />
    <Route path="/users/:id" component={UserProfile} />
    <Route path="/app" component={AppLayout} meta={{ title: "App" }}>
      <Route path="/" component={AppIndex} />
      <Route path="settings" component={Settings} />
    </Route>
  </Routes>
));
```

`Routes` collects `<Route>` children into a router, provides `RouterKey` to layout siblings (`Link`, `NavLink`), and renders a `<RouterOutlet />`. Put links **inside** `<Routes>` — they need that context. You can still pass `fallback`, `notFound`, `error`, and `initialPath`.

## Routes

```ts
import { createRouter, lazy } from "sinwan-router";

const router = createRouter([
  { path: "/", component: Home },
  { path: "/users/:id", component: UserProfile },
  { path: "/files/*path", component: Files },
  {
    path: "/app",
    component: AppLayout,
    children: [
      { path: "/", component: AppIndex },
      { path: "settings", component: Settings },
    ],
  },
  { path: "/*", component: NotFound },
]);
```

- `/:id` — named param, URI-decoded, available from `useParams()`.
- `/*` or `/*path` — catch-all. Unnamed wildcards land in `params._wildcard`.
- Nested `children` join onto the parent path. A child `path: "/"` is an index route.
- Route components are not passed params as props. Read them with hooks.

Zero-arg factories (`() => import("./Page")`) are treated as lazy loaders. Functions that take props are treated as components. You can also brand a loader:

```ts
{ path: "/admin", component: lazy(() => import("./Admin.tsx")) }
```

## Navigation

```ts
router.navigate("/users/42");
router.navigate("/login", { replace: true, state: { from: router.path } });
router.prefetch("/about");
router.dispose();
```

`prefetch` and `RouterOutlet` share the same instance cache. `dispose()` removes the `popstate` listener and drops that cache.

```tsx
<Link href="/users/1" class="nav">
  Profile
</Link>

<Link href="https://sinwanjs.com" target="_blank" rel="noreferrer">
  Docs
</Link>

<NavLink href="/users" activeClass="active" class="nav">
  Users
</NavLink>
```

`NavLink` is active on an exact match or a nested prefix (`/users` matches `/users/42`). Prefetch on hover is on by default; pass `prefetch={false}` to disable.

## Outlet

```tsx
<RouterOutlet />
<RouterOutlet depth={1} fallback={Loading} notFound={NotFound} error={LoadError} />
```

| Prop        | Role                                                                 |
| ----------- | -------------------------------------------------------------------- |
| `depth`     | `0` is the root match; `1` is the first nested child, and so on     |
| `fallback`  | Shown while a lazy import is in flight                               |
| `notFound`  | Shown at depth `0` when nothing matches; nested outlets render nothing |
| `error`     | Shown when a lazy import rejects (`{ error?: unknown }` props)       |

Put `<RouterOutlet depth={1} />` inside a parent layout to render the child.

## Hooks

All hooks require `provide(RouterKey, router)` on an ancestor.

```tsx
import {
  useRouter,
  useParams,
  useSearchParams,
  useRoute,
  useNavigate,
  usePath,
} from "sinwan-router";

const params = useParams();           // { id: "42" }
const search = useSearchParams();     // URLSearchParams
const path = usePath();               // "/users/42"
const route = useRoute();             // MatchedRoute | null
const navigate = useNavigate();
navigate("/about", { replace: true });
```

## Features

- Radix-tree matcher: `createRadixTree`, `radixInsert`, `radixSearch`, `buildPath`, `normalizePath`
- Router: `createRouter`, `navigate`, `prefetch`, `resolveComponent`, `dispose`, `lazy` / `isLazyComponent`
- Components: `Link`, `NavLink`, `RouterOutlet`, `Routes`, `Route`
- Hooks: `useRouter`, `useParams`, `useSearchParams`, `useRoute`, `useNavigate`, `usePath`, `RouterKey`

## Documentation

- [Documentation v1](https://sinwanjs.com)
- [Sinwan](https://github.com/sinwanjs/sinwan)

## Development

```sh
bun test
bun run typecheck
bun run build
```

## Author

Mohammed Ben Cheikh

## License

MIT
