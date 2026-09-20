import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";

/**
 * Mount Better Auth's catch-all request handler inside TanStack Start.
 *
 * The client uses endpoints below `/api/auth`, including email registration,
 * login, logout, and session lookup. Without this route those requests fall
 * through to the application 404 page.
 */
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: ({ request }) => auth.handler(request),
    },
  },
});
