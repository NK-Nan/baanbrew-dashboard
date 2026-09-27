import { formatBaht, formatNumber } from '../lib/metrics'

export default function KpiCards({ data }) {
  const items = [
    { label: 'ยอดขายรวม', value: formatBaht(data.totalSales), primary: true },
    { label: 'จำนวนบิล', value: formatNumber(data.billCount), unit: 'บิล' },
    { label: 'ยอดเฉลี่ยต่อบิล', value: formatBaht(data.averagePerBill, { decimals: true }) },
    { label: 'ลูกค้าสมาชิก (ไม่ซ้ำ)', value: formatNumber(data.uniqueMembers), unit: 'คน' },
  ]

  return (
    <section
      aria-label="ตัวชี้วัดหลัก"
      className="grid grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr] rounded-xl border border-line bg-panel"
    >
      {items.map((item, i) => (
        <div
          key={item.label}
          className={[
            'p-5 lg:p-6',
            i > 0 ? 'lg:border-l border-line' : '',
            i % 2 === 1 ? 'border-l border-line' : '',
            i >= 2 ? 'border-t lg:border-t-0 border-line' : '',
            item.primary ? 'bg-ink text-paper rounded-tl-xl lg:rounded-l-xl' : '',
          ].join(' ')}
        >
          <p className={`text-sm ${item.primary ? 'text-paper/70' : 'text-muted'}`}>{item.label}</p>
          <p
            className={`mt-2 font-semibold leading-none tracking-tight ${
              item.primary ? 'text-3xl lg:text-4xl' : 'text-2xl lg:text-3xl'
            }`}
          >
            {item.value}
            {item.unit && <span className="ml-1.5 text-base font-normal text-muted">{item.unit}</span>}
          </p>
        </div>
      ))}
    </section>
  )
}