import { useMemo } from 'react'

import SearchableSelect from '@/shared/components/SearchableSelect'
import { getInventoryForMedicine, medicineCatalog } from '@/shared/services/hmsStore'

type MedicineSearchSelectProps = {
  value: string
  onChange: (medicineName: string) => void
  disabled?: boolean
  placeholder?: string
  excludeNames?: string[]
}

const MedicineSearchSelect = ({
  value,
  onChange,
  disabled,
  placeholder = 'Search medicine name, code, category...',
  excludeNames = [],
}: MedicineSearchSelectProps) => {
  const groups = useMemo(() => {
    const excluded = new Set(excludeNames.filter(Boolean))
    const active = medicineCatalog
      .filter((m) => m.isActive && (!excluded.has(m.name) || m.name === value))
      .sort((a, b) => a.name.localeCompare(b.name))

    const byCategory = new Map<string, typeof active>()
    for (const med of active) {
      const list = byCategory.get(med.category) ?? []
      list.push(med)
      byCategory.set(med.category, list)
    }

    return [...byCategory.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, meds]) => ({
        label: category,
        options: meds.map((m) => {
          const stock = getInventoryForMedicine(m)
          const stockNote = stock != null ? ` · Qty ${stock.quantity}` : ''
          return {
            value: m.name,
            label: `${m.name} (${m.unit})${m.strength ? ` · ${m.strength}` : ''}${stockNote}`,
            searchText: `${m.name} ${m.medicineId} ${m.category} ${m.unit} ${m.strength ?? ''}`,
          }
        }),
      }))
  }, [excludeNames, value, medicineCatalog.length])

  return (
    <SearchableSelect
      value={value}
      onChange={onChange}
      groups={groups}
      placeholder={placeholder}
      disabled={disabled}
      emptyMessage="No medicine found — try another search"
    />
  )
}

export default MedicineSearchSelect
