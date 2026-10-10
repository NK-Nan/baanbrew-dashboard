// Lab 4.1 · ใช้ Claude Code เขียนฟังก์ชันที่ยังว่าง (Prompt 4.1A ใน PROMPTS_LAB4.md) จนกว่า npm test จะผ่าน · ห้ามแก้ไฟล์ test
// Lab 4.1 · RFM: แบ่งกลุ่มลูกค้าสมาชิกด้วย Recency, Frequency, Monetary
// rows = ผลจาก prepareRows() (มี order_id, date, revenue, customer_id)
import { daysBetween } from "../../lab3/time.js";

/**
 * คะแนน 1–5 ตามตำแหน่งเปอร์เซ็นไทล์ (ค่ามาก = คะแนนสูง)
 * ค่าที่เท่ากันต้องได้คะแนนเท่ากันเสมอ: score = 1 + floor(5 × จำนวนค่าที่ "น้อยกว่า" / n)
 */
export function percentileScores(values) {
  const n = values.length;
  const sorted = [...values].sort((a, b) => a - b);
  // นับจำนวนค่าที่ "น้อยกว่า" x ด้วย binary search (ตำแหน่งแรกที่ค่า >= x) ค่าที่เท่ากันจึงได้ตำแหน่งเดียวกัน
  const countLess = (x) => {
    let lo = 0, hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid] < x) lo = mid + 1; else hi = mid;
    }
    return lo;
  };
  return values.map((x) => 1 + Math.floor((5 * countLess(x)) / n));
}

/** กติกาตั้งชื่อกลุ่ม ตรวจจากบนลงล่าง ข้อแรกที่ตรงคือคำตอบ */
export function segmentOf(r, f) {
  if (r >= 4 && f >= 4) return "Champions";
  if (r >= 3 && f >= 4) return "Loyal";
  if (r >= 4 && f <= 2) return "New";
  if (r <= 2 && f >= 3) return "At Risk";
  if (r <= 2) return "Lost";
  return "Need Attention";
}

export const SEGMENTS = [
  { id: "Champions", th: "ลูกค้าชั้นยอด", action: "ให้สิทธิพิเศษ ชวนลองเมนูใหม่ก่อนใคร" },
  { id: "Loyal", th: "ลูกค้าประจำ", action: "สะสมแต้ม/ขยับขึ้นเป็นชั้นยอด" },
  { id: "New", th: "ลูกค้าใหม่", action: "คูปองครั้งที่ 2 ภายใน 14 วัน" },
  { id: "Need Attention", th: "ต้องดูแล", action: "โปรฯ ตามเมนูที่เคยซื้อ" },
  { id: "At Risk", th: "เสี่ยงหาย", action: "ดึงกลับด่วน: เคยซื้อบ่อยแต่หายไปนาน" },
  { id: "Lost", th: "หายไปแล้ว", action: "ใช้งบน้อย ส่งข้อความครั้งเดียว" },
];

/**
 * @param rows   แถวยอดขาย (ไม่นับแถวที่ customer_id ว่าง)
 * @param asOf   วันที่วิเคราะห์ YYYY-MM-DD (ใช้วันล่าสุดของข้อมูล ไม่ใช่วันนี้)
 * @returns {{ customers: object[], segments: object[], asOf: string }}
 *   customers: { id, R (วันที่ไม่ได้มา), F (จำนวนบิล), M (ยอดซื้อรวม), r, f, m, segment }
 *   segments:  { segment, customers, revenue, revenueShare, customerShare } เรียงตาม SEGMENTS
 */
export function computeRfm(rows, asOf) {
  // รวมแถวตามลูกค้า: วันล่าสุดที่มา, ชุดบิล (F นับบิล ไม่ใช่แถว), ยอดรวม
  const byCustomer = new Map();
  for (const row of rows) {
    if (!row.customer_id) continue; // walk-in ไม่นับ
    const c = byCustomer.get(row.customer_id) ?? { id: row.customer_id, last: row.date, orders: new Set(), M: 0 };
    if (row.date > c.last) c.last = row.date;
    c.orders.add(row.order_id);
    c.M += row.revenue;
    byCustomer.set(row.customer_id, c);
  }
  const base = [...byCustomer.values()].map((c) => ({
    id: c.id, R: daysBetween(c.last, asOf), F: c.orders.size, M: c.M,
  }));

  // R น้อย = เพิ่งมา = ดี จึงให้คะแนนจาก -R เพื่อให้ค่ามากได้คะแนนสูงเหมือน F และ M
  const rScores = percentileScores(base.map((c) => -c.R));
  const fScores = percentileScores(base.map((c) => c.F));
  const mScores = percentileScores(base.map((c) => c.M));
  const customers = base.map((c, i) => ({
    ...c, r: rScores[i], f: fScores[i], m: mScores[i], segment: segmentOf(rScores[i], fScores[i]),
  }));

  const totalRevenue = customers.reduce((sum, c) => sum + c.M, 0);
  const segments = SEGMENTS.map(({ id }) => {
    const group = customers.filter((c) => c.segment === id);
    const revenue = group.reduce((sum, c) => sum + c.M, 0);
    return {
      segment: id,
      customers: group.length,
      revenue,
      revenueShare: totalRevenue ? revenue / totalRevenue : 0,
      customerShare: customers.length ? group.length / customers.length : 0,
    };
  });
  return { customers, segments, asOf };
}
