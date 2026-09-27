export default function ChartTooltip({ active, payload, label, formatLabel, formatValue }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm shadow-md dark:border-stone-700 dark:bg-stone-800">
      <p className="text-stone-600 dark:text-stone-400">{formatLabel ? formatLabel(label) : label}</p>
      <p className="font-semibold text-stone-900 dark:text-stone-50">{formatValue(payload[0].value)}</p>
    </div>
  )
}
