// Lab 4.4 · ใช้ Claude Code เขียนฟังก์ชันที่ยังว่าง (Prompt 4.4A ใน PROMPTS_LAB4.md) จนกว่า npm test จะผ่าน · ห้ามแก้ไฟล์ test
// Lab 4.4 · พยากรณ์ยอดขายแบบอธิบายได้ และวัดความแม่นด้วยการย้อนทดสอบ (backtest)
import { addDays } from "../../lab3/time.js";

const dow = (ymd) => new Date(ymd + "T00:00:00Z").getUTCDay(); // 0 = อาทิตย์

/** ค่าเฉลี่ยยอดขายวันเดียวกันของสัปดาห์ K ครั้งล่าสุด (ฤดูกาลรายสัปดาห์) */
export function seasonalForecast(series, horizon, K = 8) {
  // แยกยอดตามวันในสัปดาห์ (0–6) เรียงตามเวลา แล้วเก็บไว้แค่ K ค่าล่าสุดของแต่ละวัน
  // กรองด้วย dow ของวันที่จริง ไม่ใช่นับถอยหลังทีละ 7 แถว จึงไม่เพี้ยนแม้ series มีวันขาด
  const byDow = Array.from({ length: 7 }, () => []);
  for (const s of series) byDow[dow(s.date)].push(s.revenue);
  const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const fallback = series.length ? avg(series.slice(-28).map((s) => s.revenue)) : 0;
  const level = byDow.map((xs) => (xs.length ? avg(xs.slice(-K)) : fallback));

  const last = series[series.length - 1].date;
  return Array.from({ length: horizon }, (_, i) => {
    const date = addDays(last, i + 1);
    return { date, forecast: level[dow(date)] };
  });
}

/** ค่าเฉลี่ย K วันล่าสุด เส้นตรง (ตัวเปรียบเทียบที่ไม่สนวันในสัปดาห์) */
export function flatForecast(series, horizon, K = 28) {
  const recent = series.slice(-K);
  const avg = recent.reduce((a, s) => a + s.revenue, 0) / recent.length;
  const last = series[series.length - 1].date;
  return Array.from({ length: horizon }, (_, i) => ({ date: addDays(last, i + 1), forecast: avg }));
}

/** Mean Absolute Percentage Error (%) · ข้ามวันที่ยอดจริงเป็น 0 เพราะหารไม่ได้ */
export function mape(actual, forecast) {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < actual.length; i++) {
    const a = actual[i];
    if (!a) continue; // ยอดจริง 0 (หรือไม่มีค่า) หารไม่ได้ → ข้าม
    sum += Math.abs(a - forecast[i]) / Math.abs(a);
    n += 1;
  }
  return n ? (sum / n) * 100 : null; // null = ไม่มีวันที่วัดได้เลย
}

/**
 * ย้อนทดสอบ: ซ่อน horizon วันสุดท้าย พยากรณ์จากข้อมูลก่อนหน้า แล้วเทียบกับของจริง
 * band = ±1.28 × ส่วนเบี่ยงเบนมาตรฐานของ % ความคลาดเคลื่อน (ช่วงประมาณ 80%)
 */
export function backtest(series, horizon = 28, K = 8) {
  const train = series.slice(0, -horizon);
  const actual = series.slice(-horizon);
  if (!train.length) throw new Error(`backtest: ข้อมูลไม่พอ ต้องมีมากกว่า ${horizon} วัน`);

  const seasonal = seasonalForecast(train, horizon, K);
  const flat = flatForecast(train, horizon);

  const test = actual.map((s, i) => ({
    date: s.date,
    actual: s.revenue,
    seasonal: seasonal[i].forecast,
    flat: flat[i].forecast,
  }));

  // ความคลาดเคลื่อนของ seasonal รายวันเป็นสัดส่วน (มีเครื่องหมาย) · ข้ามวันที่ยอดจริงเป็น 0
  const errs = test.filter((t) => t.actual).map((t) => (t.actual - t.seasonal) / t.actual);
  const mean = errs.length ? errs.reduce((a, b) => a + b, 0) / errs.length : 0;
  const sd = errs.length ? Math.sqrt(errs.reduce((a, e) => a + (e - mean) ** 2, 0) / errs.length) : 0;
  // เป็นสัดส่วน เช่น 0.12 = ±12% · ForecastTab ใช้ตรง ๆ: forecast × (1 ± band) (ช่วงประมาณ 80%)
  const band = 1.28 * sd;

  return {
    test,
    mapeSeasonal: mape(test.map((t) => t.actual), test.map((t) => t.seasonal)),
    mapeFlat: mape(test.map((t) => t.actual), test.map((t) => t.flat)),
    band,
  };
}
