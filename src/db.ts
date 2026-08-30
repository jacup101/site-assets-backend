export interface EntryRow {
  id: string;
  site_id: string;
  collection_id: string;
  slug: string;
  sort_order: number;
  data: string;
  updated_at: number;
}

export interface EntryOut {
  slug: string;
  data: Record<string, unknown>;
  updatedAt: number;
}

export interface DocumentRow {
  site_id: string;
  collection_id: string;
  data: string;
  updated_at: number;
}

function entryId(siteId: string, collectionId: string, slug: string): string {
  return `${siteId}:${collectionId}:${slug}`;
}

function toEntryOut(row: EntryRow): EntryOut {
  return { slug: row.slug, data: JSON.parse(row.data), updatedAt: row.updated_at };
}

export async function listSites(db: D1Database) {
  const { results } = await db.prepare('SELECT id, name, created_at FROM sites ORDER BY name').all();
  return results;
}

export async function siteExists(db: D1Database, siteId: string): Promise<boolean> {
  const row = await db.prepare('SELECT 1 FROM sites WHERE id = ?').bind(siteId).first();
  return row !== null;
}

export async function listEntries(db: D1Database, siteId: string, collectionId: string): Promise<EntryOut[]> {
  const { results } = await db
    .prepare(
      'SELECT id, site_id, collection_id, slug, sort_order, data, updated_at FROM entries WHERE site_id = ? AND collection_id = ? ORDER BY sort_order'
    )
    .bind(siteId, collectionId)
    .all<EntryRow>();
  return results.map(toEntryOut);
}

export async function getEntry(
  db: D1Database,
  siteId: string,
  collectionId: string,
  slug: string
): Promise<EntryOut | null> {
  const row = await db
    .prepare('SELECT slug, data, updated_at FROM entries WHERE id = ?')
    .bind(entryId(siteId, collectionId, slug))
    .first<Pick<EntryRow, 'slug' | 'data' | 'updated_at'>>();
  return row ? { slug: row.slug, data: JSON.parse(row.data), updatedAt: row.updated_at } : null;
}

export async function createEntry(
  db: D1Database,
  siteId: string,
  collectionId: string,
  slug: string,
  data: Record<string, unknown>
): Promise<EntryOut> {
  const existing = await db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) AS maxOrder FROM entries WHERE site_id = ? AND collection_id = ?')
    .bind(siteId, collectionId)
    .first<{ maxOrder: number }>();
  const sortOrder = (existing?.maxOrder ?? -1) + 1;
  const updatedAt = Date.now();

  await db
    .prepare(
      'INSERT INTO entries (id, site_id, collection_id, slug, sort_order, data, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(entryId(siteId, collectionId, slug), siteId, collectionId, slug, sortOrder, JSON.stringify(data), updatedAt)
    .run();

  return { slug, data, updatedAt };
}

export async function updateEntry(
  db: D1Database,
  siteId: string,
  collectionId: string,
  slug: string,
  data: Record<string, unknown>
): Promise<EntryOut | null> {
  const updatedAt = Date.now();
  const result = await db
    .prepare('UPDATE entries SET data = ?, updated_at = ? WHERE id = ?')
    .bind(JSON.stringify(data), updatedAt, entryId(siteId, collectionId, slug))
    .run();
  if (result.meta.changes === 0) return null;
  return { slug, data, updatedAt };
}

export async function deleteEntry(db: D1Database, siteId: string, collectionId: string, slug: string): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM entries WHERE id = ?')
    .bind(entryId(siteId, collectionId, slug))
    .run();
  return result.meta.changes > 0;
}

export async function reorderEntries(
  db: D1Database,
  siteId: string,
  collectionId: string,
  orderedSlugs: string[]
): Promise<void> {
  const statements = orderedSlugs.map((slug, index) =>
    db
      .prepare('UPDATE entries SET sort_order = ? WHERE id = ?')
      .bind(index, entryId(siteId, collectionId, slug))
  );
  await db.batch(statements);
}

export async function getDocument(
  db: D1Database,
  siteId: string,
  collectionId: string
): Promise<{ data: Record<string, unknown>; updatedAt: number } | null> {
  const row = await db
    .prepare('SELECT data, updated_at FROM documents WHERE site_id = ? AND collection_id = ?')
    .bind(siteId, collectionId)
    .first<Pick<DocumentRow, 'data' | 'updated_at'>>();
  return row ? { data: JSON.parse(row.data), updatedAt: row.updated_at } : null;
}

export async function putDocument(
  db: D1Database,
  siteId: string,
  collectionId: string,
  data: Record<string, unknown>
): Promise<{ data: Record<string, unknown>; updatedAt: number }> {
  const updatedAt = Date.now();
  await db
    .prepare(
      `INSERT INTO documents (site_id, collection_id, data, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(site_id, collection_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
    )
    .bind(siteId, collectionId, JSON.stringify(data), updatedAt)
    .run();
  return { data, updatedAt };
}

export async function createAsset(
  db: D1Database,
  id: string,
  siteId: string,
  r2Key: string,
  contentType: string,
  width: number | null,
  height: number | null
): Promise<void> {
  await db
    .prepare(
      'INSERT INTO assets (id, site_id, r2_key, content_type, width, height, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(id, siteId, r2Key, contentType, width, height, Date.now())
    .run();
}
