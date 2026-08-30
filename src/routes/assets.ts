import { Hono } from 'hono';
import { createAsset, siteExists } from '../db.ts';
import type { AppEnv } from '../env.ts';

export const assetsRoute = new Hono<AppEnv>();

assetsRoute.use('*', async (c, next) => {
  const siteId = c.req.param('siteId')!;
  if (!(await siteExists(c.env.DB, siteId))) {
    return c.json({ error: `Unknown site: ${siteId}` }, 404);
  }
  await next();
});

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

// Accepts an image the client has already resized/compressed in the
// browser (Canvas-based) — this Worker never processes image bytes itself,
// it just stores whatever comes in.
assetsRoute.post('/', async (c) => {
  const siteId = c.req.param('siteId')!;
  const body = await c.req.parseBody();
  const file = body.file;

  if (!(file instanceof File)) {
    return c.json({ error: 'A "file" field with the image is required.' }, 400);
  }
  if (!file.type.startsWith('image/')) {
    return c.json({ error: 'Only image uploads are supported.' }, 400);
  }

  const id = crypto.randomUUID();
  const ext = EXTENSIONS[file.type] ?? 'bin';
  const r2Key = `${siteId}/${id}.${ext}`;

  await c.env.ASSETS_BUCKET.put(r2Key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });
  await createAsset(c.env.DB, id, siteId, r2Key, file.type, null, null);

  return c.json({ id, r2Key, contentType: file.type }, 201);
});
