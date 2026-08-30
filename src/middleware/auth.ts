import type { Context, Next } from 'hono';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { AppEnv } from '../env.ts';

// Verifies Google's own ID tokens directly — no Cloudflare Access involved.
// A browser gets this token from Google's "Sign in with Google" widget
// (client-side, no server round trip to get it) and sends it as a plain
// Authorization: Bearer header on every request. We just need to confirm
// Google really issued it, for this app, and the email is one we trust.
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

async function verifyGoogleIdToken(token: string, clientId: string): Promise<string | null> {
  const { payload } = await jwtVerify(token, GOOGLE_JWKS, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: clientId,
  });
  if (payload.email_verified !== true || typeof payload.email !== 'string') return null;
  return payload.email;
}

/**
 * Accepts either:
 *  - Authorization: Bearer <google-id-token>  — a human, signed in via
 *    Google's client-side widget; verified against Google's own keys and
 *    checked against ALLOWED_EMAILS.
 *  - Authorization: Bearer <ADMIN_API_KEY>    — a trusted script (the local
 *    admin tool), which has no browser to sign in with; a plain shared
 *    secret compared directly.
 *
 * Set DEV_BYPASS_AUTH=true in .dev.vars (gitignored, local-only) to skip
 * this during local development. Never set it in a deployed environment.
 */
export async function userAuth(c: Context<AppEnv>, next: Next) {
  if (c.env.DEV_BYPASS_AUTH === 'true') {
    await next();
    return;
  }

  const header = c.req.header('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  if (!token) {
    return c.json({ error: 'Missing Authorization header.' }, 401);
  }

  if (c.env.ADMIN_API_KEY && token === c.env.ADMIN_API_KEY) {
    c.set('userEmail', 'admin-tool');
    await next();
    return;
  }

  if (!c.env.GOOGLE_CLIENT_ID || !c.env.ALLOWED_EMAILS) {
    return c.json({ error: 'Auth is not configured on this Worker.' }, 500);
  }

  try {
    const email = await verifyGoogleIdToken(token, c.env.GOOGLE_CLIENT_ID);
    const allowed = c.env.ALLOWED_EMAILS.split(',').map((e) => e.trim().toLowerCase());
    if (!email || !allowed.includes(email.toLowerCase())) {
      return c.json({ error: 'Not authorized.' }, 403);
    }
    c.set('userEmail', email);
  } catch {
    return c.json({ error: 'Invalid or expired sign-in token.' }, 401);
  }

  await next();
}
