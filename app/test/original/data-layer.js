// ORIGINAL data layer, de-minified from the production bundle (deploy 7334593). Reference only:
// used by src/lib/api.parity.test.ts to prove the rebuilt api.ts computes identical results.
// Free variables: Fe (supabase client).
// @ts-nocheck
/* eslint-disable */
export function makeOriginal(Fe) {
const Zv = () => new Date().toISOString().slice(0, 10);
function an(t, e = "Noget gik galt") {
  const r = (t == null ? void 0 : t.code) === "42501" ? "Databasen afviste ændringen (perioden er låst, eller du har ikke adgang)" : (t == null ? void 0 : t.message) || e,
    n = new Error(r);
  throw n.status = t == null ? void 0 : t.code, n
}
async function ht(t) {
  const {
    data: e,
    error: r
  } = await t;
  return r && an(r), e ?? []
}
const Lp = 1e3;
async function e2(t) {
  const e = [];
  for (let r = 0;; r += Lp) {
    const n = await ht(t().range(r, r + Lp - 1));
    if (e.push(...n), n.length < Lp) return e
  }
}
async function ys() {
  var s;
  const {
    data: t,
    error: e
  } = await Fe.auth.getUser();
  if (e || !(t != null && t.user)) return null;
  const r = t.user,
    n = await ht(Fe.from("employees").select("id, name, department, weekly_norm, is_admin, is_manager, hired_date").eq("auth_user_id", r.id).eq("active", !0));
  if (!n.length) return null;
  const i = n[0];
  return {
    ...i,
    can_economy: !!(i.is_admin || i.department === "Økonomi" && i.is_manager),
    must_change: !!((s = r.user_metadata) != null && s.must_change),
    email: r.email
  }
}
const at = {
  async login(t, e) {
    const {
      error: r
    } = await Fe.auth.signInWithPassword({
      email: t,
      password: e
    });
    if (r) throw new Error(/invalid login credentials/i.test(r.message) ? "Forkert mail eller password" : r.message);
    const n = await ys();
    if (!n) throw await Fe.auth.signOut(), new Error("Dit login er ikke koblet til en aktiv medarbejder — kontakt admin");
    return {
      employee: n
    }
  },
  async session() {
    const {
      data: t
    } = await Fe.auth.getSession();
    return t != null && t.session ? ys() : null
  },
  async changePassword(t) {
    const {
      error: e
    } = await Fe.auth.updateUser({
      password: t,
      data: {
        must_change: !1
      }
    });
    e && an(e)
  },
  async logout() {
    await Fe.auth.signOut()
  },
  async bootstrap() {
    const t = await ys();
    if (!t) throw new Error("Ikke logget ind");
    const e = Zv(),
      [r, n, i, s, a, o] = await Promise.all([ht(Fe.from("companies").select("id, name").eq("active", !0).order("sort").order("name")), ht(Fe.from("employee_companies").select("company_id").eq("employee_id", t.id)), ht(Fe.from("task_types").select("name").eq("active", !0).eq("department", t.department || "").order("sort").order("name")), ht(Fe.from("periods").select("id, year, month_name, start_date, end_date, locked").lte("start_date", e).gte("end_date", e)), ht(Fe.from("default_allocations").select("company_id, share").eq("employee_id", t.id)), ht(Fe.from("andet_fravaer_valg").select("id, label").eq("active", !0).order("sort"))]),
      l = new Set(n.map(u => u.company_id));
    return {
      companies: l.size ? r.filter(u => l.has(u.id)) : r,
      task_options: i.map(u => u.name),
      period: s[0] || null,
      defaults: a,
      andet_valg: o.map(u => u.label),
      today: e,
      weekly_norm: t.weekly_norm,
      employee: t
    }
  },
  async periodDays(t, e, r) {
    const n = await ys(),
      i = r || n.id,
      [s, a] = await Promise.all([ht(Fe.from("day_entries").select("work_date, location, absence_type, work_hours, absence_hours").eq("employee_id", i).gte("work_date", t).lte("work_date", e)), ht(Fe.from("allocations").select("work_date, hours").eq("employee_id", i).gte("work_date", t).lte("work_date", e))]),
      o = {};
    for (const l of a) o[l.work_date] = (o[l.work_date] || 0) + Number(l.hours);
    return {
      entries: s,
      alloc_sums: Object.entries(o).map(([l, u]) => ({
        work_date: l,
        h: u
      }))
    }
  },
  async day(t, e) {
    const r = await ys(),
      n = e || r.id,
      [i, s] = await Promise.all([ht(Fe.from("day_entries").select("work_date, location, location_note, absence_type, absence_note, absence_hours, absence_code, absence_choice, time_in, time_out, work_hours, note").eq("employee_id", n).eq("work_date", t)), ht(Fe.from("allocations").select("company_id, task_type, hours, task_note").eq("employee_id", n).eq("work_date", t).order("id"))]);
    return {
      entry: i[0] || null,
      allocations: s
    }
  },
  async saveDay(t, e) {
    const r = await ys(),
      n = {
        id: e || r.id
      },
      i = t.work_date;
    if ((await ht(Fe.from("periods").select("id").lte("start_date", i).gte("end_date", i).eq("locked", !0))).length) throw new Error("Perioden er låst af økonomi");
    if (t.day_type === "Ingen") return await ht(Fe.from("allocations").delete().eq("employee_id", n.id).eq("work_date", i).select("id")), await ht(Fe.from("day_entries").delete().eq("employee_id", n.id).eq("work_date", i).select("id")), await ht(Fe.from("form_drafts").delete().eq("employee_id", n.id).eq("work_date", i).select("employee_id")), {
      ok: !0,
      deleted: !0
    };
    const a = ["Kontor", "Andet sted", "Rejsedag"].includes(t.day_type),
      o = ["Ferie", "Egen sygdom", "Barn syg", "Øvrigt fravær"].includes(t.day_type) ? t.day_type : a && t.extra_abs || null,
      {
        error: l
      } = await Fe.from("day_entries").upsert({
        employee_id: n.id,
        work_date: i,
        location: a ? t.day_type : null,
        location_note: ["Andet sted", "Rejsedag"].includes(t.day_type) ? t.location_note : null,
        absence_type: o,
        absence_note: t.absence_note,
        absence_hours: t.absence_hours,
        absence_code: o && t.absence_code || null,
        absence_choice: o && t.absence_choice || null,
        time_in: a ? t.time_in : null,
        time_out: a ? t.time_out : null,
        work_hours: a ? t.work_hours : null,
        note: t.note,
        updated_at: new Date().toISOString()
      }, {
        onConflict: "employee_id,work_date"
      });
    l && an(l), await ht(Fe.from("allocations").delete().eq("employee_id", n.id).eq("work_date", i).select("id"));
    const u = (t.allocations || []).filter(h => h.hours && h.hours > 0).map(h => ({
      employee_id: n.id,
      work_date: i,
      company_id: h.company_id,
      task_type: h.task_type || "",
      hours: h.hours,
      task_note: h.task_note
    }));
    if (u.length) {
      const {
        error: h
      } = await Fe.from("allocations").insert(u);
      h && an(h)
    }
    return await ht(Fe.from("form_drafts").delete().eq("employee_id", n.id).eq("work_date", i).select("employee_id")), {
      ok: !0
    }
  },
  periods: () => ht(Fe.from("periods").select("id, year, month_name, start_date, end_date, locked").order("start_date")),
  async myPeriod(t, e, r) {
    const n = await ys(),
      i = r || n.id,
      [s, a, o] = await Promise.all([ht(Fe.from("day_entries").select("work_date, location, location_note, absence_type, absence_note, absence_hours, time_in, time_out, work_hours, note").eq("employee_id", i).gte("work_date", t).lte("work_date", e).order("work_date")), ht(Fe.from("allocations").select("company_id, hours, work_date").eq("employee_id", i).gte("work_date", t).lte("work_date", e)), ht(Fe.from("companies").select("id, name"))]),
      l = Object.fromEntries(o.map(p => [p.id, p.name])),
      u = {},
      h = {};
    for (const p of a) {
      const g = l[p.company_id] || `#${p.company_id}`;
      u[g] = (u[g] || 0) + Number(p.hours), h[p.work_date] = (h[p.work_date] || 0) + Number(p.hours)
    }
    return {
      entries: s,
      day_alloc: h,
      comp_sums: Object.entries(u).sort((p, g) => g[1] - p[1]).map(([p, g]) => ({
        comp: p,
        h: g
      }))
    }
  },
  async department(t, e) {
    const r = await ys(),
      n = r.can_economy && e || r.department;
    if (!n) throw new Error("Ingen afdeling");
    const [i, s, a, o] = await Promise.all([ht(Fe.rpc("department_rows", {
      p_year: t,
      p_dept: n
    })), ht(Fe.from("hour_budgets").select("company_id, period_type, hours").eq("active", !0).eq("department", n).eq("year", t)), ht(Fe.from("budget_plan").select("company_id, month, hours").eq("department", n).eq("year", t)), ht(Fe.from("companies").select("id, name"))]), l = Object.fromEntries(o.map(u => [u.id, u.name]));
    return {
      dept: n,
      rows: i.map(u => ({
        ...u,
        work_date: String(u.work_date)
      })),
      budgets: s.map(u => ({
        ...u,
        comp_name: l[u.company_id] || ""
      })),
      plan: a.map(u => ({
        ...u,
        comp_name: l[u.company_id] || ""
      }))
    }
  },
  async ecoMatrix(t, e) {
    const [r, n, i] = await Promise.all([ht(Fe.from("employees").select("id, name, department, weekly_norm, hired_date").eq("active", !0).order("name")), ht(Fe.from("day_entries").select("employee_id, work_date, location, absence_type, work_hours").gte("work_date", t).lte("work_date", e)), ht(Fe.from("allocations").select("employee_id, work_date, hours").gte("work_date", t).lte("work_date", e))]), s = {};
    for (const a of i) {
      const o = `${a.employee_id}|${a.work_date}`;
      s[o] = (s[o] || 0) + Number(a.hours)
    }
    return {
      employees: r,
      entries: n,
      alloc_sums: Object.entries(s).map(([a, o]) => {
        const [l, u] = a.split("|");
        return {
          employee_id: Number(l),
          work_date: u,
          h: o
        }
      }),
      today: Zv()
    }
  },
  async ecoBilling(t, e) {
    var F, V, W;
    const [r, n, i, s] = await Promise.all([e2(() => Fe.from("allocations").select("employee_id, company_id, hours, task_type").gte("work_date", t).lte("work_date", e).order("id")), ht(Fe.from("billing_rules").select("source_company_id, target_company_id, share").eq("active", !0)), ht(Fe.from("companies").select("id, name, kind, billing_type, expected_settlement")), ht(Fe.from("employees").select("id, name, hourly_rate, department"))]), a = Object.fromEntries(i.map(K => [K.id, K])), o = Object.fromEntries(s.map(K => [K.id, K])), l = K => Math.round(K * 100) / 100, u = new Set(i.filter(K => K.kind === "projekt" && K.billing_type === "samlet").map(K => K.id)), h = r.filter(K => !u.has(K.company_id)), p = {
      drift: {
        t: 0,
        kr: 0
      },
      projektLoebende: {
        t: 0,
        kr: 0
      },
      projektSamlet: {
        t: 0,
        kr: 0
      }
    };
    for (const K of r) {
      const te = a[K.company_id],
        oe = o[K.employee_id] || {},
        G = Number(K.hours),
        ie = G * Number(oe.hourly_rate || 0),
        Z = u.has(K.company_id) ? p.projektSamlet : (te == null ? void 0 : te.kind) === "projekt" ? p.projektLoebende : p.drift;
      Z.t += G, Z.kr += ie
    }
    for (const K of Object.values(p)) K.t = l(K.t), K.kr = Math.round(K.kr);
    const g = {},
      d = {},
      w = {};
    for (const K of h) {
      const te = a[K.company_id],
        oe = (te == null ? void 0 : te.name) || `#${K.company_id}`,
        G = o[K.employee_id] || {},
        ie = Number(K.hours),
        Z = Number(G.hourly_rate || 0);
      g[oe] = (g[oe] || 0) + ie, d[oe] = (d[oe] || 0) + ie * Z;
      const de = w[K.company_id] = w[K.company_id] || {},
        P = `${G.name||"?"}|${K.task_type||""}`,
        H = de[P] = de[P] || {
          emp: G.name || "?",
          dept: G.department || "",
          ty: K.task_type || "",
          rate: Z,
          t: 0
        };
      H.t += ie
    }
    const b = {};
    for (const K of n) {
      const te = (F = a[K.source_company_id]) == null ? void 0 : F.name,
        oe = (V = a[K.target_company_id]) == null ? void 0 : V.name;
      !te || !oe || (b[te] = b[te] || []).push({
        target: oe,
        share: Number(K.share)
      })
    }
    const A = Object.fromEntries(i.map(K => [K.name, K.kind])),
      _ = {
        ...g
      },
      S = {
        ...d
      },
      x = {
        t: 0,
        kr: 0
      };
    for (const [K, te] of Object.entries(b)) {
      const oe = g[K] || 0,
        G = d[K] || 0;
      if (oe <= 0) continue;
      let ie = 0,
        Z = 0;
      for (const de of te) _[de.target] = (_[de.target] || 0) + oe * de.share, S[de.target] = (S[de.target] || 0) + G * de.share, ie += oe * de.share, Z += G * de.share;
      _[K] = (_[K] || 0) - ie, S[K] = (S[K] || 0) - Z, A[K] === "projekt" && (x.t += ie, x.kr += Z)
    }
    const L = [...new Set([...Object.keys(g), ...Object.keys(_)])].sort().map(K => ({
        selskab: K,
        type: A[K] === "projekt" ? "projekt" : "selskab",
        reg_t: l(g[K] || 0),
        fakt_t: l(_[K] || 0),
        fakt_kr: Math.round(S[K] || 0)
      })).filter(K => K.type === "selskab" && Math.abs(K.reg_t) > .005 || Math.abs(K.fakt_t) > .005),
      J = {};
    for (const K of r) {
      if (!u.has(K.company_id)) continue;
      const te = o[K.employee_id] || {},
        oe = Number(K.hours),
        G = J[K.company_id] = J[K.company_id] || {
          t: 0,
          kr: 0
        };
      G.t += oe, G.kr += oe * Number(te.hourly_rate || 0)
    }
    const B = Object.entries(J).map(([K, te]) => ({
        selskab: a[K].name,
        expected: a[K].expected_settlement || null,
        t: l(te.t),
        kr: Math.round(te.kr)
      })).filter(K => K.t > .005).sort((K, te) => K.selskab.localeCompare(te.selskab)),
      O = {},
      I = (K, te) => (O[K] = O[K] || []).push(te);
    for (const [K, te] of Object.entries(w)) {
      const oe = ((W = a[K]) == null ? void 0 : W.name) || `#${K}`,
        G = b[oe],
        ie = G ? 1 - G.reduce((Z, de) => Z + de.share, 0) : 0;
      for (const Z of Object.values(te))
        if (G) {
          for (const de of G) I(de.target, {
            emp: Z.emp,
            dept: Z.dept,
            ty: Z.ty,
            kilde: oe,
            rate: Z.rate,
            t: l(Z.t * de.share),
            kr: Math.round(Z.t * de.share * Z.rate)
          });
          ie > .005 && I(oe, {
            emp: Z.emp,
            dept: Z.dept,
            ty: Z.ty,
            kilde: null,
            rate: Z.rate,
            t: l(Z.t * ie),
            kr: Math.round(Z.t * ie * Z.rate)
          })
        } else I(oe, {
          emp: Z.emp,
          dept: Z.dept,
          ty: Z.ty,
          kilde: null,
          rate: Z.rate,
          t: l(Z.t),
          kr: Math.round(Z.t * Z.rate)
        })
    }
    for (const K of Object.values(O)) K.sort((te, oe) => te.dept.localeCompare(oe.dept) || te.emp.localeCompare(oe.emp) || te.ty.localeCompare(oe.ty) || (te.kilde || "").localeCompare(oe.kilde || ""));
    const D = i.filter(K => K.kind === "projekt").map(K => K.id);
    let X = [];
    if (D.length) {
      const K = await e2(() => Fe.from("allocations").select("employee_id, company_id, hours, task_type, work_date").in("company_id", D).order("id")),
        te = {};
      for (const oe of K) {
        const G = o[oe.employee_id] || {},
          ie = Number(G.hourly_rate || 0),
          Z = Number(oe.hours),
          de = te[oe.company_id] = te[oe.company_id] || {
            t: 0,
            kr: 0,
            lines: {},
            mdr: {}
          };
        de.t += Z, de.kr += Z * ie;
        const P = `${G.name||"?"}|${oe.task_type||""}`,
          H = de.lines[P] = de.lines[P] || {
            emp: G.name || "?",
            dept: G.department || "",
            ty: oe.task_type || "",
            rate: ie,
            t: 0
          };
        H.t += Z;
        const Y = oe.work_date.slice(0, 7),
          ee = de.mdr[Y] = de.mdr[Y] || {
            t: 0,
            kr: 0
          };
        ee.t += Z, ee.kr += Z * ie
      }
      X = D.map(oe => {
        const G = te[oe] || {
            t: 0,
            kr: 0,
            lines: {},
            mdr: {}
          },
          ie = (b[a[oe].name] || []).map(Z => ({
            target: Z.target,
            share: Z.share
          }));
        return {
          comp: a[oe].name,
          billing: u.has(oe) ? "samlet" : "loebende",
          expected: a[oe].expected_settlement || null,
          t: l(G.t),
          kr: Math.round(G.kr),
          fordeling: ie,
          mdr: Object.entries(G.mdr).sort(([Z], [de]) => Z.localeCompare(de)).map(([Z, de]) => ({
            md: Z,
            t: l(de.t),
            kr: Math.round(de.kr)
          })),
          lines: Object.values(G.lines).map(Z => ({
            ...Z,
            t: l(Z.t),
            kr: Math.round(Z.t * Z.rate)
          })).sort((Z, de) => Z.dept.localeCompare(de.dept) || Z.emp.localeCompare(de.emp) || Z.ty.localeCompare(de.ty))
        }
      }).sort((oe, G) => oe.comp.localeCompare(G.comp))
    }
    const N = K => Object.values(K).reduce((te, oe) => te + oe, 0);
    return {
      bill: L,
      invoice: O,
      projekter: X,
      parkeret: B,
      kategorier: p,
      fordelt: {
        t: l(x.t),
        kr: Math.round(x.kr)
      },
      total: {
        reg_t: l(L.reduce((K, te) => K + te.reg_t, 0)),
        fakt_t: l(N(_)),
        fakt_kr: Math.round(N(d))
      }
    }
  },
  async ecoAbsence(t, e) {
    var p;
    const r = Number(e.slice(0, 4)),
      i = Number(e.slice(5, 7)) >= 9 ? `${r}-09-01` : `${r-1}-09-01`,
      [s, a, o] = await Promise.all([ht(Fe.from("day_entries").select("*").gte("work_date", t).lte("work_date", e).order("work_date")), ht(Fe.from("employees").select("id, name, department, weekly_norm, hired_date, payroll_number")), ht(Fe.from("day_entries").select("employee_id, absence_type, absence_hours").gte("work_date", i).lte("work_date", e).not("absence_type", "is", null))]),
      l = Object.fromEntries(a.map(g => [g.id, g])),
      u = s.map(g => {
        var d, w, b, A, _;
        return {
          ...g,
          emp_name: ((d = l[g.employee_id]) == null ? void 0 : d.name) || `#${g.employee_id}`,
          department: ((w = l[g.employee_id]) == null ? void 0 : w.department) || "",
          weekly_norm: ((b = l[g.employee_id]) == null ? void 0 : b.weekly_norm) || {},
          hired_date: ((A = l[g.employee_id]) == null ? void 0 : A.hired_date) || null,
          payroll_number: ((_ = l[g.employee_id]) == null ? void 0 : _.payroll_number) ?? null
        }
      }).sort((g, d) => g.emp_name.localeCompare(d.emp_name) || g.work_date.localeCompare(d.work_date)),
      h = {};
    for (const g of o) {
      const d = ((p = l[g.employee_id]) == null ? void 0 : p.name) || `#${g.employee_id}`,
        w = h[d] = h[d] || {
          emp_name: d,
          ferie_ytd: 0,
          syg_ytd: 0
        };
      g.absence_type === "Ferie" && (w.ferie_ytd += 1), g.absence_type === "Egen sygdom" && (w.syg_ytd += Number(g.absence_hours || 0))
    }
    return {
      entries: u,
      ytd: Object.values(h),
      ferieaar_start: i
    }
  },
  async saveDefaults(t) {
    const e = await ys();
    if (await ht(Fe.from("default_allocations").delete().eq("employee_id", e.id).select("employee_id")), t.length) {
      const {
        error: r
      } = await Fe.from("default_allocations").insert(t.map(n => ({
        employee_id: e.id,
        company_id: n.company_id,
        share: n.share
      })));
      r && an(r)
    }
  },
  async setPeriodLock(t, e) {
    const {
      error: r
    } = await Fe.from("periods").update({
      locked: e
    }).eq("id", t);
    r && an(r)
  },
  employeesAll: () => ht(Fe.from("employees").select("id, name, email, department, is_admin, is_manager, active, hourly_rate, hired_date, payroll_number, weekly_norm, flex_start, auth_user_id").order("name")),
  async saveEmployee(t, e) {
    const r = t ? Fe.from("employees").update(e).eq("id", t) : Fe.from("employees").insert(e),
      {
        error: n
      } = await r;
    n && an(n)
  },
  companiesAll: () => ht(Fe.from("companies").select("id, name, kind, billing_type, expected_settlement, active, sort").order("sort").order("name")),
  async saveCompany(t, e) {
    const r = t ? Fe.from("companies").update(e).eq("id", t) : Fe.from("companies").insert(e),
      {
        error: n
      } = await r;
    n && an(n)
  },
  taskTypesFor: t => ht(Fe.from("task_types").select("id, name, active, sort").eq("department", t).order("sort").order("name")),
  async saveTaskType(t, e) {
    const r = t ? Fe.from("task_types").update(e).eq("id", t) : Fe.from("task_types").insert(e),
      {
        error: n
      } = await r;
    n && an(n)
  },
  rulesAll: () => ht(Fe.from("billing_rules").select("id, source_company_id, target_company_id, share, active")),
  async saveRulesForSource(t, e) {
    const {
      error: r
    } = await Fe.rpc("save_billing_rules", {
      p_source_company_id: t,
      p_rules: e.map(n => ({
        target_company_id: n.target_company_id,
        share: n.share
      }))
    });
    r && an(r)
  },
  accessFor: t => ht(Fe.from("employee_companies").select("company_id").eq("employee_id", t)),
  async saveAccess(t, e, r) {
    const {
      error: n
    } = await Fe.rpc("save_employee_access", {
      p_employee_id: t,
      p_company_ids: r ? [] : e
    });
    n && an(n)
  },
  budgetsFor: t => ht(Fe.from("hour_budgets").select("id, company_id, department, period_type, hours, year, active").eq("year", t)),
  async saveBudget(t) {
    const {
      error: e
    } = await Fe.from("hour_budgets").upsert(t, {
      onConflict: "company_id,department,year"
    });
    e && an(e)
  },
  async deleteBudget(t) {
    await ht(Fe.from("hour_budgets").delete().eq("id", t).select("id"))
  },
  planFor: (t, e) => ht(Fe.from("budget_plan").select("company_id, month, hours").eq("department", t).eq("year", e)),
  async savePlan(t, e, r) {
    if (!r.length) return;
    const {
      error: n
    } = await Fe.from("budget_plan").upsert(r.map(i => ({
      company_id: i.company_id,
      department: t,
      year: e,
      month: i.month,
      hours: i.hours
    })), {
      onConflict: "company_id,department,year,month"
    });
    n && an(n)
  },
  absenceCodes: () => ht(Fe.from("absence_codes").select("code, label, source").order("sort")),
  async setAbsenceCode(t, e, r) {
    const {
      error: n
    } = await Fe.rpc("set_absence_code", {
      p_emp: t,
      p_date: e,
      p_code: r || ""
    });
    n && an(n)
  },
  approvalsForPeriod: t => ht(Fe.from("period_approvals").select("employee_id, leader_approved, economy_approved").eq("period_id", t)),
  async setLeaderApproval(t, e, r) {
    const {
      error: n
    } = await Fe.rpc("set_leader_approval", {
      p_period: t,
      p_emp: e,
      p_val: r
    });
    n && an(n)
  },
  async setEconomyApproval(t, e, r) {
    const {
      error: n
    } = await Fe.rpc("set_economy_approval", {
      p_period: t,
      p_emp: e,
      p_val: r
    });
    n && an(n)
  },
  proxyEmployees: () => ht(Fe.from("employees").select("id, name, weekly_norm, hired_date").eq("active", !0).order("name")),
  async manageLogin(t, e, r) {
    var s;
    const {
      data: n,
      error: i
    } = await Fe.functions.invoke("onboard", {
      body: {
        action: t,
        email: e,
        password: r
      }
    });
    if (i) {
      let a = i.message;
      try {
        const o = await ((s = i.context) == null ? void 0 : s.json());
        o != null && o.error && (a = o.error)
      } catch {}
      throw new Error(a)
    }
    return n
  }
};

  return { at, ys };
}

