interface Entry<Value> {
  promise: Promise<Value>;
  expiresAt: number;
}

/**
 * Caches each key's load, including one still in flight, so concurrent misses share one read. A
 * failed load is dropped, so the next call retries it.
 */
export class TtlCache<Value> {
  private readonly entries = new Map<string, Entry<Value>>();

  constructor(
    private readonly ttlFor: (value: Value) => number,
    private readonly now: () => number,
  ) {}

  getOrLoad(key: string, load: () => Promise<Value>): Promise<Value> {
    const cached = this.entries.get(key);
    if (cached && cached.expiresAt > this.now()) return cached.promise;

    const entry: Entry<Value> = {
      promise: load(),
      expiresAt: Number.POSITIVE_INFINITY,
    };
    this.entries.set(key, entry);
    void entry.promise.then(
      (value) => {
        entry.expiresAt = this.now() + this.ttlFor(value);
      },
      () => {
        if (this.entries.get(key) === entry) this.entries.delete(key);
      },
    );
    return entry.promise;
  }

  set(key: string, value: Value): void {
    this.entries.set(key, {
      promise: Promise.resolve(value),
      expiresAt: this.now() + this.ttlFor(value),
    });
  }
}
