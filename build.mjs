import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, transform } from "esbuild";

const root = dirname(fileURLToPath(import.meta.url));
const publicRoot = join(root, "public");
const output = join(root, "dist");
const content = {};

for (const file of await readdir(publicRoot, { recursive: true, withFileTypes: true })) {
  if (!file.isFile()) continue;
  const absolute = join(file.parentPath, file.name);
  const filename = absolute.slice(publicRoot.length + 1).replaceAll("\\", "/");
  const buffer = await readFile(absolute);
  const extension = filename.split(".").at(-1);
  if (extension === "css" || extension === "js") {
    const result = await transform(buffer.toString("utf8"), {
      loader: extension,
      minify: true,
      charset: "utf8",
      sourcefile: filename,
    });
    content[filename] = Buffer.from(result.code).toString("base64");
  } else {
    content[filename] = buffer.toString("base64");
  }
}

if (!content["index.html"]) throw new Error("Missing public/index.html");

await mkdir(join(output, ".openai"), { recursive: true });
const manifest = await readFile(join(root, ".openai", "hosting.json"));
await writeFile(join(output, ".openai", "hosting.json"), manifest);
await build({
  absWorkingDir: root,
  stdin: {
    contents: `import { createWorker } from "./worker.mjs";
    const files = ${JSON.stringify(content)};
    export default createWorker((name) => Object.hasOwn(files, name) ? Uint8Array.from(atob(files[name]), (c) => c.charCodeAt(0)) : null);`,
    resolveDir: root,
    sourcefile: "entry.mjs",
    loader: "js",
  },
  outfile: join(output, "server", "index.js"),
  bundle: true,
  format: "esm",
  target: "es2022",
  logLevel: "info",
});
