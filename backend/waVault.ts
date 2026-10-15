import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { Database } from "./database";
export class WaVault {
  private key: Buffer;
  constructor(
    private db: Database,
    keyHex: string,
  ) {
    if (!/^[a-f0-9]{64}$/.test(keyHex))
      throw Error("A persistent 32-byte WhatsApp encryption key is required");
    this.key = Buffer.from(keyHex, "hex");
  }
  write(slotId: string, entry: string, value: string) {
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from(slotId + "\0" + entry));
    const encrypted = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);
    this.db
      .prepare(
        "INSERT INTO wa_vault VALUES(?,?,?) ON CONFLICT(slot_id,entry_key) DO UPDATE SET ciphertext=excluded.ciphertext",
      )
      .run(
        slotId,
        entry,
        Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64"),
      );
  }
  read(slotId: string, entry: string): string | null {
    const row = this.db
      .prepare(
        "SELECT ciphertext FROM wa_vault WHERE slot_id=? AND entry_key=?",
      )
      .get(slotId, entry) as any;
    if (!row) return null;
    const b = Buffer.from(row.ciphertext, "base64");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      b.subarray(0, 12),
    );
    decipher.setAAD(Buffer.from(slotId + "\0" + entry));
    decipher.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([
      decipher.update(b.subarray(28)),
      decipher.final(),
    ]).toString("utf8");
  }
  remove(slotId: string, entry?: string) {
    if (entry)
      this.db
        .prepare("DELETE FROM wa_vault WHERE slot_id=? AND entry_key=?")
        .run(slotId, entry);
    else this.db.prepare("DELETE FROM wa_vault WHERE slot_id=?").run(slotId);
  }
}
