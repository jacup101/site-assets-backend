export interface Bindings {
  DB: D1Database;
  ASSETS_BUCKET: R2Bucket;
  ACCESS_AUD: string;
  ACCESS_TEAM_DOMAIN: string;
  DEV_BYPASS_AUTH: string;
}

export interface Variables {
  accessEmail?: string;
}

export type AppEnv = { Bindings: Bindings; Variables: Variables };
