import { useMemo } from 'react'
import { Form } from 'react-bootstrap'

import { currency } from '@/context/constants'
import { getActiveSurgeries, surgeryCatalog } from '@/shared/services/hmsStore'
import type { SurgeryCategory } from '@/shared/types'

const CATEGORY_ORDER: SurgeryCategory[] = ['General', 'Orthopedic', 'Cardiac']

const formatOptionLabel = (name: string, category: SurgeryCategory, price: number, riskLevel?: string) => {
  const risk = riskLevel ? ` · ${riskLevel} risk` : ''
  return `${name} (${category}${risk}) — ${currency}${price}`
}

type SurgerySelectProps = {
  value: string
  onChange: (catalogId: string) => void
  size?: 'sm'
  placeholder?: string
  categoryFilter?: SurgeryCategory | 'all'
  excludeIds?: string[]
}

export const SurgerySelect = ({
  value,
  onChange,
  size,
  placeholder = 'Select surgery...',
  categoryFilter = 'all',
  excludeIds = [],
}: SurgerySelectProps) => {
  const grouped = useMemo(() => {
    const active = getActiveSurgeries(categoryFilter === 'all' ? undefined : categoryFilter)
    const excluded = new Set(excludeIds.filter(Boolean))
    const filtered = active.filter((s) => !excluded.has(s.id) || s.id === value)

    return CATEGORY_ORDER.map((category) => ({
      category,
      items: filtered.filter((s) => s.category === category),
    })).filter((g) => g.items.length > 0)
  }, [categoryFilter, excludeIds, value, surgeryCatalog.length])

  return (
    <Form.Select size={size} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {grouped.map(({ category, items }) => (
        <optgroup key={category} label={category}>
          {items.map((s) => (
            <option key={s.id} value={s.id}>
              {formatOptionLabel(s.name, s.category, s.price, s.riskLevel)}
            </option>
          ))}
        </optgroup>
      ))}
    </Form.Select>
  )
}

export default SurgerySelect
