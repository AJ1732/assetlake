export class TtlCache<Value> {
  private readonly entries = new Map<
    string,
    { value: Value; expiresAt: number }
  >();

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number,
  ) {}

  get(key: string): Value | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: Value): void {
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
  }
}
