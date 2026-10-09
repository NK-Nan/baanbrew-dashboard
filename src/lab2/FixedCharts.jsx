// Lab 2.2 · สร้างกราฟที่ซ่อมแล้วในไฟล์นี้
// แต่ละกราฟต้องเป็น component ชื่อ FixedChart1 … FixedChart5 ที่รับ props { rows, products }
// ฟังก์ชันคำนวณที่ใช้ได้ทันทีอยู่ใน ./lab2Metrics.js และ ../lib/metrics.js
// ตอนนี้ยังเป็น null หน้า Lab 2.2 จึงแสดงกล่อง "ยังไม่ได้ซ่อม"
import { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, Cell, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, LabelList, ReferenceLine,
} from "recharts";
import {
  revenueByProduct, branchPerformance, weeklyRevenue, monthlyRevenue, daysInMonth, thaiMonth,
} from "./lab2Metrics.js";

const PRIMARY = "#b45309"; // สีหลักสีเดียวของกราฟที่ซ่อมแล้ว

const baht = (v) => `฿${Math.round(v).toLocaleString("en-US")}`;
const pct = (v) => `${(v * 100).toFixed(1)}%`;
const shorten = (s, n = 14) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * เตรียมข้อมูลกราฟ 1: เมนู top N เรียงมากไปน้อย
 * เมนูที่เหลือไม่ทำเป็นแท่ง "อื่น ๆ" เพราะยอดรวมของมันใหญ่กว่าเมนูอันดับ 1 หลายเท่า
 * จะบีบแท่งที่เหลือจนเทียบกันไม่ได้ จึงคืนค่าไว้แสดงเป็นหมายเหตุใต้กราฟแทน
 * (export ไว้เพื่อทดสอบได้โดยไม่ต้องเรนเดอร์)
 */
export function productShareTopN(rows, products, topN = 10) {
  const all = revenueByProduct(rows, products); // เรียงมากไปน้อย มี revenue และ share แล้ว
  const top = all.slice(0, topN).map((d, i) => ({ ...d, rank: i + 1 }));
  const rest = all.slice(topN);
  return {
    data: top,
    leader: all[0] ?? null,
    top3Share: all.slice(0, 3).reduce((s, d) => s + d.share, 0),
    menuCount: all.length,
    restCount: rest.length,
    restShare: rest.reduce((s, d) => s + d.share, 0),
  };
}

function ShareTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md bg-white px-3 py-2 text-xs shadow ring-1 ring-stone-200">
      <div className="font-semibold text-stone-800">#{d.rank} {d.name}</div>
      <div className="tabular-nums text-stone-600">{baht(d.revenue)} · {pct(d.share)} ของยอดขาย</div>
    </div>
  );
}

/** กราฟ 1 (ซ่อมแล้ว): เมนูไหนทำเงินมากที่สุด → แท่งแนวนอนเรียงอันดับ สีเดียว ตัวเลขบนแท่ง */
export function FixedChart1({ rows, products }) {
  const { data, leader, top3Share, menuCount, restCount, restShare } = useMemo(
    () => productShareTopN(rows, products, 10),
    [rows, products]
  );

  if (!leader) return <p className="p-4 text-sm text-stone-500">ไม่มีข้อมูลยอดขาย</p>;

  return (
    <div className="flex h-full flex-col">
      <p className="mb-1 text-sm font-medium text-stone-800">
        <span className="text-amber-800">{leader.name}</span> ทำเงินมากที่สุด {baht(leader.revenue)} (
        {pct(leader.share)}) และ 3 อันดับแรกรวมกันได้ {pct(top3Share)} ของยอดขายจาก {menuCount} เมนู
      </p>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 112, bottom: 0, left: 0 }} barCategoryGap="18%">
            <XAxis type="number" hide domain={[0, "dataMax"]} />
            <YAxis
              type="category"
              dataKey="name"
              width={112}
              interval={0}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#57534e" }}
              tickFormatter={(name) => shorten(name)}
            />
            <Tooltip content={<ShareTooltip />} cursor={{ fill: "#fef3c7" }} />
            <Bar dataKey="revenue" fill={PRIMARY} isAnimationActive={false} radius={[0, 4, 4, 0]}>
              <LabelList
                dataKey="revenue"
                position="right"
                content={({ x, y, width, height, index }) => {
                  const d = data[index];
                  return (
                    <text x={x + width + 6} y={y + height / 2} dy={4} fontSize={11} fill="#44403c">
                      {baht(d.revenue)} · {pct(d.share)}
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {restCount > 0 && (
        <p className="mt-1 text-xs text-stone-500">
          แสดง {data.length} อันดับแรก · อีก {restCount} เมนูรวมกัน {pct(restShare)} ของยอดขาย
        </p>
      )}
    </div>
  );
}

// ───────────────────────── ตัวช่วยที่ใช้ร่วมกันในกราฟ 2–5 ─────────────────────────

const AXIS_TICK = { fontSize: 11, fill: "#57534e" };
const GRID = "#e7e5e4";
const bahtCompact = (v) =>
  `฿${Number(v).toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 })}`;
const times = (v) => `${v.toFixed(2)} เท่า`;
const thaiShortDate = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
const mean = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
const change = (now, before) => (before === 0 ? 0 : now / before - 1);
const addDays = (iso, n) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const upDown = (v) => (v >= 0 ? `สูงขึ้น ${pct(v)}` : `ลดลง ${pct(-v)}`);

/** วันแรกที่มียอดขายของแต่ละสาขา → ใช้หาสาขาที่เปิดทีหลัง */
export function branchFirstDates(rows) {
  const first = new Map();
  for (const r of rows) if (!first.has(r.branch) || r.date < first.get(r.branch)) first.set(r.branch, r.date);
  return first;
}

function Summary({ children }) {
  return <p className="mb-1 text-sm font-medium leading-snug text-stone-800">{children}</p>;
}
function Note({ children }) {
  return <p className="mt-1 text-xs text-stone-500">{children}</p>;
}
function Empty() {
  return <p className="p-4 text-sm text-stone-500">ไม่มีข้อมูลยอดขาย</p>;
}
function SimpleTooltip({ active, payload, render }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md bg-white px-3 py-2 text-xs shadow ring-1 ring-stone-200">{render(payload[0].payload)}</div>
  );
}

// ───────────────────────── กราฟ 2 ─────────────────────────

/** กราฟ 2: ยอดรวมแยกสาขา แกนเริ่มที่ 0 เรียงมากไปน้อย ความยาวแท่งจึงเทียบกันได้ตรงตามจริง */
export function prepareBranchTotals(rows) {
  const data = branchPerformance(rows).sort((a, b) => b.revenue - a.revenue);
  const maxDays = Math.max(0, ...data.map((d) => d.days));
  const top = data[0];
  const bottom = data[data.length - 1];
  return {
    data,
    top,
    bottom,
    ratio: bottom && bottom.revenue > 0 ? top.revenue / bottom.revenue : 0,
    shortBranches: data.filter((d) => d.days < maxDays * 0.9), // เปิดขายน้อยกว่าสาขาอื่นชัดเจน
    maxDays,
  };
}

export function FixedChart2({ rows }) {
  const { data, top, bottom, ratio, shortBranches, maxDays } = useMemo(() => prepareBranchTotals(rows), [rows]);
  if (!top) return <Empty />;

  return (
    <div className="flex h-full flex-col">
      <Summary>
        {top.branch} ขายได้ {baht(top.revenue)} มากที่สุด เป็น {times(ratio)} ของ{bottom.branch} ({baht(bottom.revenue)})
        ซึ่งต่ำสุด
      </Summary>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 84, bottom: 0, left: 0 }} barCategoryGap="25%">
            <XAxis type="number" domain={[0, "dataMax"]} hide />
            <YAxis type="category" dataKey="branch" width={88} interval={0} tickLine={false} axisLine={false} tick={AXIS_TICK} />
            <Tooltip
              cursor={{ fill: "#fef3c7" }}
              content={<SimpleTooltip render={(d) => (
                <>
                  <div className="font-semibold">{d.branch}</div>
                  <div className="tabular-nums">{baht(d.revenue)} · {times(d.revenue / bottom.revenue)} ของ{bottom.branch}</div>
                </>
              )} />}
            />
            <Bar dataKey="revenue" fill={PRIMARY} isAnimationActive={false} radius={[0, 4, 4, 0]}>
              <LabelList dataKey="revenue" position="right" formatter={baht} style={{ fontSize: 11, fill: "#44403c" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {shortBranches.length > 0 && (
        <Note>
          * {shortBranches.map((b) => `${b.branch} มีข้อมูล ${b.days.toLocaleString("en-US")} วัน`).join(", ")} จาก
          {" "}{maxDays.toLocaleString("en-US")} วัน ยอดรวมจึงต่ำส่วนหนึ่งเพราะเปิดทีหลัง (ดูกราฟ 5)
        </Note>
      )}
    </div>
  );
}

// ───────────────────────── กราฟ 3 ─────────────────────────

/**
 * กราฟ 3: รวมยอดเป็นรายสัปดาห์ (จ.–อา.) ด้วย weeklyRevenue ซึ่งตัดสัปดาห์ไม่ครบ 7 วันทิ้งแล้ว
 * ข้อสรุป: เทียบค่าเฉลี่ย 4 สัปดาห์ล่าสุดกับ 4 สัปดาห์แรก ทั้งทุกสาขา และเฉพาะสาขาที่เปิดตั้งแต่ต้น (สาขาเดิม)
 */
export function prepareWeeklyTrend(rows, k = 4) {
  const weeks = weeklyRevenue(rows);
  if (weeks.length < k * 2) return { weeks, enough: false };

  const firstDates = branchFirstDates(rows);
  const startDate = [...firstDates.values()].sort()[0];
  const newBranches = [...firstDates.entries()].filter(([, d]) => d > startDate);
  const existingRows = rows.filter((r) => firstDates.get(r.branch) === startDate);
  const existingWeeks = weeklyRevenue(existingRows);

  const growth = (ws) => change(mean(ws.slice(-k).map((w) => w.revenue)), mean(ws.slice(0, k).map((w) => w.revenue)));

  // สัปดาห์แรก (ที่ข้อมูลครบ) ที่สาขาใหม่สาขาแรกเริ่มขายแล้ว ใช้วางเส้นอ้างอิง
  const firstNew = [...newBranches].sort((a, b) => a[1].localeCompare(b[1]))[0];
  const markerWeek = firstNew ? weeks.find((w) => addDays(w.week, 6) >= firstNew[1]) ?? null : null;

  return {
    weeks,
    enough: true,
    k,
    lastAvg: mean(weeks.slice(-k).map((w) => w.revenue)),
    totalGrowth: growth(weeks),
    sameStoreGrowth: newBranches.length ? growth(existingWeeks) : null,
    newBranch: firstNew ? { branch: firstNew[0], date: firstNew[1] } : null,
    markerWeek: markerWeek?.week ?? null,
  };
}

export function FixedChart3({ rows }) {
  const t = useMemo(() => prepareWeeklyTrend(rows, 4), [rows]);
  if (!t.weeks.length) return <Empty />;

  return (
    <div className="flex h-full flex-col">
      <Summary>
        {t.enough ? (
          <>
            ยอดขายต่อสัปดาห์ช่วง {t.k} สัปดาห์ล่าสุดเฉลี่ย {baht(t.lastAvg)} {upDown(t.totalGrowth)} จาก {t.k} สัปดาห์แรก
            {t.sameStoreGrowth !== null && <> · ไม่นับ{t.newBranch.branch}ที่เปิดใหม่ก็ยัง{upDown(t.sameStoreGrowth)}</>}
          </>
        ) : (
          "ข้อมูลยังมีไม่พอให้เห็นแนวโน้มรายสัปดาห์"
        )}
      </Summary>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={t.weeks} margin={{ top: 14, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="week" tickFormatter={thaiShortDate} tick={AXIS_TICK} minTickGap={36} tickLine={false} />
            <YAxis tickFormatter={bahtCompact} tick={AXIS_TICK} width={52} domain={[0, "auto"]} axisLine={false} tickLine={false} />
            <Tooltip
              content={<SimpleTooltip render={(d) => (
                <>
                  <div className="font-semibold">สัปดาห์เริ่ม {thaiShortDate(d.week)}</div>
                  <div className="tabular-nums">{baht(d.revenue)}</div>
                </>
              )} />}
            />
            {t.markerWeek && (
              <ReferenceLine
                x={t.markerWeek}
                stroke="#a8a29e"
                strokeDasharray="4 3"
                label={{ value: `${t.newBranch.branch}เปิด`, position: "insideTopLeft", fontSize: 11, fill: "#78716c" }}
              />
            )}
            <Line dataKey="revenue" stroke={PRIMARY} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <Note>รวมยอดรายสัปดาห์ (จันทร์–อาทิตย์) ไม่นับสัปดาห์ต้นและท้ายที่ข้อมูลไม่ครบ 7 วัน</Note>
    </div>
  );
}

// ───────────────────────── กราฟ 4 ─────────────────────────

/** กราฟ 4: ใช้ยอดเฉลี่ยต่อวัน (perDay) แทนยอดรวม และระบุเดือนที่ข้อมูลไม่ครบ */
export function prepareMonthlyPerDay(rows) {
  const data = monthlyRevenue(rows).map((m) => {
    const calDays = daysInMonth(m.month);
    return { ...m, calDays, partial: m.days < calDays, label: thaiMonth(m.month) };
  });
  const last = data[data.length - 1] ?? null;
  const prev = data[data.length - 2] ?? null;
  return { data, last, prev, perDayChange: last && prev ? change(last.perDay, prev.perDay) : null };
}

export function FixedChart4({ rows }) {
  const { data, last, prev, perDayChange } = useMemo(() => prepareMonthlyPerDay(rows), [rows]);
  if (!last) return <Empty />;

  return (
    <div className="flex h-full flex-col">
      <Summary>
        {last.label} {last.partial ? `มีข้อมูลแค่ ${last.days}/${last.calDays} วัน แต่` : ""}ยอดเฉลี่ยต่อวัน {baht(last.perDay)}
        {prev && <> {upDown(perDayChange)} จาก{prev.label}</>}
        {last.partial && perDayChange >= 0 && " ยอดขายไม่ได้ตก ยอดรวมต่ำเพราะเดือนยังไม่จบ"}
      </Summary>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TICK} interval="preserveStartEnd" minTickGap={8} tickLine={false} />
            <YAxis tickFormatter={bahtCompact} tick={AXIS_TICK} width={52} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: "#fef3c7" }}
              content={<SimpleTooltip render={(d) => (
                <>
                  <div className="font-semibold">{d.label}</div>
                  <div className="tabular-nums">เฉลี่ย {baht(d.perDay)} / วัน</div>
                  <div className="tabular-nums text-stone-500">
                    ยอดรวม {baht(d.revenue)} · ข้อมูล {d.days}/{d.calDays} วัน
                  </div>
                </>
              )} />}
            />
            <Bar dataKey="perDay" isAnimationActive={false} radius={[3, 3, 0, 0]}>
              {data.map((d) => (
                <Cell key={d.month} fill={PRIMARY} fillOpacity={d.partial ? 0.4 : 1} />
              ))}
              <LabelList
                dataKey="perDay"
                content={({ x, y, width, index }) =>
                  data[index].partial ? (
                    <text x={x + width / 2} y={y - 4} textAnchor="middle" fontSize={10} fill="#78716c">
                      {data[index].days}/{data[index].calDays} วัน
                    </text>
                  ) : null
                }
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Note>แท่งสีอ่อน = เดือนที่ข้อมูลไม่ครบ · ยอดเฉลี่ยต่อวัน = ยอดรวม ÷ จำนวนวันที่มีข้อมูล</Note>
    </div>
  );
}

// ───────────────────────── กราฟ 5 ─────────────────────────

/**
 * กราฟ 5: จัดอันดับด้วยยอดเฉลี่ยต่อวันที่เปิดขาย (perDay) แทนยอดรวม
 * และหาเดือนที่ต่ำสุดของสาขาอันดับสุดท้าย เพื่อชี้ว่าอาจมีปัจจัยฤดูกาล
 */
export function prepareBranchPerDay(rows) {
  const data = branchPerformance(rows).sort((a, b) => b.perDay - a.perDay).map((d, i) => ({ ...d, rank: i + 1 }));
  if (!data.length) return { data };
  const lowest = data[data.length - 1];
  const lowestByTotal = [...data].sort((a, b) => a.revenue - b.revenue)[0];
  const months = monthlyRevenue(rows.filter((r) => r.branch === lowest.branch));
  const worstMonth = [...months].sort((a, b) => a.perDay - b.perDay)[0] ?? null;
  return {
    data,
    lowest,
    lowestByTotal,
    worstMonth: worstMonth ? { ...worstMonth, label: thaiMonth(worstMonth.month) } : null,
    medianPerDay: [...data].sort((a, b) => a.perDay - b.perDay)[Math.floor(data.length / 2)].perDay,
  };
}

export function FixedChart5({ rows }) {
  const { data, lowest, lowestByTotal, worstMonth, medianPerDay } = useMemo(() => prepareBranchPerDay(rows), [rows]);
  if (!data.length) return <Empty />;
  const moved = lowestByTotal.branch !== lowest.branch;

  return (
    <div className="flex h-full flex-col">
      <Summary>
        เทียบยอดเฉลี่ยต่อวันที่เปิดขาย {lowest.branch}ต่ำสุดที่ {baht(lowest.perDay)}/วัน
        {moved && <> · {lowestByTotal.branch}ที่ยอดรวมต่ำสุด (มีข้อมูล {lowestByTotal.days} วัน) อยู่อันดับ {lowestByTotal.rank} จาก {data.length}</>}
      </Summary>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 120, bottom: 0, left: 0 }} barCategoryGap="25%">
            <XAxis type="number" domain={[0, "dataMax"]} hide />
            <YAxis type="category" dataKey="branch" width={88} interval={0} tickLine={false} axisLine={false} tick={AXIS_TICK} />
            <Tooltip
              cursor={{ fill: "#fef3c7" }}
              content={<SimpleTooltip render={(d) => (
                <>
                  <div className="font-semibold">#{d.rank} {d.branch}</div>
                  <div className="tabular-nums">{baht(d.perDay)} / วัน</div>
                  <div className="tabular-nums text-stone-500">ยอดรวม {baht(d.revenue)} ÷ {d.days} วัน</div>
                </>
              )} />}
            />
            <ReferenceLine x={medianPerDay} stroke="#a8a29e" strokeDasharray="4 3" />
            <Bar dataKey="perDay" fill={PRIMARY} isAnimationActive={false} radius={[0, 4, 4, 0]}>
              <LabelList
                dataKey="perDay"
                content={({ x, y, width, height, index }) => (
                  <text x={x + width + 6} y={y + height / 2} dy={4} fontSize={11} fill="#44403c">
                    {baht(data[index].perDay)}/วัน · {data[index].days} วัน
                  </text>
                )}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Note>
        เส้นประ = ค่ากลางของทุกสาขา
        {worstMonth && <> · เดือนที่ต่ำสุดของ{lowest.branch}คือ {worstMonth.label} ({baht(worstMonth.perDay)}/วัน) ควรดูปัจจัยตามฤดูกาลก่อนสรุปเรื่องผู้จัดการ</>}
      </Note>
    </div>
  );
}
