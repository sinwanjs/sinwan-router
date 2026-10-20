/**
 * Parent layout must stay mounted when only the child route changes.
 * A zero-arity Key child getter remounts the layout on every matched update.
 */
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { Window } from "happy-dom";
import { cc, provide } from "sinwan/component";
import { render } from "sinwan/renderer";
import { createRouter } from "../src/router.ts";
import { RouterOutlet } from "../src/components.tsx";
import { RouterKey } from "../src/hooks.ts";
import { flushSync } from "sinwan/reactivity";

describe("RouterOutlet nested layout stability", () => {
  let windowRef: Window;

  beforeEach(() => {
    windowRef = new Window({ url: "http://localhost/components/a" });
    (globalThis as unknown as { window: unknown }).window = windowRef;
    (globalThis as unknown as { document: unknown }).document =
      windowRef.document;
  });

  afterEach(() => {
    windowRef.happyDOM.abort();
    delete (globalThis as unknown as { window?: unknown }).window;
    delete (globalThis as unknown as { document?: unknown }).document;
  });

  test("does not remount the parent layout when navigating between children", () => {
    let layoutMounts = 0;
    const Layout = cc(() => {
      layoutMounts += 1;
      return (
        <div data-layout="">
          <aside data-sidebar="">nav</aside>
          <RouterOutlet depth={1} />
        </div>
      );
    });
    const PageA = cc(() => <div data-page="a">A</div>);
    const PageB = cc(() => <div data-page="b">B</div>);

    const router = createRouter(
      [
        {
          path: "/",
          component: Layout,
          children: [
            { path: "components/a", component: PageA },
            { path: "components/b", component: PageB },
          ],
        },
      ],
      "/components/a",
    );

    const App = cc(() => {
      provide(RouterKey, router);
      return <RouterOutlet />;
    });

    const root = document.createElement("div");
    document.body.appendChild(root);
    render(<App />, root);
    flushSync();

    const sidebar = document.querySelector("[data-sidebar]") as HTMLElement;
    expect(sidebar).toBeTruthy();
    sidebar.setAttribute("data-probe", "keep");
    expect(layoutMounts).toBe(1);
    expect(document.querySelector("[data-page]")?.getAttribute("data-page")).toBe(
      "a",
    );

    router.navigate("/components/b");
    flushSync();

    expect(layoutMounts).toBe(1);
    expect(document.querySelector("[data-probe='keep']")).toBe(sidebar);
    expect(document.querySelector("[data-page]")?.getAttribute("data-page")).toBe(
      "b",
    );
  });
});
