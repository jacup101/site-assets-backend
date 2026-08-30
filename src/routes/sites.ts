import { Hono } from 'hono';
import type { AppEnv } from '../env.ts';
import { listSites } from '../db.ts';

export const sitesRoute = new Hono<AppEnv>();

sitesRoute.get('/', async (c) => {
  const sites = await listSites(c.env.DB);
  return c.json(sites);
});
