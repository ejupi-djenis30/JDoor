# JDoor Assist website

The official project website for [JDoor](https://ejupi-djenis30.github.io/JDoor/). Its editorial structure
connects the project’s 2022 school origin to the later security and product rebuild, then explains
one session, the division between software checks and human approval, deliberate limits and the
current source-versus-distribution status. It never presents a browser-based remote session.

## Architecture

- `public/` contains the dependency-free HTML, CSS, browser JavaScript and generated brand assets.
- `scripts/` generates deterministic PNG assets, validates the product narrative and runs a local
  preview under the same `/JDoor/` base path used in production.
- `test/` and `e2e/` protect factual claims, responsive behavior, accessibility, metadata and the
  GitHub Pages deployment contract.

The website cannot create, join or proxy JDoor sessions. All product interactions remain in the
desktop application.

## Local verification

Use Node.js 24 and npm 11:

```bash
npm ci
npm run check
```

The full check audits locked dependencies, verifies generated assets, runs unit/content/browser
tests and validates metadata, project-relative URLs and the Pages workflow.

To inspect the site locally:

```bash
npm run preview
```

Then open `http://127.0.0.1:4175/JDoor/`.

## Asset generation

`public/favicon.svg` is the canonical source for app icons. The same generator creates the
1200 × 630 social preview and records source/output hashes in `public/social/manifest.json`.

```bash
npm run generate:assets
npm run check:assets
```

## Deployment

`.github/workflows/pages.yml` publishes only `website/public/` after `main` passes the same
website gate used by CI. The workflow uses GitHub Pages’ OIDC deployment flow and pins every
third-party action to a reviewed commit. The project has no custom domain or Cloudflare runtime.
