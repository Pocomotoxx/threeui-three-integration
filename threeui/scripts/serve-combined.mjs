#!/usr/bin/env node
// Zero-dependency production server for the unified ThreeUI + three.js interface.
//
// Serves:
//   /            -> threeui/dist         (the built ThreeUI app, with SPA fallback)
//   /tjs/*       -> three.js-dev         (official examples, editor, docs, manual)
//   /vendor/*    -> (inside dist) with Access-Control-Allow-Origin: * so the
//                   sandboxed srcdoc shader iframes can load the ESM three build.
//
// Usage:  node scripts/serve-combined.mjs [-p <port>]   (default 4173)
// Requires a prior `npm run build:site` so that dist/ exists.

import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { join, extname, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = fileURLToPath(new URL("../dist", import.meta.url));
const THREEJS_ROOT = fileURLToPath(new URL("../../three.js-dev", import.meta.url));
const portArg = process.argv.indexOf("-p");
const PORT = Number(portArg !== -1 ? process.argv[portArg + 1] : process.env.PORT) || 4173;

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

function resolveSafe(root, rel) {
  const p = normalize(join(root, rel));
  if (p !== root && !p.startsWith(root + sep)) return null; // traversal guard
  return p;
}

function sendFile(res, filePath) {
  res.setHeader("Content-Type", MIME[extname(filePath).toLowerCase()] || "application/octet-stream");
  createReadStream(filePath).on("error", () => { res.statusCode = 500; res.end("Read error"); }).pipe(res);
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent((req.url || "/").split("?")[0].split("#")[0]);
  } catch {
    res.statusCode = 400; return res.end("Bad Request");
  }

  // /vendor is fetched by the sandboxed (opaque-origin) shader iframes. On a
  // loopback host that trips Chrome's Private Network Access: answer the PNA
  // preflight and advertise private-network access. Harmless on a public host.
  const isVendor = pathname.startsWith("/vendor/");
  if (isVendor) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Private-Network", "true");
  }
  if (req.method === "OPTIONS") {
    if (isVendor) {
      res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "*");
      res.statusCode = 204;
      return res.end();
    }
    res.statusCode = 405; return res.end("Method Not Allowed");
  }
  if (req.method !== "GET" && req.method !== "HEAD") { res.statusCode = 405; return res.end("Method Not Allowed"); }

  // three.js engine tree
  if (pathname.startsWith("/tjs/") || pathname === "/tjs") {
    let filePath = resolveSafe(THREEJS_ROOT, pathname.replace(/^\/tjs/, "") || "/");
    if (!filePath) { res.statusCode = 403; return res.end("Forbidden"); }
    if (existsSync(filePath) && statSync(filePath).isDirectory()) filePath = join(filePath, "index.html");
    if (existsSync(filePath) && statSync(filePath).isFile()) return sendFile(res, filePath);
    res.statusCode = 404; return res.end("Not Found");
  }

  // built ThreeUI app (dist)
  if (pathname.startsWith("/vendor/")) res.setHeader("Access-Control-Allow-Origin", "*");
  let filePath = resolveSafe(DIST, pathname);
  if (!filePath) { res.statusCode = 403; return res.end("Forbidden"); }
  if (existsSync(filePath) && statSync(filePath).isDirectory()) filePath = join(filePath, "index.html");
  if (existsSync(filePath) && statSync(filePath).isFile()) return sendFile(res, filePath);

  // SPA fallback: serve index.html for client-routed paths (e.g. /threejs)
  const index = join(DIST, "index.html");
  if (existsSync(index)) { res.setHeader("Content-Type", MIME[".html"]); return sendFile(res, index); }
  res.statusCode = 404; res.end("Not Found");
});

server.listen(PORT, () => {
  if (!existsSync(DIST)) {
    console.warn(`⚠ dist/ not found at ${DIST} — run "npm run build:site" first.`);
  }
  console.log(`Unified ThreeUI + three.js server running at http://localhost:${PORT}/`);
  console.log(`  app:    http://localhost:${PORT}/`);
  console.log(`  engine: http://localhost:${PORT}/threejs  (examples/editor/docs/manual)`);
});
