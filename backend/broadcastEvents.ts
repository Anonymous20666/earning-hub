import type { Database } from "./database";
const now = () => new Date().toISOString();
export function appendBroadcastEvent(
  db: Database,
  run: string,
  key: string,
  kind: string,
  message: string,
  p?: { id?: string; group_jid?: string; subject?: string },
) {
  db.prepare(
    "INSERT OR IGNORE INTO broadcast_events(run_id,event_key,placement_id,group_jid,group_name,kind,message,created_at) VALUES(?,?,?,?,?,?,?,?)",
  ).run(
    run,
    key,
    p?.id || null,
    p?.group_jid || null,
    p?.subject || null,
    kind,
    message,
    now(),
  );
}
