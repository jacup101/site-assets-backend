import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCollection } from './collections/registry.ts';
import type { AppEnv } from './env.ts';
import { userAuth } from './middleware/auth.ts';
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

// The admin UI calls this directly from the browser (no proxy, no
// Cloudflare Access) — it authenticates itself with a Google ID token in
// the Authorization header instead. CORS just needs to let that header
// through from the site(s) allowed to host the admin UI; no cookies are
// involved, so `credentials: true` isn't needed here.
app.use(
  '/api/*',
  cors({
    origin: [
      'https://brandonlien.com',
      'https://www.brandonlien.com',
      'http://localhost:5173',
      // Tailscale MagicDNS name for testing the admin UI from another
      // device on the tailnet (e.g. a phone) — Google's OAuth client
      // only allows http://localhost as a JS origin, so this is how a
      // second device gets a real HTTPS origin during local dev.
      'https://dev.tail85afd5.ts.net:8443',
    ],
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })
);
app.use('/api/*', userAuth);

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
