import type { Context, Next } from 'hono';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { AppEnv } from '../env.ts';

// One JWKS fetcher per team domain, reused across requests within the same
// Worker isolate (createRemoteJWKSet caches the fetched keys internally too).
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(teamDomain: string) {
  let jwks = jwksCache.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
    jwksCache.set(teamDomain, jwks);
  }
  return jwks;
}

/**
 * Verifies the Cf-Access-Jwt-Assertion header Cloudflare Access attaches to
 * every request that made it past the Access login wall. This is defense
 * in depth, not the primary gate — Access itself should already be
 * blocking unauthenticated requests before they ever reach this Worker.
 *
 * Set DEV_BYPASS_AUTH=true in .dev.vars (gitignored, local-only) to skip
 * this during local development, where there's no real Access session to
 * present. Never set it in a deployed environment.
 */
export async function accessAuth(c: Context<AppEnv>, next: Next) {
  if (c.env.DEV_BYPASS_AUTH === 'true') {
    await next();
    return;
  }

  const token = c.req.header('Cf-Access-Jwt-Assertion');
  if (!token) {
    return c.json({ error: 'Missing Cloudflare Access token.' }, 401);
  }

  if (!c.env.ACCESS_AUD || !c.env.ACCESS_TEAM_DOMAIN) {
    return c.json({ error: 'Access is not configured on this Worker.' }, 500);
  }

  try {
    const jwks = getJwks(c.env.ACCESS_TEAM_DOMAIN);
    const { payload } = await jwtVerify(token, jwks, {
      audience: c.env.ACCESS_AUD,
      issuer: `https://${c.env.ACCESS_TEAM_DOMAIN}`,
    });
    c.set('accessEmail', typeof payload.email === 'string' ? payload.email : undefined);
  } catch {
    return c.json({ error: 'Invalid Cloudflare Access token.' }, 401);
  }

  await next();
}
