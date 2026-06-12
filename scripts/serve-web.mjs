import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const distDir = resolve(rootDir, "dist");
const indexPath = join(distDir, "index.html");
const port = Number(process.env.PORT ?? 4173);
const hostname = "0.0.0.0";

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".woff2", "font/woff2"]
]);

const sendFile = async (response, filePath, requestPath) => {
  const fileStat = await stat(filePath);
  const cacheControl = requestPath.startsWith("/assets/")
    ? "public, max-age=31536000, immutable"
    : "no-cache";

  response.writeHead(200, {
    "Cache-Control": cacheControl,
    "Content-Length": fileStat.size,
    "Content-Type": contentTypes.get(extname(filePath)) ?? "application/octet-stream"
  });

  createReadStream(filePath).pipe(response);
};

const getSafeFilePath = (pathname) => {
  const decodedPath = decodeURIComponent(pathname);
  const filePath = resolve(distDir, `.${decodedPath}`);

  return filePath.startsWith(distDir) ? filePath : indexPath;
};

const server = createServer(async (request, response) => {
  try {
    if (!request.url) {
      response.writeHead(400).end();
      return;
    }

    const { pathname } = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);
    const filePath = getSafeFilePath(pathname);
    const fileStat = await stat(filePath).catch(() => null);

    if (fileStat?.isFile()) {
      await sendFile(response, filePath, pathname);
      return;
    }

    await sendFile(response, indexPath, "/");
  } catch (error) {
    response.writeHead(500, {
      "Content-Type": "text/plain; charset=utf-8"
    });
    response.end(error instanceof Error ? error.message : "Internal Server Error");
  }
});

server.listen(port, hostname, () => {
  console.log(`Izoh web listening on http://${hostname}:${port}`);
});
