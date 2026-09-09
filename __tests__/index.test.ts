import { describe, expect, test } from "bun:test";
import * as routerApi from "../src/index.ts";

describe("public API", () => {
  test("exports router, components, and hooks", () => {
    expect(typeof routerApi.createRouter).toBe("function");
    expect(typeof routerApi.lazy).toBe("function");
    expect(typeof routerApi.isLazyComponent).toBe("function");
    expect(typeof routerApi.Link).toBe("function");
    expect(typeof routerApi.NavLink).toBe("function");
    expect(typeof routerApi.RouterOutlet).toBe("function");
    expect(typeof routerApi.Route).toBe("function");
    expect(typeof routerApi.Routes).toBe("function");
    expect(typeof routerApi.collectRouteDefinitions).toBe("function");
    expect(typeof routerApi.layoutNodes).toBe("function");
    expect(typeof routerApi.isRouteElement).toBe("function");
    expect(typeof routerApi.useRouter).toBe("function");
    expect(typeof routerApi.RouterKey).toBe("symbol");
    expect(typeof routerApi.buildPath).toBe("function");
  });
});
