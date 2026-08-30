CREATE TABLE sites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE entries (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  collection_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(site_id, collection_id, slug)
);

CREATE INDEX idx_entries_site_collection ON entries(site_id, collection_id, sort_order);

CREATE TABLE documents (
  site_id TEXT NOT NULL REFERENCES sites(id),
  collection_id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (site_id, collection_id)
);

CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  r2_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  created_at INTEGER NOT NULL
);

INSERT INTO sites (id, name, created_at) VALUES ('brandon-site', 'Brandon Lien Portfolio', unixepoch() * 1000);
