// Lab 4.2 · ใช้ Claude Code เขียนฟังก์ชันที่ยังว่าง (Prompt 4.2A ใน PROMPTS_LAB4.md) จนกว่า npm test จะผ่าน · ห้ามแก้ไฟล์ test
// Lab 4.2 · Cohort retention รายเดือน
// cohort = เดือนแรกที่ลูกค้าสมาชิกซื้อ · retention[k] = สัดส่วนลูกค้าใน cohort ที่กลับมาซื้อในเดือนที่ k (k=0 คือเดือนแรก = 100%)

/** จำนวนเดือนจาก a ถึง b เช่น monthIndex("2025-11", "2026-02") = 3 */
export function monthIndex(a, b) {
  // คำนวณจากตัวเลขปี-เดือนในสตริงตรง ๆ ไม่ผ่าน Date จึงไม่มีปัญหา timezone
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

/** จำนวนวันในเดือน YYYY-MM · Date.UTC(ปี, เดือนถัดไป, 0) = วันสุดท้ายของเดือนนี้ */
const daysInMonthOf = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

/**
 * @param rows  แถวยอดขาย (ไม่นับ customer_id ว่าง)
 * @param asOf  วันสุดท้ายของข้อมูล YYYY-MM-DD ใช้บอกว่าเดือนสุดท้ายข้อมูลไม่ครบหรือไม่
 * @returns {{ cohorts: {cohort, size, retention: number[]}[], lastMonth, lastMonthPartial, daysInLastMonth }}
 *   retention ยาวเท่าจำนวนเดือนที่สังเกตได้ของ cohort นั้น (ถึง lastMonth)
 */
export function computeCohorts(rows, asOf) {
  // เดือนที่ลูกค้าแต่ละคนมาซื้อ (Set: มาหลายครั้งในเดือนเดียวกันนับครั้งเดียว)
  const monthsByCustomer = new Map();
  for (const row of rows) {
    if (!row.customer_id) continue; // walk-in ไม่นับ
    const months = monthsByCustomer.get(row.customer_id) ?? new Set();
    months.add(row.date.slice(0, 7));
    monthsByCustomer.set(row.customer_id, months);
  }

  const lastMonth = asOf.slice(0, 7);
  // cohort → { size, active[k] = จำนวนลูกค้าที่ซื้อในเดือนที่ k }
  const byCohort = new Map();
  for (const months of monthsByCustomer.values()) {
    const first = [...months].sort()[0];
    const c = byCohort.get(first) ?? { size: 0, active: new Array(monthIndex(first, lastMonth) + 1).fill(0) };
    c.size += 1;
    for (const m of months) {
      const k = monthIndex(first, m);
      if (k < c.active.length) c.active[k] += 1;
    }
    byCohort.set(first, c);
  }

  const cohorts = [...byCohort.entries()]
    .filter(([cohort]) => cohort <= lastMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cohort, c]) => ({ cohort, size: c.size, retention: c.active.map((n) => n / c.size) }));

  const daysInLastMonth = Number(asOf.slice(8, 10));
  const daysInMonth = daysInMonthOf(lastMonth);
  return { cohorts, lastMonth, lastMonthPartial: daysInLastMonth < daysInMonth, daysInLastMonth, daysInMonth };
}
