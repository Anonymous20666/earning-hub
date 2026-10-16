import type { DatabaseSync as Database } from "node:sqlite";
export function migrateGrowthCreative(db: Database) {
  db.exec(`
CREATE TABLE IF NOT EXISTS growth_creative_assets(id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES growth_orders(id),order_revision INTEGER NOT NULL,destination TEXT NOT NULL,snapshot_hash TEXT NOT NULL,preview_json TEXT NOT NULL CHECK(length(preview_json)<=600000),quality TEXT NOT NULL CHECK(quality IN('COMPLETE','PARTIAL','UNAVAILABLE')),created_at TEXT NOT NULL,UNIQUE(order_id,order_revision,snapshot_hash));
CREATE UNIQUE INDEX IF NOT EXISTS growth_one_complete_creative_asset ON growth_creative_assets(order_id,order_revision) WHERE quality='COMPLETE';
CREATE TABLE IF NOT EXISTS growth_creative_sequences(order_id TEXT PRIMARY KEY REFERENCES growth_orders(id),engine_version INTEGER NOT NULL CHECK(engine_version=1),seed TEXT NOT NULL,next_ordinal INTEGER NOT NULL DEFAULT 0 CHECK(next_ordinal>=0));
CREATE TABLE IF NOT EXISTS growth_creative_placements(id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES growth_orders(id),group_jid TEXT NOT NULL,order_revision INTEGER NOT NULL,asset_id TEXT NOT NULL REFERENCES growth_creative_assets(id),style_index INTEGER NOT NULL,body_hash TEXT NOT NULL,render_json TEXT NOT NULL CHECK(length(render_json)<=16000),created_at TEXT NOT NULL,UNIQUE(order_id,group_jid),UNIQUE(order_id,style_index),UNIQUE(order_id,body_hash));
CREATE TRIGGER IF NOT EXISTS growth_creative_placements_no_update BEFORE UPDATE ON growth_creative_placements BEGIN SELECT RAISE(ABORT,'Allocated creative is immutable');END;
CREATE TRIGGER IF NOT EXISTS growth_creative_placements_no_delete BEFORE DELETE ON growth_creative_placements BEGIN SELECT RAISE(ABORT,'Allocated creative is immutable');END;
CREATE TRIGGER IF NOT EXISTS growth_creative_assets_no_update BEFORE UPDATE ON growth_creative_assets BEGIN SELECT RAISE(ABORT,'Preview snapshots are immutable');END;
CREATE TRIGGER IF NOT EXISTS growth_creative_assets_no_delete BEFORE DELETE ON growth_creative_assets BEGIN SELECT RAISE(ABORT,'Preview snapshots are immutable');END;
INSERT OR IGNORE INTO schema_migrations VALUES(10,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
`);
}
