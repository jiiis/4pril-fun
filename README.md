# 4pril.fun

Browser games written in plain JavaScript, CSS, and Canvas. Vite provides the development server and production builds; it does not add a game framework.

## Development

Use Node.js 22.12+ (Node 22 LTS is used in CI), or another version accepted by `package.json`.

```bash
npm ci
npm run dev
```

Open http://127.0.0.1:5173/. Available pages:

- `/` and `/yun-guard/`: Yun Guard.
- `/gore-pot/`: Gore Pot.
- `/shoo-shoo/`: Shoo Shoo.

The source files remain readable and editable. Vite reloads the page as JavaScript changes and updates styles during development. To choose another port:

```bash
npm run dev -- --port 8001
```

Ports are strict: if the requested port is occupied, Vite exits instead of silently choosing another.

## Production build and local verification

```bash
npm run build
npm run preview
```

Open http://127.0.0.1:4173/. Preview serves the actual `dist/` output; it is for local verification, not a public production server. Deployment must publish `dist/`, not the repository source.

The build bundles and minifies JavaScript/CSS, hashes processed asset filenames, and builds the map/background worker separately. Source maps and additional obfuscation are disabled. Browser compatibility syntax targets include Safari/iOS 15 and ES2020; this does not polyfill missing browser APIs or replace device testing. Existing worker/rendering fallbacks remain in the game.

All four HTML pages are explicit build entries. Original game directories and source URLs remain available when serving the source tree. The built site retains stable manifest, app-icon, brand-image, and custom-domain files for installed apps and existing links. The HTML manifest links use `vite-ignore` to preserve the manifest's original URL, launch scope, and relative icon paths. A static-assets Vite hook copies only the explicit public files and `brand/` files; it does not copy source code or project metadata into `dist/`.

## GitHub Pages deployment

The site deploys through GitHub Actions. When setting up GitHub Pages, select **Settings → Pages → Build and deployment → Source → GitHub Actions**. This is a one-time repository setting separate from the workflow file.

`.github/workflows/deploy.yml` builds pull requests and builds/deploys `main` pushes or manual runs. It uses the committed lockfile with `npm ci`, and uploads only `dist/` for Pages. Existing `CNAME` keeps the `4pril.fun` custom-domain file in the build. Do not commit `node_modules/` or `dist/`.

The Vite base currently targets the custom-domain root. Hosting beneath a repository subpath requires updating the base and verifying all manifest and asset URLs.

## Game documentation

- [Yun Guard](yun-guard/README.md) and [balance / specialization roadmap](yun-guard/BALANCE.md).
- [Gore Pot](gore-pot/README.md).
- [Shoo Shoo](shoo-shoo/README.md).
