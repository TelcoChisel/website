# TelcoChisel Website

Source for [telcochisel.com](https://telcochisel.com) — the Nuxt 3 documentation and marketing portal for [TelcoChiselOS](https://github.com/TelcoChisel/TelcoChiselOS).

## Develop

```bash
npm ci
npm run dev
```

## Catalog

Tool catalog SoT for the OS remains `TelcoChisel/TelcoChiselOS` → `data/tools.json`.

Before generate/deploy, CI (or you locally) refreshes the portal catalog:

```bash
npm run sync-catalog
```

That pulls `tools.json` from TelcoChiselOS `main` into `catalog/tools.json` and regenerates `data/tools.js`.

## Deploy

Pushes to `main` build the static site and publish to GitHub Pages (`telcochisel.com` via `public/CNAME`). SourceForge Project Web deploy runs when `SF_SSH_KEY` / `SF_USER` secrets are set on this repository.

### www.telcochisel.com

Canonical host is the apex (`https://telcochisel.com`). `www` should 301 there.

DNS lives in Cloudflare (zone `telcochisel.com`). Apply once:

```bash
CLOUDFLARE_API_TOKEN=... node scripts/setup-www-dns.mjs
```

Token needs **Zone DNS Edit** + **Dynamic Redirect Edit**. Manual equivalent:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| AAAA | `www` | `100::` | Proxied |

Plus a Single Redirect rule: `www.telcochisel.com` → `https://telcochisel.com${path}` (301, preserve query).
