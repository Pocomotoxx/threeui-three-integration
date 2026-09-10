import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createReadStream, existsSync, statSync } from "node:fs";
import { join, extname, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Serve the sibling three.js-dev repository (engine examples, editor, docs,
// manual) under /tjs/ so the ThreeUI shell can embed the official three.js
// demos as one unified interface, from the same origin. Zero-dep static handler
// (sirv is not installed). Registered for BOTH the dev server and the
// production `vite preview` server, so the built app also serves /tjs/.
const THREEJS_ROOT = fileURLToPath(new URL("../three.js-dev", import.meta.url));
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".mjs": "application/javascript",
  ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".map": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".bmp": "image/bmp", ".ktx2": "image/ktx2", ".dds": "image/vnd-ms.dds",
  ".hdr": "image/vnd.radiance", ".exr": "image/x-exr", ".tga": "image/x-tga", ".basis": "application/octet-stream",
  ".mp4": "video/mp4", ".webm": "video/webm", ".ogg": "audio/ogg", ".ogv": "video/ogg", ".mp3": "audio/mpeg", ".wav": "audio/wav",
  ".glb": "model/gltf-binary", ".gltf": "model/gltf+json", ".bin": "application/octet-stream", ".drc": "application/octet-stream",
  ".fbx": "application/octet-stream", ".obj": "text/plain", ".mtl": "text/plain", ".stl": "application/octet-stream",
  ".ply": "application/octet-stream", ".3dm": "application/octet-stream", ".3mf": "application/octet-stream",
  ".ttf": "font/ttf", ".woff": "font/woff", ".woff2": "font/woff2", ".vtt": "text/vtt", ".txt": "text/plain",
};
function threejsMiddleware(req, res, next) {
  if (!req.url || !req.url.startsWith("/tjs/")) return next();
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  let rel;
  try {
    rel = decodeURIComponent(req.url.slice(4).split("?")[0].split("#")[0]);
  } catch {
    return next();
  }
  let filePath = normalize(join(THREEJS_ROOT, rel));
  if (filePath !== THREEJS_ROOT && !filePath.startsWith(THREEJS_ROOT + sep)) return next(); // no traversal
  try {
    if (existsSync(filePath) && statSync(filePath).isDirectory()) filePath = join(filePath, "index.html");
    if (!existsSync(filePath) || !statSync(filePath).isFile()) return next();
  } catch {
    return next();
  }
  res.setHeader("Content-Type", MIME[extname(filePath).toLowerCase()] || "application/octet-stream");
  res.setHeader("Cache-Control", "no-cache");
  if (req.method === "HEAD") { res.statusCode = 200; return res.end(); }
  createReadStream(filePath).on("error", () => next()).pipe(res);
}
const threejsStatic = {
  name: "threejs-engine-static",
  configureServer(server) { server.middlewares.use(threejsMiddleware); },
  configurePreviewServer(server) { server.middlewares.use(threejsMiddleware); },
};

// Serve the locally vendored three.js (public/vendor/three) with permissive CORS
// so the sandboxed, opaque-origin `srcdoc` shader iframes can load the ESM build
// and addons (classic <script src> UMD does not need this, but modules do).
// Applied to dev AND preview so the built app's ESM shader sources also work.
function vendorCorsMiddleware(req, res, next) {
  if (req.url && req.url.startsWith("/vendor/")) {
    // The sandboxed (opaque-origin) shader iframes fetch /vendor as a "public"
    // context; on a loopback host Chrome's Private Network Access blocks that
    // unless the server answers the PNA preflight. Harmless on a public host.
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Private-Network", "true");
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "*");
      res.statusCode = 204;
      return res.end();
    }
  }
  next();
}
const vendorCors = {
  name: "vendor-three-cors",
  configureServer(server) { server.middlewares.use(vendorCorsMiddleware); },
  configurePreviewServer(server) { server.middlewares.use(vendorCorsMiddleware); },
};

export default defineConfig({
  base: "/",
  plugins: [react(), vendorCors, threejsStatic],
  optimizeDeps: {
    include: ["three128", "three165"],
  },
  build: {
    sourcemap: false,
  },
});
