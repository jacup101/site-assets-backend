// Unauthenticated, cached "delivery" read path — deliberately separate
// from the authenticated /api/* "management" routes (entries.ts/
// documents.ts). Public visitors must never hit the Access login wall,
// and public traffic must not re-run a live D1 query per request.
//
// Setting a Cache-Control header alone only helps repeat requests from
// the *same* browser — it does not make Cloudflare's shared edge cache
// serve other visitors from cache. That requires explicitly using the
// Cache API (caches.default), which is what actually keeps this cheap
// under scraper load: after the first request anywhere hits this Worker,
// every other visitor hitting the same edge location for ~2 minutes gets
// served from cache without touching D1 at all.
import type { Context } from 'hono';
import { Hono } from 'hono';
import { getCollection, getDocument as getDocConfig } from '../collections/registry.ts';
import { getDocument, listEntries, siteExists } from '../db.ts';
import type { AppEnv } from '../env.ts';

export const publicReadRoute = new Hono<AppEnv>();

const CACHE_CONTROL = 'public, max-age=120, s-maxage=120';

// Called from entries.ts/documents.ts after a successful write, so a
// save shows up on the public site right away instead of waiting out
// the cache's 2-minute TTL. Note: caches.default is per-edge-location,
// not global — this clears the copy at whichever colo handled this
// write, which covers the common case (the same person checking their
// own change) without needing a real Cloudflare-API cache purge call.
export async function purgePublicCache(c: Context<AppEnv>, path: string) {
  const url = new URL(c.req.url);
  url.pathname = path;
  url.search = '';
  await caches.default.delete(new Request(url.toString(), { method: 'GET' }));
}

async function withEdgeCache(c: Context<AppEnv>, compute: () => Promise<Response>): Promise<Response> {
  const cache = caches.default;
  const cacheKey = new Request(c.req.url, { method: 'GET' });

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const response = await compute();
  if (response.ok) {
    c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));
  }
  return response;
}

publicReadRoute.get('/sites/:siteId/collections/:collectionId/entries', (c) =>
  withEdgeCache(c, async () => {
    const siteId = c.req.param('siteId');
    const collectionId = c.req.param('collectionId');

    if (!(await siteExists(c.env.DB, siteId))) {
      return c.json({ error: `Unknown site: ${siteId}` }, 404);
    }
    if (!getCollection(collectionId)) {
      return c.json({ error: `Unknown collection: ${collectionId}` }, 404);
    }

    const entries = await listEntries(c.env.DB, siteId, collectionId);
    return c.json(entries, 200, { 'Cache-Control': CACHE_CONTROL });
  })
);

publicReadRoute.get('/sites/:siteId/documents/:collectionId', (c) =>
  withEdgeCache(c, async () => {
    const siteId = c.req.param('siteId');
    const collectionId = c.req.param('collectionId');

    if (!(await siteExists(c.env.DB, siteId))) {
      return c.json({ error: `Unknown site: ${siteId}` }, 404);
    }
    if (!getDocConfig(collectionId)) {
      return c.json({ error: `Unknown document: ${collectionId}` }, 404);
    }

    const doc = await getDocument(c.env.DB, siteId, collectionId);
    return c.json(doc ?? { data: {}, updatedAt: null }, 200, { 'Cache-Control': CACHE_CONTROL });
  })
);

// Public image serving — a visitor's browser loads these directly via
// <img src>, so unlike the admin tool (which proxies the authenticated
// version through its own server) there's no way to keep this behind
// Access. Image bytes for a given key never change once uploaded, so this
// can cache aggressively and for a long time.
publicReadRoute.get('/sites/:siteId/assets/:filename', (c) =>
  withEdgeCache(c, async () => {
    const siteId = c.req.param('siteId');
    const filename = c.req.param('filename');
    const object = await c.env.ASSETS_BUCKET.get(`${siteId}/${filename}`);

    if (!object) {
      return c.json({ error: 'Asset not found.' }, 404);
    }

    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  })
);
