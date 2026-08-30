export interface Bindings {
  DB: D1Database;
  ASSETS_BUCKET: R2Bucket;
  GOOGLE_CLIENT_ID: string;
  ALLOWED_EMAILS: string;
  ADMIN_API_KEY: string;
  DEV_BYPASS_AUTH: string;
}

export interface Variables {
  userEmail?: string;
}

export type AppEnv = { Bindings: Bindings; Variables: Variables };
