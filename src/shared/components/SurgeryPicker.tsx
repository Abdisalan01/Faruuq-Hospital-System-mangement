import { useMemo } from 'react'

import { currency } from '@/context/constants'
import SearchableSelect from '@/shared/components/SearchableSelect'
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
  disabled?: boolean
}

export const SurgerySelect = ({
  value,
  onChange,
  size,
  placeholder = 'Search surgery name or category...',
  categoryFilter = 'all',
  excludeIds = [],
  disabled,
}: SurgerySelectProps) => {
  const groups = useMemo(() => {
    const active = getActiveSurgeries(categoryFilter === 'all' ? undefined : categoryFilter)
    const excluded = new Set(excludeIds.filter(Boolean))
    const filtered = active.filter((s) => !excluded.has(s.id) || s.id === value)

    const known = new Set<string>(CATEGORY_ORDER)
    const ordered = [
      ...CATEGORY_ORDER.filter((c) => filtered.some((s) => s.category === c)),
      ...[...new Set(filtered.map((s) => s.category))]
        .filter((c) => !known.has(c))
        .sort((a, b) => a.localeCompare(b)),
    ]

    return ordered.map((category) => ({
      label: category,
      options: filtered
        .filter((s) => s.category === category)
        .map((s) => ({
          value: s.id,
          label: formatOptionLabel(s.name, s.category, s.price, s.riskLevel),
          searchText: `${s.name} ${s.surgeryId ?? ''} ${s.category} ${s.riskLevel ?? ''}`,
        })),
    }))
  }, [categoryFilter, excludeIds, value, surgeryCatalog.length])

  return (
    <SearchableSelect
      value={value}
      onChange={onChange}
      groups={groups}
      placeholder={placeholder}
      size={size}
      disabled={disabled}
      emptyMessage="No surgery found — try another search"
    />
  )
}

export default SurgerySelect
