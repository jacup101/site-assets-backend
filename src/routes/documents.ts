import { Hono } from 'hono';
import { getDocument as getDocConfig } from '../collections/registry.ts';
import { shapeData } from '../collections/validate.ts';
import { getDocument, putDocument, siteExists } from '../db.ts';
import type { AppEnv } from '../env.ts';

export const documentsRoute = new Hono<AppEnv>();

function params(c: { req: { param(key: string): string | undefined } }) {
  return {
    siteId: c.req.param('siteId')!,
    collectionId: c.req.param('collectionId')!,
  };
}

documentsRoute.use('*', async (c, next) => {
  const { siteId, collectionId } = params(c);
  if (!(await siteExists(c.env.DB, siteId))) {
    return c.json({ error: `Unknown site: ${siteId}` }, 404);
  }
  if (!getDocConfig(collectionId)) {
    return c.json({ error: `Unknown document: ${collectionId}` }, 404);
  }
  await next();
});

documentsRoute.get('/schema', (c) => {
  const config = getDocConfig(params(c).collectionId)!;
  return c.json({ id: config.id, label: config.label, fields: config.fields });
});

documentsRoute.get('/', async (c) => {
  const { siteId, collectionId } = params(c);
  const doc = await getDocument(c.env.DB, siteId, collectionId);
  return c.json(doc ?? { data: {}, updatedAt: null });
});

documentsRoute.put('/', async (c) => {
  const { siteId, collectionId } = params(c);
  const config = getDocConfig(collectionId)!;
  const body = await c.req.json().catch(() => null);

  try {
    const data = shapeData(config.fields, body?.data);
    return c.json(await putDocument(c.env.DB, siteId, collectionId, data));
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});
