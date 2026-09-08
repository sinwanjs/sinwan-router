/**
 * Sinwan Router — Hooks
 *
 * Reactive hooks for accessing router state inside components.
 * Must be called within a component that has a Router in context.
 */

import { inject } from "sinwan/component";
import type { InjectionKey } from "sinwan/component";
import type { Router } from "./router.ts";
import type { RouterContextValue, NavigateOptions } from "./types.ts";

/** Injection key for the router instance. */
export const RouterKey: InjectionKey<Router> = Symbol("sinwan.router");

/**
 * Access the router instance.
 *
 * @example
 * ```tsx
 * const router = useRouter();
 * router.navigate("/about");
 * ```
 */
export function useRouter(): Router {
  const router = inject(RouterKey);
  if (!router) {
    throw new Error("useRouter() called outside of a Router provider.");
  }
  return router;
}

/**
 * Get the current route parameters.
 *
 * @example
 * ```tsx
 * const params = useParams();
 * console.log(params.id);  // "42" for /users/42
 * ```
 */
export function useParams(): Record<string, string> {
  return useRouter().params;
}

/**
 * Get the current search params (query string).
 *
 * @example
 * ```tsx
 * const searchParams = useSearchParams();
 * console.log(searchParams.get("q"));  // "hello" for /search?q=hello
 * ```
 */
export function useSearchParams(): URLSearchParams {
  return useRouter().searchParams;
}

/**
 * Get the current matched route.
 *
 * @example
 * ```tsx
 * const route = useRoute();
 * if (route) {
 *   console.log(route.path, route.params);
 * }
 * ```
 */
export function useRoute() {
  return useRouter().matched;
}

/**
 * Get a navigate function.
 *
 * @example
 * ```tsx
 * const navigate = useNavigate();
 * navigate("/users/42");
 * navigate("/login", { replace: true });
 * ```
 */
export function useNavigate(): (to: string, options?: NavigateOptions) => void {
  const router = useRouter();
  return router.navigate.bind(router);
}

/**
 * Get the current path.
 *
 * @example
 * ```tsx
 * const path = usePath();
 * console.log(path);  // "/users/42"
 * ```
 */
export function usePath(): string {
  return useRouter().path;
}
