# Changelog

All notable changes to **sinwan-router** are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/) and sinwan-router adheres to [Semantic Versioning](https://semver.org/).

## [1.1.0] — Scroll After Navigation

sinwan-router 1.1.0 adds an opt-in `scroll` option. Existing apps keep the 1.0 behaviour. Peer **sinwan >= 2.0.0 &lt; 3.0.0**.

### Added

- **`scroll: "top"` (`createRouter`, `<Routes scroll>`)**: `navigate()`, and so `Link`, `NavLink` and `useNavigate`, scrolls the window to the top. A `#hash` in the href scrolls to that element once the route has rendered, after lazy routes load. The first page load's hash is revealed the same way. Back and forward keep the browser's own scroll restoration. The default `"preserve"` does not touch scroll.
- **`NavigateOptions.scroll`**: `navigate(to, { scroll: false })` skips scroll handling for one navigation.
- **`RouterOptions` and `RouterScroll`**: Exported types. `createRouter(routes, options)` and `new Router(routes, options)` take `{ initialPath, scroll }`; a string second argument is still the initial path.

## [1.0.3] — Sinwan 2.0, NavLink `class`, and Styled 404

sinwan-router 1.0.3 targets **sinwan 2.0.0**. `Key` comes from `sinwan/control-flow`. Pair with **bun-plugin-sinwan 1.0.0**.

### Breaking

- **Peer `sinwan` is `>=2.0.0 <3.0.0`**: Sinwan 2.0 moved `Key` to `sinwan/control-flow`. The 1.0.2 range `>=1.3.3 <2.0.0` no longer matches.
- **`NavLink` `activeClass` is removed**: Active and idle styles are one `class` value. Pass a string, or `class={({ isActive }) => …}`. When `class` is omitted, an active link gets `"active"`.

### Added

- **Built-in 404 (`RouterOutlet`)**: Omitting `notFound` renders a styled page with the current path and a home link. `fallback` and `error` have matching default shells. A component you pass still wins.
- **`NavLinkClassOptions` and `NavLinkClassFunction`**: Exported from the package entry.

### Changed

- **`Link` and `NavLink` forward Slot props**: Unknown props, including `data-*`, `style`, and `onmouseleave`, reach the `<a>`. `onclick` and `onmouseenter` run after the router’s click and prefetch handlers.
- **Nested layouts stay mounted**: The `RouterOutlet` child of `<Key>` takes one argument, so the parent layout does not remount when only a child param changes.
- **Build externals**: The bundle keeps `sinwan`, `sinwan/component`, `sinwan/control-flow`, `sinwan/reactivity`, `sinwan/renderer`, and the JSX runtimes external. The build fails if the Sinwan runtime is inlined.

## [1.0.2] — NavLink `class` Without `jsxClass`

sinwan-router 1.0.2 passes `NavLink` `class` as a normal reactive attribute. Peer **sinwan >= 1.3.3 &lt; 2.0.0**.

### Fixed

- **`NavLink` class (`components.tsx`)**: Native `class` accepts a reactive value, so the router no longer uses a `jsxClass` escape hatch.

## [1.0.1] — Routes Layout Siblings

### Fixed

- **`<Routes>` layout (`jsx-routes.tsx`)**: Markup next to `<Route>` (a `<nav>`, for example) renders beside `<RouterOutlet>`, not inside the matched page only.

## [1.0.0] — Client Router

### Added

- Radix-tree matching for static segments, `:params`, and `*wildcards`.
- `createRouter`, `navigate`, `prefetch`, and `lazy`.
- `Link`, `NavLink`, `RouterOutlet`, `Routes`, and `Route`.
- Hooks: `useRouter`, `useParams`, `useSearchParams`, `useRoute`, `useNavigate`, `usePath`.
