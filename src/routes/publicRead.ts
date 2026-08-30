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
