const origin = "https://mezhdu-parami-campus.asosun4.chatgpt.site";
const routes = new Map([
  ["state", "GET"],
  ["login", "POST"],
  ["register", "POST"],
  ["logout", "POST"],
  ["requests", "POST"],
  ["notices/read", "POST"],
]);
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

function error(message, status) {
  return Response.json({ error: message, passwordRequired: true }, { status, headers });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const endpoint = url.pathname === "/api/portal"
      ? url.searchParams.get("endpoint") || ""
      : url.pathname.slice("/api/".length);
    const method = routes.get(endpoint) ??
      (/^requests\/[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(endpoint) ? "GET" : null);
    if (!method) return error("Страница не найдена.", 404);
    if (request.method !== method) return error("Метод не поддерживается.", 405);

    const caller = request.headers.get("Origin");
    if (method === "POST" && (
      (caller && caller !== url.origin) ||
      request.headers.get("Sec-Fetch-Site") === "cross-site"
    )) {
      return error("Откройте кабинет и повторите действие.", 403);
    }

    const upstreamHeaders = new Headers();
    const cookie = request.headers.get("Cookie")?.match(/(?:^|;\s*)(mp_session=[a-f0-9]{64})(?:;|$)/);
    if (cookie) upstreamHeaders.set("Cookie", cookie[1]);

    const init = { method, headers: upstreamHeaders, redirect: "error", signal: AbortSignal.timeout(9500) };
    if (method === "POST") {
      const type = request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
      if (type !== "application/json") return error("Требуется запрос в формате JSON.", 415);
      upstreamHeaders.set("Origin", origin);
      upstreamHeaders.set("Content-Type", "application/json");
      init.body = request.body;
      if (request.body) init.duplex = "half";
    }

    try {
      const upstream = await fetch(`${origin}/api/${endpoint}`, init);
      const contentType = upstream.headers.get("Content-Type");
      if (!contentType?.startsWith("application/json")) {
        return error("Кабинет временно недоступен. Попробуйте ещё раз.", 503);
      }
      const output = new Headers(headers);
      const session = upstream.headers.getSetCookie().find((value) => value.startsWith("mp_session="));
      if (session) output.set("Set-Cookie", session);
      output.set("Content-Type", contentType);
      if (upstream.status === 401 && endpoint === "state") {
        return error("Войдите в кабинет, чтобы продолжить.", 401);
      }
      return new Response(upstream.body, { status: upstream.status, headers: output });
    } catch {
      return error("Кабинет временно недоступен. Попробуйте ещё раз.", 503);
    }
  },
};
