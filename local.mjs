import { createServer } from "node:http";
import { mkdir, readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { createWorker } from "./worker.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const directory = process.env.CAMPUS_DATA_DIR ? resolve(process.env.CAMPUS_DATA_DIR) : join(root, ".local");
await mkdir(directory, { recursive: true });
const sqlite = new DatabaseSync(join(directory, "campus.sqlite"));
sqlite.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
const migrations = join(root, "drizzle");
for (const file of (await readdir(migrations)).filter((name) => name.endsWith(".sql")).sort()) {
  sqlite.exec(await readFile(join(migrations, file), "utf8"));
}

function createDatabaseAdapter(database) {
  function statement(query, params = []) {
    const prepared = database.prepare(query);
    return {
      bind: (...values) => statement(query, values),
      first(column) {
        const result = prepared.get(...params);
        if (!result) return null;
        return column === undefined ? result : result[column];
      },
      all() {
        return { success: true, results: prepared.all(...params) };
      },
      run() {
        const change = prepared.run(...params);
        return { success: true, meta: { changes: change.changes, last_row_id: change.lastInsertRowid } };
      },
    };
  }
  return {
    prepare: statement,
    batch(statements) {
      database.exec("BEGIN IMMEDIATE");
      try {
        const results = statements.map((item) => item.run());
        database.exec("COMMIT");
        return results;
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

const worker = createWorker(async (filename) => {
  try {
    return await readFile(join(root, "public", filename));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
});
const port = Number(process.env.CAMPUS_PORT || 4173);
const host = process.env.CAMPUS_BIND_HOST || "127.0.0.1";
const proxyHttps = process.env.CAMPUS_HTTPS_PROXY === "1";
const env = {
  DB: createDatabaseAdapter(sqlite),
  CAMPUS_PASSWORD_ONLY: process.env.CAMPUS_PASSWORD_ONLY,
};

createServer(async (incoming, outgoing) => {
  try {
    const authority = incoming.headers.host || `${host}:${port}`;
    if (!/^(?:[a-z0-9.-]+|\[[a-f0-9:]+\])(?::\d{1,5})?$/i.test(authority) ||
        !incoming.url.startsWith("/") || incoming.url.startsWith("//") || incoming.url.includes("\\")) {
      outgoing.writeHead(400);
      outgoing.end();
      return;
    }
    const headers = new Headers(incoming.headers);
    headers.set("CF-Connecting-IP", incoming.socket.remoteAddress || "local");
    const init = { method: incoming.method, headers };
    if (incoming.method !== "GET" && incoming.method !== "HEAD") {
      init.body = Readable.toWeb(incoming);
      init.duplex = "half";
    }
    const protocol = proxyHttps ? "https" : "http";
    const request = new Request(`${protocol}://${authority}${incoming.url}`, init);
    const response = await worker.fetch(request, env);
    outgoing.statusCode = response.status;
    for (const [name, value] of response.headers) {
      if (name !== "set-cookie") outgoing.setHeader(name, value);
    }
    const cookies = response.headers.getSetCookie();
    if (cookies.length) outgoing.setHeader("set-cookie", cookies);
    if (response.body) Readable.fromWeb(response.body).pipe(outgoing);
    else outgoing.end();
  } catch (error) {
    console.error(error);
    outgoing.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    outgoing.end("Ошибка локального сервера");
  }
}).listen(port, host, () => console.log(`Listening on ${host}:${port}`));
