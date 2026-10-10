// Lab 4.4 · มุมมองเพิ่มเติมของการ์ดพยากรณ์ (ใช้ผลจาก forecast.js โดยไม่แก้ฟังก์ชันเดิม)
//   - toWeekly / weeklyAccuracy : รวมยอดเป็นรายสัปดาห์ จันทร์–อาทิตย์ แล้วเทียบ MAPE รายสัปดาห์กับรายวัน
//   - bandNote                  : ข้อความอธิบายว่าแถบช่วงคาดการณ์มาจากไหน
//   - prepPlan                  : ควรเตรียมของเท่าไร = ยอดคาดการณ์ 7 วัน × สัดส่วนยอดขายของเมนูกลุ่ม A
import { addDays } from "../../lab3/time.js";
import { seasonalForecast, mape } from "./forecast.js";

const dow = (ymd) => new Date(ymd + "T00:00:00Z").getUTCDay(); // 0 = อาทิตย์

/** วันจันทร์ของสัปดาห์ที่ ymd อยู่ (สัปดาห์ = จันทร์–อาทิตย์) */
export function weekStart(ymd) {
  return addDays(ymd, -((dow(ymd) + 6) % 7));
}

/**
 * รวมแถวรายวันเป็นรายสัปดาห์
 * @param rows   [{ date, ...ตัวเลข }] เช่น bt.test = [{ date, actual, seasonal, flat }]
 * @param fields ฟิลด์ที่จะรวม
 * @returns [{ week (วันจันทร์), from, to, days, full, ...ผลรวมของแต่ละฟิลด์ }]
 *   full = มีครบ 7 วัน · สัปดาห์หัว/ท้ายของช่วงทดสอบมักไม่ครบ
 */
export function toWeekly(rows, fields = ["actual", "seasonal", "flat"]) {
  const map = new Map();
  for (const r of rows) {
    const week = weekStart(r.date);
    if (!map.has(week)) {
      map.set(week, { week, from: r.date, to: r.date, days: 0, ...Object.fromEntries(fields.map((f) => [f, 0])) });
    }
    const w = map.get(week);
    w.days += 1;
    if (r.date < w.from) w.from = r.date;
    if (r.date > w.to) w.to = r.date;
    for (const f of fields) w[f] += Number(r[f]) || 0;
  }
  return [...map.values()].sort((a, b) => a.week.localeCompare(b.week)).map((w) => ({ ...w, full: w.days === 7 }));
}

/**
 * MAPE รายวันเทียบรายสัปดาห์จากผล backtest
 * MAPE รายสัปดาห์คิดเฉพาะสัปดาห์ที่ครบ 7 วัน เพื่อไม่ให้สัปดาห์ที่มี 2–3 วันมาถ่วงผล
 * ถ้าไม่มีสัปดาห์ครบเลย จะใช้ทุกสัปดาห์แทน (usedPartial = true)
 */
export function weeklyAccuracy(bt) {
  const weekly = toWeekly(bt.test);
  const full = weekly.filter((w) => w.full);
  const usedPartial = full.length === 0;
  const basis = usedPartial ? weekly : full;
  const col = (xs, f) => xs.map((x) => x[f]);
  return {
    weekly,
    weeksCounted: basis.length,
    usedPartial,
    daily: {
      seasonal: mape(col(bt.test, "actual"), col(bt.test, "seasonal")),
      flat: mape(col(bt.test, "actual"), col(bt.test, "flat")),
    },
    weeklyMape: {
      seasonal: mape(col(basis, "actual"), col(basis, "seasonal")),
      flat: mape(col(basis, "actual"), col(basis, "flat")),
    },
  };
}

/** ข้อความอธิบายแถบช่วงคาดการณ์ (ใช้ใต้การ์ดพยากรณ์) */
export function bandNote(bt) {
  const days = bt.test.length;
  const pct = ((bt.band ?? 0) * 100).toFixed(1); // band เป็นสัดส่วน → แสดงเป็น %
  return (
    `แถบช่วงคาดการณ์ = ค่าพยากรณ์ ±${pct}% · คำนวณจากการย้อนทดสอบ: ซ่อนยอดจริง ${days} วันล่าสุด ` +
    `ให้โมเดลทายจากข้อมูลก่อนหน้า แล้ววัด % ความคลาดเคลื่อนรายวัน (ยอดจริง − ค่าพยากรณ์) ÷ ยอดจริง ` +
    `นำส่วนเบี่ยงเบนมาตรฐานของค่าเหล่านี้คูณ 1.28 ได้ช่วงที่ควรครอบคลุมยอดจริงราว 8 ใน 10 วัน ` +
    `(สมมติว่าความคลาดเคลื่อนกระจายแบบปกติ) · วันที่ยอดจริงเป็น 0 ไม่นำมาคิด`
  );
}

/**
 * ควรเตรียมของเท่าไรใน 7 วันข้างหน้า
 * ยอดเมนู ≈ ยอดคาดการณ์รวม 7 วัน × สัดส่วนยอดขายของเมนูนั้น (share จาก computeAbc)
 * จำนวนแก้ว ≈ ยอดเมนู ÷ ราคา (ปัดขึ้น) · "เผื่อ" ใช้ขอบบนของแถบช่วงคาดการณ์ (× (1 + band))
 *
 * @param series    ยอดรายวัน [{ date, revenue }] (เช่นจาก toSeries)
 * @param abcItems  ผลของ computeAbc (มี product_id, name, share, cls)
 * @param products  [{ product_id, price, product_name? }] ใช้หาราคาต่อแก้ว
 * @param opts      { days = 7, band = 0 (สัดส่วนจาก backtest เช่น 0.12), K = 8 }
 */
export function prepPlan(series, abcItems, products = [], { days = 7, band = 0, K = 8 } = {}) {
  const fc = seasonalForecast(series, days, K);
  const total = fc.reduce((a, x) => a + x.forecast, 0);
  const price = Object.fromEntries(products.map((p) => [p.product_id, Number(p.price)]));
  const safeFactor = 1 + Math.max(0, band);

  const rows = abcItems
    .filter((i) => i.cls === "A")
    .map((i) => {
      const expectedRevenue = total * i.share;
      const p = price[i.product_id];
      const hasPrice = Number.isFinite(p) && p > 0;
      return {
        product_id: i.product_id,
        name: i.name,
        share: i.share,
        expectedRevenue,
        price: hasPrice ? p : null,
        units: hasPrice ? Math.ceil(expectedRevenue / p) : null,
        unitsSafe: hasPrice ? Math.ceil((expectedRevenue * safeFactor) / p) : null,
      };
    });

  return {
    from: fc[0]?.date ?? null,
    to: fc[fc.length - 1]?.date ?? null,
    total,
    totalSafe: total * safeFactor,
    shareA: rows.reduce((a, r) => a + r.share, 0),
    rows,
  };
}
