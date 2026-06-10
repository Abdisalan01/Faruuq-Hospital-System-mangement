import { useMemo, useState } from 'react'
import { Form } from 'react-bootstrap'

import { inventoryItems, medicineCatalog } from '@/shared/services/hmsStore'

export type SupplyItemOption = {
  id: string
  name: string
  unit: string
  stock?: number
}

/** All medicines available in pharmacy (inventory + catalog) */
export function getPharmacyMedicineOptions(): SupplyItemOption[] {
  const map = new Map<string, SupplyItemOption>()

  for (const item of inventoryItems) {
    if (item.category !== 'Medicines') continue
    map.set(item.name.toLowerCase(), {
      id: item.id,
      name: item.name,
      unit: item.unit,
      stock: item.quantity,
    })
  }

  for (const med of medicineCatalog) {
    if (!med.isActive) continue
    const key = med.name.toLowerCase()
    if (!map.has(key)) {
      map.set(key, { id: med.id, name: med.name, unit: med.unit })
    }
  }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

type SupplyItemPickerProps = {
  value: string
  onChange: (name: string, unit?: string) => void
  size?: 'sm'
  placeholder?: string
  disabled?: boolean
}

const SupplyItemPicker = ({
  value,
  onChange,
  size,
  placeholder = 'Search and select medicine...',
  disabled,
}: SupplyItemPickerProps) => {
  const [open, setOpen] = useState(false)

  const options = useMemo(
    () => getPharmacyMedicineOptions(),
    [inventoryItems.length, medicineCatalog.length],
  )

  const filtered = useMemo(() => {
    const q = value.toLowerCase().trim()
    if (!q) return options.slice(0, 12)
    return options.filter((o) => o.name.toLowerCase().includes(q)).slice(0, 12)
  }, [options, value])

  return (
    <div className="position-relative">
      <Form.Control
        type="search"
        size={size}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && filtered.length > 0 && (
        <div
          className="list-group position-absolute w-100 shadow-sm mt-1"
          style={{ zIndex: 1060, maxHeight: 220, overflowY: 'auto' }}
        >
          {filtered.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="list-group-item list-group-item-action py-2 small text-start"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(opt.name, opt.unit)
                setOpen(false)
              }}
            >
              <span className="fw-medium">{opt.name}</span>
              <span className="text-muted ms-1">· {opt.unit}</span>
              {opt.stock != null && (
                <span className="text-muted ms-1">· stock {opt.stock}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default SupplyItemPicker
