import { handleApi } from "./server/api.mjs";

const types = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
};

const securityHeaders = {
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self' https://chatgpt.com",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "X-Robots-Tag": "noindex, nofollow",
};

export function createWorker(readAsset) {
  return {
    async fetch(request, env) {
      const { pathname } = new URL(request.url);
      if (pathname.startsWith("/api/")) {
        if (!env.DB) {
          return Response.json({ error: "Хранилище временно недоступно." }, { status: 503 });
        }
        return handleApi(request, env);
      }
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
      }
      const filename = pathname === "/" ? "index.html" : pathname.slice(1);
      const extension = filename.split(".").at(-1);
      if (filename.split("/").some((part) => !/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(part)) ||
          !Object.hasOwn(types, extension)) {
        return notFound();
      }
      const asset = await readAsset(filename);
      if (!asset) return notFound();
      return new Response(request.method === "HEAD" ? null : asset, {
        headers: {
          ...securityHeaders,
          "Content-Type": types[extension],
          "Cache-Control": extension === "html" ? "no-store" : "public, max-age=300",
        },
      });
    },
  };
}

function notFound() {
  return new Response("Страница не найдена", {
    status: 404,
    headers: { ...securityHeaders, "Content-Type": "text/plain; charset=utf-8" },
  });
}
