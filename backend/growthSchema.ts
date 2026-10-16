import type { DatabaseSync } from "node:sqlite";
export function migrateGrowthSchema(db: DatabaseSync) {
  db.exec(`
CREATE TABLE IF NOT EXISTS growth_policy(id INTEGER PRIMARY KEY CHECK(id=1),min_sample INTEGER CHECK(min_sample BETWEEN 20 AND 100000),min_match_bps INTEGER CHECK(min_match_bps BETWEEN 5001 AND 10000),max_age_hours INTEGER CHECK(max_age_hours BETWEEN 1 AND 168),revision INTEGER NOT NULL DEFAULT 1,updated_by TEXT REFERENCES users(id),updated_at TEXT NOT NULL);
INSERT OR IGNORE INTO growth_policy(id,updated_at) VALUES(1,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
CREATE TABLE IF NOT EXISTS growth_access_evidence(id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES growth_orders(id),note TEXT NOT NULL,actor_id TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL);
CREATE TRIGGER IF NOT EXISTS growth_access_evidence_no_update BEFORE UPDATE ON growth_access_evidence BEGIN SELECT RAISE(ABORT,'Evidence is append-only');END;
CREATE TRIGGER IF NOT EXISTS growth_access_evidence_no_delete BEFORE DELETE ON growth_access_evidence BEGIN SELECT RAISE(ABORT,'Evidence is append-only');END;
CREATE TABLE IF NOT EXISTS growth_worker_shifts(user_id TEXT PRIMARY KEY REFERENCES users(id),available_until TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS growth_orders(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),input_json TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','REVIEW','VERIFYING','VERIFIED','QUOTED','ACCEPTED','RUNNING','EXTENSION_REQUIRED','COMPLETING','COMPLETED','CANCELLED')),revision INTEGER NOT NULL DEFAULT 1,verification_code TEXT NOT NULL,verification_expires_at TEXT,baseline_count INTEGER,observed_count INTEGER,delivered INTEGER NOT NULL DEFAULT 0 CHECK(delivered>=0),started_at TEXT,deadline_at TEXT,completed_at TEXT,quote_id TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS growth_orders_owner ON growth_orders(user_id,created_at);
CREATE INDEX IF NOT EXISTS growth_order_maintenance ON growth_orders(status,deadline_at,verification_expires_at);
CREATE TABLE IF NOT EXISTS growth_events(id INTEGER PRIMARY KEY AUTOINCREMENT,order_id TEXT NOT NULL REFERENCES growth_orders(id),event_key TEXT NOT NULL,kind TEXT NOT NULL,message TEXT NOT NULL,actor_id TEXT,created_at TEXT NOT NULL,UNIQUE(order_id,event_key));
CREATE TRIGGER IF NOT EXISTS growth_events_no_update BEFORE UPDATE ON growth_events BEGIN SELECT RAISE(ABORT,'Growth events are append-only');END;
CREATE TRIGGER IF NOT EXISTS growth_events_no_delete BEFORE DELETE ON growth_events BEGIN SELECT RAISE(ABORT,'Growth events are append-only');END;
CREATE TABLE IF NOT EXISTS growth_prices(product TEXT PRIMARY KEY CHECK(product IN('WA_GROUP','WA_CHANNEL','TG_GROUP','TG_CHANNEL')),unit_kobo INTEGER CHECK(unit_kobo IS NULL OR unit_kobo BETWEEN 1 AND 1000000),base_kobo INTEGER NOT NULL DEFAULT 0 CHECK(base_kobo BETWEEN 0 AND 100000000),urgent_bps INTEGER NOT NULL DEFAULT 10000 CHECK(urgent_bps BETWEEN 10000 AND 50000),revision INTEGER NOT NULL DEFAULT 1,updated_by TEXT REFERENCES users(id),updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS growth_service_admins(id TEXT PRIMARY KEY,label TEXT NOT NULL,phone TEXT NOT NULL,platform TEXT NOT NULL CHECK(platform IN('WA','TG')),account_id TEXT REFERENCES paired_accounts(id),enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN(0,1)),rest_until TEXT,created_at TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS growth_unique_service_phone ON growth_service_admins(platform,phone);
CREATE TABLE IF NOT EXISTS growth_assignments(id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES growth_orders(id),service_admin_id TEXT NOT NULL REFERENCES growth_service_admins(id),role TEXT NOT NULL CHECK(role IN('PRIMARY','BACKUP')),state TEXT NOT NULL CHECK(state IN('INVITED','VERIFIED','LEAVE_REQUIRED','LEFT')),assigned_at TEXT NOT NULL,expires_at TEXT NOT NULL,verified_at TEXT,left_at TEXT);
CREATE INDEX IF NOT EXISTS growth_assignments_order ON growth_assignments(order_id,assigned_at);
CREATE UNIQUE INDEX IF NOT EXISTS growth_active_admin_assignment ON growth_assignments(service_admin_id) WHERE state IN('INVITED','VERIFIED','LEAVE_REQUIRED');
CREATE TABLE IF NOT EXISTS growth_quotes(id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES growth_orders(id),order_revision INTEGER NOT NULL,price_revision INTEGER NOT NULL,amount_kobo INTEGER NOT NULL CHECK(amount_kobo BETWEEN 1 AND 10000000000),worker_budget_milli INTEGER NOT NULL CHECK(worker_budget_milli BETWEEN 1 AND 999999999999),fee_kobo INTEGER NOT NULL CHECK(fee_kobo>=0),plan_json TEXT NOT NULL,expires_at TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL);
CREATE TRIGGER IF NOT EXISTS growth_quotes_no_update BEFORE UPDATE ON growth_quotes BEGIN SELECT RAISE(ABORT,'Quotes are immutable');END;
CREATE TRIGGER IF NOT EXISTS growth_quotes_no_delete BEFORE DELETE ON growth_quotes BEGIN SELECT RAISE(ABORT,'Quotes are immutable');END;
CREATE TABLE IF NOT EXISTS growth_idempotency(user_id TEXT NOT NULL REFERENCES users(id),request_key TEXT NOT NULL,input_hash TEXT NOT NULL,order_id TEXT NOT NULL REFERENCES growth_orders(id),PRIMARY KEY(user_id,request_key));
CREATE TABLE IF NOT EXISTS growth_audiences(account_id TEXT NOT NULL,group_jid TEXT NOT NULL,country TEXT NOT NULL,sample_total INTEGER NOT NULL CHECK(sample_total>0),matching INTEGER NOT NULL CHECK(matching>=0 AND matching<=sample_total),source TEXT NOT NULL CHECK(source IN('PERMITTED_PREFIX_SAMPLE','DECLARED_AUDIENCE')),evidence_note TEXT NOT NULL,observed_at TEXT NOT NULL,recorded_by TEXT NOT NULL REFERENCES users(id),PRIMARY KEY(account_id,group_jid,country),FOREIGN KEY(account_id,group_jid) REFERENCES group_inventory(account_id,group_jid));
CREATE TABLE IF NOT EXISTS growth_requests(order_id TEXT NOT NULL REFERENCES growth_orders(id),participant_hash TEXT NOT NULL,baseline INTEGER NOT NULL CHECK(baseline IN(0,1)),qualified INTEGER NOT NULL CHECK(qualified IN(0,1)),region TEXT,status TEXT NOT NULL CHECK(status IN('PENDING','APPROVED','REJECTED','CANCELLED')),first_seen_at TEXT NOT NULL,last_seen_at TEXT NOT NULL,PRIMARY KEY(order_id,participant_hash));
CREATE TABLE IF NOT EXISTS growth_observations(id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES growth_orders(id),provider_event TEXT NOT NULL,count INTEGER NOT NULL CHECK(count>=0),observed_at TEXT NOT NULL,received_at TEXT NOT NULL,UNIQUE(order_id,provider_event));
CREATE INDEX IF NOT EXISTS growth_observations_order_time ON growth_observations(order_id,observed_at DESC);
CREATE TABLE IF NOT EXISTS growth_extensions(id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES growth_orders(id),previous_deadline TEXT NOT NULL,proposed_deadline TEXT NOT NULL,note TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES users(id),status TEXT NOT NULL DEFAULT 'OFFERED' CHECK(status IN('OFFERED','ACCEPTED','DECLINED')),created_at TEXT NOT NULL,decided_at TEXT);
CREATE UNIQUE INDEX IF NOT EXISTS growth_one_extension_offer ON growth_extensions(order_id) WHERE status='OFFERED';
CREATE TABLE IF NOT EXISTS growth_batches(id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES growth_orders(id),sequence INTEGER NOT NULL,status TEXT NOT NULL CHECK(status IN('PLANNED','RESERVED','DISPATCHED','CANCELLED')),plan_json TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(order_id,sequence));
CREATE TABLE IF NOT EXISTS growth_batch_groups(order_id TEXT NOT NULL REFERENCES growth_orders(id),group_jid TEXT NOT NULL,batch_id TEXT NOT NULL REFERENCES growth_batches(id),account_id TEXT NOT NULL REFERENCES paired_accounts(id),PRIMARY KEY(order_id,group_jid));
CREATE TABLE IF NOT EXISTS growth_payment_intents(id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES growth_orders(id),user_id TEXT NOT NULL REFERENCES users(id),provider TEXT NOT NULL CHECK(provider IN('SQUAD','KORA')),mode TEXT NOT NULL CHECK(mode='SANDBOX'),reference TEXT NOT NULL UNIQUE,amount_kobo INTEGER NOT NULL CHECK(amount_kobo>0),currency TEXT NOT NULL CHECK(currency='NGN'),status TEXT NOT NULL CHECK(status IN('CREATING','PENDING','VERIFIED','FAILED','UNKNOWN')),checkout_url TEXT,provider_reference TEXT,created_at TEXT NOT NULL,verified_at TEXT,UNIQUE(order_id,provider,mode));
`);
  for (const p of ["WA_GROUP", "WA_CHANNEL", "TG_GROUP", "TG_CHANNEL"])
    db.prepare(
      "INSERT OR IGNORE INTO growth_prices(product,updated_at) VALUES(?,?)",
    ).run(p, new Date().toISOString());
  db.prepare("INSERT OR IGNORE INTO schema_migrations VALUES(9,?)").run(
    new Date().toISOString(),
  );
}
