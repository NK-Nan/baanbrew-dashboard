// Lab 4.2 · ใช้ Claude Code เขียนฟังก์ชันที่ยังว่าง (Prompt 4.2A ใน PROMPTS_LAB4.md) จนกว่า npm test จะผ่าน · ห้ามแก้ไฟล์ test
// Lab 4.2 · Cohort retention รายเดือน
// cohort = เดือนแรกที่ลูกค้าสมาชิกซื้อ · retention[k] = สัดส่วนลูกค้าใน cohort ที่กลับมาซื้อในเดือนที่ k (k=0 คือเดือนแรก = 100%)
//
// หมายเหตุเรื่องวันที่: ไม่ใช้ toISOString() กับวันที่ไทย เพราะแปลงเป็น UTC แล้ววันเลื่อน
// (เช่น 2026-08-01 00:30 เวลาไทย = 2026-07-31T17:30Z → ตกไปเดือน ก.ค.)
// จึงตัดปี-เดือนจากสตริงตรง ๆ และถ้าเป็น Date object ใช้ getter แบบ local

const pad2 = (n) => String(n).padStart(2, "0");

/** แปลงค่าวันที่ (สตริง "YYYY-MM-DD..." หรือ Date) เป็น { y, m, d } โดยไม่ผ่าน UTC */
function parseYMD(v) {
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return { y: v.getFullYear(), m: v.getMonth() + 1, d: v.getDate() };
  }
  const mt = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/.exec(String(v ?? "").trim());
  if (!mt) return null;
  return { y: +mt[1], m: +mt[2], d: mt[3] ? +mt[3] : 1 };
}

/** "YYYY-MM" ของค่าวันที่ หรือ null ถ้าอ่านไม่ได้ */
function monthKey(v) {
  const p = parseYMD(v);
  return p ? `${p.y}-${pad2(p.m)}` : null;
}

/** จำนวนวันในเดือน (Date.UTC ใช้ได้เพราะเป็นการคำนวณปฏิทินล้วน ไม่เกี่ยวกับโซนเวลา) */
function daysInMonthOf(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** จำนวนเดือนจาก a ถึง b เช่น monthIndex("2025-11", "2026-02") = 3 */
export function monthIndex(a, b) {
  const pa = parseYMD(a);
  const pb = parseYMD(b);
  if (!pa || !pb) throw new Error(`monthIndex: อ่านเดือนไม่ได้ (${a}, ${b})`);
  return (pb.y - pa.y) * 12 + (pb.m - pa.m);
}

/**
 * @param rows  แถวยอดขาย (ไม่นับ customer_id ว่าง)
 * @param asOf  วันสุดท้ายของข้อมูล YYYY-MM-DD ใช้บอกว่าเดือนสุดท้ายข้อมูลไม่ครบหรือไม่
 * @returns {{ cohorts: {cohort, size, retention: number[]}[], lastMonth, lastMonthPartial, daysInLastMonth }}
 *   retention ยาวเท่าจำนวนเดือนที่สังเกตได้ของ cohort นั้น (ถึง lastMonth)
 */
export function computeCohorts(rows, asOf) {
  // 1) เดือนที่ลูกค้าแต่ละคนมาซื้อ (Set = นับซ้ำในเดือนเดียวกันครั้งเดียว)
  const monthsByCustomer = new Map();
  let maxMonth = null;
  for (const r of rows ?? []) {
    const id = r?.customer_id == null ? "" : String(r.customer_id).trim();
    if (!id) continue;
    const mk = monthKey(r.date);
    if (!mk) continue;
    if (!monthsByCustomer.has(id)) monthsByCustomer.set(id, new Set());
    monthsByCustomer.get(id).add(mk);
    if (!maxMonth || mk > maxMonth) maxMonth = mk;
  }

  // 2) เดือนสุดท้ายของข้อมูล: ใช้ asOf ถ้ามี ไม่งั้นใช้เดือนล่าสุดที่พบในข้อมูล
  const asOfP = parseYMD(asOf);
  const lastMonth = asOfP ? `${asOfP.y}-${pad2(asOfP.m)}` : maxMonth;
  let daysInMonth = null;
  let daysInLastMonth = null;
  let lastMonthPartial = false;
  if (lastMonth) {
    const [ly, lm] = lastMonth.split("-").map(Number);
    daysInMonth = daysInMonthOf(ly, lm);
    daysInLastMonth = asOfP ? Math.min(asOfP.d, daysInMonth) : daysInMonth;
    lastMonthPartial = daysInLastMonth < daysInMonth;
  }

  // 3) จัดลูกค้าเข้า cohort ตามเดือนแรก แล้วนับว่ากลับมาเดือนที่ k กี่คน
  const byCohort = new Map(); // cohort -> { size, counts: Map<k, n> }
  for (const months of monthsByCustomer.values()) {
    const sorted = [...months].sort();
    const first = sorted[0];
    if (lastMonth && first > lastMonth) continue; // ซื้อหลัง asOf ไม่นับ
    if (!byCohort.has(first)) byCohort.set(first, { size: 0, counts: new Map() });
    const c = byCohort.get(first);
    c.size += 1;
    for (const mk of sorted) {
      if (lastMonth && mk > lastMonth) break;
      const k = monthIndex(first, mk);
      c.counts.set(k, (c.counts.get(k) ?? 0) + 1);
    }
  }

  const cohorts = [...byCohort.keys()].sort().map((cohort) => {
    const { size, counts } = byCohort.get(cohort);
    const span = lastMonth ? monthIndex(cohort, lastMonth) + 1 : 1;
    const retention = Array.from({ length: span }, (_, k) => (counts.get(k) ?? 0) / size);
    return { cohort, size, retention };
  });

  return {
    cohorts,
    lastMonth,
    lastMonthPartial,
    daysInLastMonth,
    daysInMonth, // ใช้ใน CohortCard: "มีข้อมูล X จาก Y วัน"
  };
}
