import { Hono } from 'hono';
import { getCollection } from '../collections/registry.ts';
import { shapeData } from '../collections/validate.ts';
import { createEntry, deleteEntry, listEntries, reorderEntries, siteExists, updateEntry } from '../db.ts';
import type { AppEnv } from '../env.ts';
import { purgePublicCache } from './publicRead.ts';

export const entriesRoute = new Hono<AppEnv>();

// Hono only infers strongly-typed path params via its chained route-builder
// generics, which this app doesn't use — params are asserted non-null here
// since these handlers are only ever reached via routes containing them.
function params(c: { req: { param(key: string): string | undefined } }) {
  return {
    siteId: c.req.param('siteId')!,
    collectionId: c.req.param('collectionId')!,
  };
}

entriesRoute.use('*', async (c, next) => {
  const { siteId, collectionId } = params(c);
  if (!(await siteExists(c.env.DB, siteId))) {
    return c.json({ error: `Unknown site: ${siteId}` }, 404);
  }
  if (!getCollection(collectionId)) {
    return c.json({ error: `Unknown collection: ${collectionId}` }, 404);
  }
  await next();
});

entriesRoute.get('/', async (c) => {
  const { siteId, collectionId } = params(c);
  return c.json(await listEntries(c.env.DB, siteId, collectionId));
});

entriesRoute.post('/', async (c) => {
  const { siteId, collectionId } = params(c);
  const config = getCollection(collectionId)!;
  const body = await c.req.json().catch(() => null);

  if (!body || typeof body.slug !== 'string' || !body.slug.trim()) {
    return c.json({ error: 'slug is required.' }, 400);
  }

  try {
    const data = shapeData(config.fields, body.data);
    const entry = await createEntry(c.env.DB, siteId, collectionId, body.slug.trim(), data);
    c.executionCtx.waitUntil(purgePublicCache(c, `/public/sites/${siteId}/collections/${collectionId}/entries`));
    return c.json(entry, 201);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

// Registered before '/:slug' — Hono's router prefers static matches
// regardless of order, but keep the safer explicit ordering anyway.
entriesRoute.put('/reorder', async (c) => {
  const { siteId, collectionId } = params(c);
  const body = await c.req.json().catch(() => null);

  if (!body || !Array.isArray(body.order) || !body.order.every((s: unknown) => typeof s === 'string')) {
    return c.json({ error: 'order must be an array of entry slugs.' }, 400);
  }

  const current = await listEntries(c.env.DB, siteId, collectionId);
  const currentSlugs = new Set(current.map((e) => e.slug));
  if (body.order.length !== current.length || !body.order.every((s: string) => currentSlugs.has(s))) {
    return c.json({ error: 'order must contain exactly the current entry slugs, each once.' }, 400);
  }

  await reorderEntries(c.env.DB, siteId, collectionId, body.order);
  c.executionCtx.waitUntil(purgePublicCache(c, `/public/sites/${siteId}/collections/${collectionId}/entries`));
  return c.json(await listEntries(c.env.DB, siteId, collectionId));
});

entriesRoute.put('/:slug', async (c) => {
  const { siteId, collectionId } = params(c);
  const slug = c.req.param('slug')!;
  const config = getCollection(collectionId)!;
  const body = await c.req.json().catch(() => null);

  try {
    const data = shapeData(config.fields, body?.data);
    const updated = await updateEntry(c.env.DB, siteId, collectionId, slug, data);
    if (!updated) return c.json({ error: 'Entry not found.' }, 404);
    c.executionCtx.waitUntil(purgePublicCache(c, `/public/sites/${siteId}/collections/${collectionId}/entries`));
    return c.json(updated);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

entriesRoute.delete('/:slug', async (c) => {
  const { siteId, collectionId } = params(c);
  const slug = c.req.param('slug')!;
  const removed = await deleteEntry(c.env.DB, siteId, collectionId, slug);
  if (!removed) return c.json({ error: 'Entry not found.' }, 404);
  c.executionCtx.waitUntil(purgePublicCache(c, `/public/sites/${siteId}/collections/${collectionId}/entries`));
  return c.json({ ok: true });
});
