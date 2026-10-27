import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const fromRoot = (path) => new URL(path, import.meta.url);
const pages = ["index.html", "yun-guard/index.html", "gore-pot/index.html", "shoo-shoo/index.html"];
// Preserve installed-app and shared asset URLs alongside Vite's hashed HTML asset references.
const staticFiles = [
  "CNAME", ".nojekyll", "yun-guard/manifest.webmanifest",
  "yun-guard/icon-180.png", "yun-guard/icon-192.png", "yun-guard/icon-512.png",
  ...readdirSync(fromRoot("brand/"), { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => `brand/${entry.name}`),
];

export default defineConfig({
  appType: "mpa",
  base: "/", // 4pril.fun is hosted at the domain root.
  publicDir: false,
  server: { host: "127.0.0.1", strictPort: true },
  preview: { host: "127.0.0.1", strictPort: true },
  build: {
    target: ["es2020", "safari15", "ios15"],
    assetsInlineLimit: 0,
    sourcemap: false,
    rolldownOptions: { input: pages.map((page) => fileURLToPath(fromRoot(page))) },
  },
  worker: { format: "es" },
  plugins: [{
    name: "stable-static-assets",
    generateBundle() {
      for (const fileName of staticFiles) {
        this.emitFile({ type: "asset", fileName, source: readFileSync(fromRoot(fileName)) });
      }
    },
  }],
});
