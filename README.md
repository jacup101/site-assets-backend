# site-assets-backend

A multi-tenant content backend for personal sites, running entirely on
Cloudflare (Workers + D1 + R2), gated by Cloudflare Access (Google OAuth +
email allowlist — no custom auth code). Currently API-only; brandon-site
(or any admin UI) is meant to be wired up to it later.

## Stack

- **Hono** — routing/middleware for the Worker.
- **D1** — structured content (`entries`, `documents`, `assets` tables),
  scoped by `site_id` so multiple sites can share one backend.
- **R2** — image storage. The Worker never processes image bytes itself;
  clients are expected to resize/compress images (e.g. via Canvas in the
  browser) before uploading, since `sharp`/libvips-style native image
  processing can't run in a Worker's V8 isolate.
- **Cloudflare Access** — auth. Configured once in the Cloudflare Zero
  Trust dashboard (not in this repo), it sits in front of the deployed
  Worker and only lets allowlisted Google-authenticated users through.
  `src/middleware/auth.ts` additionally verifies the Access JWT itself
  (defense in depth), rather than trusting Access blindly.

## Local development

```
npm install
npm run db:migrate:local
npm run dev
```

`.dev.vars` (gitignored — copy `.dev.vars.example`) sets
`DEV_BYPASS_AUTH=true`, since there's no real Access session to present
locally. **Never set this in a deployed environment.**

### Why `--persist-to /tmp/...`

`npm run dev`/`db:migrate:local` point local D1/R2 state at `/tmp` rather
than the default `.wrangler/state`. If this repo lives on a network-mounted
filesystem (NFS/CIFS/SMB — as it does in this workspace), SQLite's file
locking doesn't work reliably over those protocols and D1's local
simulation (embedded SQLite) fails with `SQLITE_BUSY`/"database is locked"
errors. Keeping local state on a real local disk avoids that entirely. If
your checkout is on a normal local disk, this is harmless — just an
arbitrary state location.

## Deploying for real

1. `wrangler d1 create site-assets-db` — copy the returned `database_id`
   into `wrangler.toml`.
2. `wrangler r2 bucket create site-assets`.
3. `npm run db:migrate:remote`.
4. `wrangler deploy`.
5. **Set up Cloudflare Access** (one-time, in the dashboard — Zero Trust →
   Access → Applications):
   - Add an Access Application pointing at this Worker's route.
   - Identity provider: Google (Zero Trust → Settings → Authentication).
   - Policy: allow rule listing exactly the two allowed email addresses.
   - Copy the Application's AUD tag and your team domain
     (`<team-name>.cloudflareaccess.com`).
6. `wrangler secret put ACCESS_AUD` and `wrangler secret put ACCESS_TEAM_DOMAIN`
   with the values from step 5. Leave `DEV_BYPASS_AUTH` unset (or `false`)
   in the deployed environment — it must only ever be `true` in local
   `.dev.vars`.

## API

All routes below are under `/api` and require a valid Cloudflare Access
session (or `DEV_BYPASS_AUTH=true` locally).

- `GET /api/sites`
- `GET /api/sites/:siteId/collections/:collectionId/schema`
- `GET /api/sites/:siteId/collections/:collectionId/entries`
- `POST /api/sites/:siteId/collections/:collectionId/entries` — body: `{ slug, data }`
- `PUT /api/sites/:siteId/collections/:collectionId/entries/:slug` — body: `{ data }`
- `DELETE /api/sites/:siteId/collections/:collectionId/entries/:slug`
- `PUT /api/sites/:siteId/collections/:collectionId/entries/reorder` — body: `{ order: string[] }` (all current slugs, in the new order)
- `GET /api/sites/:siteId/documents/:collectionId/schema`
- `GET /api/sites/:siteId/documents/:collectionId`
- `PUT /api/sites/:siteId/documents/:collectionId` — body: `{ data }`
- `POST /api/sites/:siteId/assets` — multipart form, field `file` (an already-compressed image)

Collections today: `post-sound`, `film`, `music` (list-based, via
`entries`); `about` (single document, via `documents`). Field schemas live
in `src/collections/*.ts`, ported from brandon-site's local admin tool
(`admin/server/collections.ts`) so the data shape matches exactly.

## Explicitly out of scope right now

- No admin UI yet — verify the API with curl/a REST client for now.
- No public read path / caching strategy for how a live site would
  actually serve this content to visitors — that's a "connect this to
  brandon-site" decision to make later, once this backend is proven out.
  The plan is for the public site to keep serving static/cached assets
  either way, so visitor traffic never hits this Worker/D1/R2 directly.
