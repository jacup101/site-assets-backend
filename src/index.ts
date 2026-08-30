import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCollection } from './collections/registry.ts';
import type { AppEnv } from './env.ts';
import { accessAuth } from './middleware/auth.ts';
import { assetsRoute } from './routes/assets.ts';
import { documentsRoute } from './routes/documents.ts';
import { entriesRoute } from './routes/entries.ts';
import { publicReadRoute } from './routes/publicRead.ts';
import { sitesRoute } from './routes/sites.ts';

const app = new Hono<AppEnv>();

// Health check stays outside Access — useful for uptime checks that can't
// authenticate, and it reveals nothing sensitive.
app.get('/health', (c) => c.json({ ok: true }));

// Public delivery API: no auth (it's public data), open CORS (any site
// can read it, same as any public API), cached (see publicRead.ts).
// Scoped to /public/* only — this must never apply to /api/*.
app.use('/public/*', cors());
app.route('/public', publicReadRoute);

app.use('/api/*', accessAuth);

app.get('/api/sites/:siteId/collections/:collectionId/schema', (c) => {
  const collectionId = c.req.param('collectionId');
  const config = getCollection(collectionId);
  if (!config) return c.json({ error: `Unknown collection: ${collectionId}` }, 404);
  return c.json({ id: config.id, label: config.label, fields: config.fields });
});

app.route('/api/sites', sitesRoute);
app.route('/api/sites/:siteId/collections/:collectionId/entries', entriesRoute);
app.route('/api/sites/:siteId/documents/:collectionId', documentsRoute);
app.route('/api/sites/:siteId/assets', assetsRoute);

app.notFound((c) => c.json({ error: 'Not found.' }, 404));

export default app;
