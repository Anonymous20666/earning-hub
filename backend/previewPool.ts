import { Worker } from "node:worker_threads";
export type PreviewImage = {
  inlineThumbnailBase64: string;
  thumbnailBase64: string;
  thumbnailWidth: number;
  thumbnailHeight: number;
};
type Job = {
  id: number;
  bytes: Buffer;
  resolve: (p: PreviewImage) => void;
  reject: (e: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
};
type Slot = { worker: Worker; job?: Job };
export class PreviewImagePool {
  private slots: Slot[] = [];
  private queue: Job[] = [];
  private serial = 0;
  private closed = false;
  readonly threads = new Set<number>();
  constructor(
    private size = 2,
    private maxQueued = 16,
    private timeoutMs = 10000,
  ) {
    if (size < 1 || size > 2)
      throw Error("Preview pool must have one or two workers");
  }
  run(bytes: Buffer): Promise<PreviewImage> {
    if (this.closed) return Promise.reject(Error("Preview workers are closed"));
    if (bytes.length > 2097152)
      return Promise.reject(Error("Preview image exceeds 2 MiB"));
    if (
      this.queue.length >= this.maxQueued &&
      this.slots.length >= this.size &&
      this.slots.every((slot) => slot.job)
    )
      return Promise.reject(Error("Preview worker queue is busy"));
    return new Promise((resolve, reject) => {
      const job: Job = { id: ++this.serial, bytes, resolve, reject };
      job.timer = setTimeout(() => {
        const n = this.queue.indexOf(job);
        if (n >= 0) this.queue.splice(n, 1);
        else {
          const slot = this.slots.find((s) => s.job === job);
          if (slot) {
            slot.job = undefined;
            this.slots = this.slots.filter((s) => s !== slot);
            void slot.worker.terminate();
          }
        }
        reject(Error("Thumbnail preparation timed out"));
        this.pump();
      }, this.timeoutMs);
      this.queue.push(job);
      this.pump();
    });
  }
  private spawn() {
    const slot: Slot = {
      worker: new Worker(new URL("./previewWorker.mjs", import.meta.url), {
        execArgv: [],
        resourceLimits: { maxOldGenerationSizeMb: 48 },
      }),
    };
    slot.worker.on("message", (message) => {
      const job = slot.job;
      if (!job || message.id !== job.id) return;
      slot.job = undefined;
      clearTimeout(job.timer);
      if (this.threads.size >= 16 && !this.threads.has(message.threadId))
        this.threads.delete(this.threads.values().next().value!);
      this.threads.add(message.threadId);
      if (message.error) job.reject(Error(message.error));
      else job.resolve(message.result);
      slot.worker.unref();
      this.pump();
    });
    const fail = () => {
      if (!this.slots.includes(slot)) return;
      this.slots = this.slots.filter((s) => s !== slot);
      if (slot.job) {
        clearTimeout(slot.job.timer);
        slot.job.reject(Error("Thumbnail worker restarted"));
        slot.job = undefined;
      }
      this.pump();
    };
    slot.worker.on("error", fail);
    slot.worker.on("exit", fail);
    slot.worker.unref();
    this.slots.push(slot);
    return slot;
  }
  private pump() {
    if (this.closed) return;
    while (this.queue.length) {
      let slot = this.slots.find((s) => !s.job);
      if (!slot) {
        if (this.slots.length >= this.size) return;
        slot = this.spawn();
      }
      const job = this.queue.shift()!;
      slot.job = job;
      slot.worker.ref();
      const bytes = Uint8Array.from(job.bytes);
      slot.worker.postMessage({ id: job.id, bytes }, [bytes.buffer]);
      job.bytes = Buffer.alloc(0);
    }
  }
  async close() {
    this.closed = true;
    for (const job of this.queue) {
      clearTimeout(job.timer);
      job.reject(Error("Preview workers closed"));
    }
    this.queue = [];
    for (const slot of this.slots) {
      if (slot.job) {
        clearTimeout(slot.job.timer);
        slot.job.reject(Error("Preview workers closed"));
      }
    }
    await Promise.all(this.slots.map((s) => s.worker.terminate()));
    this.slots = [];
  }
}
export const previewImagePool = new PreviewImagePool();
