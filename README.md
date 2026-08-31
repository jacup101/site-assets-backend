# site-assets-backend

A multi-tenant content backend for personal sites, running entirely on
Cloudflare (Workers + D1 + R2). Currently used for `brandon-site`'s
`post-sound` collection, via a hosted admin UI at `brandonlien.com/admin`
and a public read API the live site fetches from directly.

## Stack

- **Hono** — routing/middleware for the Worker.
- **D1** — structured content (`entries`, `documents`, `assets` tables),
  scoped by `site_id` so multiple sites can share one backend. Real sites
  today: `brandon-site` (prod) and `brandon-site-beta` (a separate,
  identically-seeded copy for testing changes before they touch prod).
- **R2** — image storage. The Worker never processes image bytes itself;
  clients compress/resize images before uploading (Canvas API in the
  browser — see brandon-site's `src/lib/compressImage.ts`), since
  `sharp`/libvips-style native image processing can't run in a Worker's
  V8 isolate.

## Two APIs, two different trust models

- **`/public/*`** — unauthenticated, open CORS, meant for a live site's
  own visitors. Cached at Cloudflare's edge (`caches.default`, 120s TTL)
  so visitor/scraper traffic doesn't re-run a D1 query per request; every
  write to `/api/*` purges the corresponding cached entry so a save shows
  up right away instead of waiting out the TTL (see the note on that
  below — it's not a full global purge).
- **`/api/*`** — authenticated. Requires `Authorization: Bearer
  <google-id-token>`, obtained by a human clicking Google's own "Sign in
  with Google" widget in a browser (see brandon-site's
  `src/pages/AdminPage.tsx`) — never a static shared secret. The Worker
  verifies the token itself, directly against Google's public keys, and
  checks the email against `ALLOWED_EMAILS`. No Cloudflare Access
  involved anywhere in this — it was tried first, then dropped, because
  Access's cookie-based session doesn't work cleanly for a browser
  calling this origin from a different site, and routing around that
  with a same-origin proxy just buried a second, unrelated credential
  (a Service Token) behind the real login instead of using it.

If something other than a signed-in browser ever needs to call `/api/*`
(a script, a cron job), it should go through the same Google-token check
— there's deliberately no back door for non-browser callers.

## Local development

```
npm install
npm run db:migrate:local
npm run dev
```

`.dev.vars` (gitignored — copy `.dev.vars.example`) sets
`DEV_BYPASS_AUTH=true`, since there's no real Google sign-in to present
locally. **Never set this in a deployed environment.**

### Why `--persist-to /tmp/...`

`npm run dev`/`db:migrate:local` point local D1/R2 state at `/tmp` rather
than the default `.wrangler/state`. If this repo lives on a network-mounted
filesystem (NFS/CIFS/SMB), SQLite's file locking doesn't work reliably
over those protocols and D1's local simulation fails with
`SQLITE_BUSY`/"database is locked" errors. Keeping local state on a real
local disk avoids that entirely. If your checkout is on a normal local
disk, this is harmless — just an arbitrary state location.

### Testing from a second device (phone, tablet)

Google's OAuth client only allows `http://localhost` as a non-HTTPS
origin — a LAN IP like `192.168.x.x` is rejected outright. If you need to
test the sign-in flow from another device during local dev, expose the
dev server over Tailscale instead, which gives it a real HTTPS origin:

```
tailscale serve --bg --https=8443 5173
```

(Pick a port other than the default 443 if you use Tailscale Serve for
other projects too — `--https=<port>` keeps this from colliding with
those.) Then add that exact origin (with port) to both:
- Google Cloud Console → the OAuth Client's Authorized JavaScript origins
- this Worker's CORS allowlist in `src/index.ts`

## Deploying for real

1. `wrangler d1 create site-assets-db` — copy the returned `database_id`
   into `wrangler.toml`.
2. `wrangler r2 bucket create site-assets`.
3. `npm run db:migrate:remote`.
4. **Google Cloud Console** → APIs & Services → Credentials → create (or
   reuse) an OAuth 2.0 Client ID. Under **Authorized JavaScript origins**,
   add every origin that will host an admin UI calling this API (e.g.
   `https://brandonlien.com`, `http://localhost:5173`). Copy the Client
   ID — it's not sensitive, it's meant to be public (it ships in the
   admin UI's own client-side bundle too).
5. Put that Client ID in `wrangler.toml`'s `[vars] GOOGLE_CLIENT_ID`.
6. `wrangler secret put ALLOWED_EMAILS` — comma-separated list of the
   Google account emails allowed to use `/api/*`, e.g.
   `you@example.com,friend@example.com`. This one *is* a secret (a
   Cloudflare secret is encrypted at rest and never committed to this
   repo) — not because the auth mechanism depends on it being hidden
   (someone knowing an allowed email still can't authenticate as that
   person), but because it's someone's real email address, and it's free
   to keep it out of a public/shared git history.
7. Add every origin that will call `/api/*` from a browser to the CORS
   allowlist in `src/index.ts` (`app.use('/api/*', cors({ origin: [...] }))`).
8. `wrangler deploy`. Leave `DEV_BYPASS_AUTH` unset (or `false`) in the
   deployed environment — it must only ever be `true` in local `.dev.vars`.

### Debugging a rejected sign-in

Since `ALLOWED_EMAILS` is a secret, it can't be read back to double-check
what you set. Instead:

```
wrangler tail
```

Then try signing in. A rejected attempt logs the exact email Google
verified (`Rejected sign-in: someone@example.com`) — safe to log, since
it's the caller's own token, not the secret — so you can compare it
byte-for-byte against what you intended, without ever exposing
`ALLOWED_EMAILS` itself.

If a request never shows up in `wrangler tail` at all despite the browser
showing a 403, that's a sign something upstream (e.g. a leftover
Cloudflare Access Application, if this was ever migrated from an
Access-based setup) is intercepting the request before it reaches this
Worker at all — check Cloudflare Zero Trust → Access → Applications for
anything still gating this Worker's routes.

## API

### `/public/*` — no auth, open CORS, cached

- `GET /public/sites/:siteId/collections/:collectionId/entries`
- `GET /public/sites/:siteId/documents/:collectionId`
- `GET /public/sites/:siteId/assets/:filename` — raw image bytes,
  cached aggressively (`max-age=31536000, immutable`) since a given key's
  bytes never change once uploaded.

### `/api/*` — requires `Authorization: Bearer <google-id-token>`

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

Collection/document schemas live in `src/collections/*.ts`, registered in
`src/collections/registry.ts`: `post-sound`, `film`, `music` (entries),
`about` (a single document). **Only `post-sound` is actually wired up to
a live client right now** (brandon-site's public `/post-sound` page and
its hosted `/admin` editor) — film/music/about have schemas defined here
for when that migration happens, but those pages/tools are still
local-only in brandon-site (`admin/` there, JSON files + git commits).

## Explicitly out of scope right now

- No admin UI in *this* repo — brandon-site's `src/pages/AdminPage.tsx`
  is the client, calling this API directly from the browser.
- No global cache purge — the purge-on-write described above only clears
  the cached copy at whichever Cloudflare edge location handled the
  write, not every edge location globally. Good enough for a low-traffic
  personal site where the person checking their own change usually hits
  the same colo; would need a real Cloudflare API cache-purge call
  (a separate API token with cache-purge permission) to be a true global
  purge, which hasn't been worth adding yet.
