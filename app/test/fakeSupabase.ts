// Minimal in-memory stand-in for the supabase-js query builder, just enough for the
// read paths of the data layer (select/eq/gte/lte/in/not/order/range + auth.getUser).
// Used by the parity tests to run the ORIGINAL and the REBUILT data layer on identical data.

type Row = Record<string, unknown>;
export type Tables = Record<string, Row[]>;

class Query implements PromiseLike<{ data: Row[]; error: null }> {
  private filters: ((r: Row) => boolean)[] = [];
  private orders: string[] = [];
  private from = 0;
  private to = Infinity;
  constructor(private rows: Row[]) {}
  select() { return this; }
  eq(c: string, v: unknown) { this.filters.push(r => r[c] === v); return this; }
  gte(c: string, v: string) { this.filters.push(r => String(r[c]) >= v); return this; }
  lte(c: string, v: string) { this.filters.push(r => String(r[c]) <= v); return this; }
  in(c: string, vs: unknown[]) { this.filters.push(r => vs.includes(r[c])); return this; }
  not(c: string, op: string, v: unknown) {
    if (op === "is" && v === null) this.filters.push(r => r[c] != null);
    return this;
  }
  order(c: string) { this.orders.push(c); return this; }
  range(a: number, b: number) { this.from = a; this.to = b; return this; }
  then<A, B>(ok?: ((v: { data: Row[]; error: null }) => A | PromiseLike<A>) | null, bad?: ((e: unknown) => B | PromiseLike<B>) | null) {
    let out = this.rows.filter(r => this.filters.every(f => f(r)));
    if (this.orders.length) {
      out = [...out].sort((a, b) => {
        for (const c of this.orders) {
          const x = a[c] as never, y = b[c] as never;
          if (x < y) return -1;
          if (x > y) return 1;
        }
        return 0;
      });
    }
    out = out.slice(this.from, this.to === Infinity ? undefined : this.to + 1).map(r => ({ ...r }));
    return Promise.resolve({ data: out, error: null }).then(ok, bad);
  }
}

export function fakeSupabase(tables: Tables, authUserId = "u1") {
  return {
    from: (t: string) => new Query(tables[t] ?? []),
    rpc: () => new Query([]),
    auth: {
      getUser: async () => ({ data: { user: { id: authUserId, email: "x@topas.dk", user_metadata: {} } }, error: null }),
      getSession: async () => ({ data: { session: {} } }),
    },
  };
}
