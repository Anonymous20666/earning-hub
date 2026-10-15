// Socket-scoped encrypted upload metadata: never share keys between accounts.
export class PreviewUploadCache {
  private sockets = new WeakMap<
    object,
    Map<string, { at: number; pending: boolean; promise: Promise<any> }>
  >();
  private cooldowns = new WeakMap<object, Map<string, number>>();
  constructor(
    private now = Date.now,
    private ttl = 30 * 60000,
    private retryAfter = 30000,
  ) {}
  async get(socket: object, key: string, upload: () => Promise<any>) {
    let cache = this.sockets.get(socket);
    if (!cache) {
      cache = new Map();
      this.sockets.set(socket, cache);
    }
    let failures = this.cooldowns.get(socket);
    if (!failures) {
      failures = new Map();
      this.cooldowns.set(socket, failures);
    }
    if ((failures.get(key) || 0) > this.now()) return;
    for (const [k, entry] of cache)
      if (!entry.pending && entry.at + this.ttl <= this.now()) cache.delete(k);
    let entry = cache.get(key);
    if (!entry) {
      while (cache.size >= 30) {
        const evict = [...cache].find(([, v]) => !v.pending);
        if (!evict) return;
        cache.delete(evict[0]);
      }
      entry = { at: 0, pending: true, promise: Promise.resolve(undefined) };
      cache.set(key, entry);
      const current = entry;
      let timer: ReturnType<typeof setTimeout> | undefined;
      current.promise = Promise.race([
        Promise.resolve().then(upload),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(Error("Thumbnail upload timed out")),
            16000,
          );
        }),
      ])
        .then((image) => {
          if (
            !image ||
            typeof image.directPath !== "string" ||
            !image.directPath.startsWith("/") ||
            !["mediaKey", "fileSha256", "fileEncSha256"].every(
              (field) =>
                image[field] instanceof Uint8Array &&
                image[field].length === 32,
            )
          )
            throw Error("Incomplete thumbnail upload");
          current.at = this.now();
          current.pending = false;
          failures!.delete(key);
          return image;
        })
        .catch(() => {
          if (cache!.get(key) === current) cache!.delete(key);
          if (failures!.size >= 64)
            failures!.delete(failures!.keys().next().value!);
          failures!.set(key, this.now() + this.retryAfter);
          return undefined;
        })
        .finally(() => clearTimeout(timer));
    }
    cache.delete(key);
    cache.set(key, entry);
    return entry.promise;
  }
  clear() {
    this.sockets = new WeakMap();
    this.cooldowns = new WeakMap();
  }
}
