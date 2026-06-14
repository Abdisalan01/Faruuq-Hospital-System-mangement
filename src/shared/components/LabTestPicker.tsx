import { useMemo } from 'react'

import { currency } from '@/context/constants'
import SearchableSelect from '@/shared/components/SearchableSelect'
import { getActiveLabTests, labTestCatalog } from '@/shared/services/hmsStore'
import { DEFAULT_LAB_TEST_CATEGORIES } from '@/shared/types'
import type { LabTestCategory } from '@/shared/types'

const formatOptionLabel = (testName: string, price?: number) => {
  const priceText = price != null ? ` (${currency}${price})` : ''
  return `${testName}${priceText}`
}

type LabTestSelectProps = {
  value: string
  onChange: (testName: string) => void
  size?: 'sm'
  placeholder?: string
  categoryFilter?: LabTestCategory | 'all'
  excludeNames?: string[]
  disabled?: boolean
}

export const LabTestSelect = ({
  value,
  onChange,
  size,
  placeholder = 'Search lab test name or category...',
  categoryFilter = 'all',
  excludeNames = [],
  disabled,
}: LabTestSelectProps) => {
  const groups = useMemo(() => {
    const active = getActiveLabTests(categoryFilter === 'all' ? undefined : categoryFilter)
    const excluded = new Set(excludeNames.filter(Boolean))
    const filtered = active.filter((t) => !excluded.has(t.testName) || t.testName === value)

    const known = new Set<string>(DEFAULT_LAB_TEST_CATEGORIES)
    const ordered = [
      ...DEFAULT_LAB_TEST_CATEGORIES.filter((c) => filtered.some((t) => t.category === c)),
      ...[...new Set(filtered.map((t) => t.category))]
        .filter((c) => !known.has(c))
        .sort((a, b) => a.localeCompare(b)),
    ]

    return ordered.map((category) => ({
      label: category,
      options: filtered
        .filter((t) => t.category === category)
        .map((t) => ({
          value: t.testName,
          label: formatOptionLabel(t.testName, t.price),
          searchText: `${t.testName} ${t.testId} ${t.category} ${t.unitReference ?? ''}`,
        })),
    }))
  }, [categoryFilter, excludeNames, value, labTestCatalog.length])

  return (
    <SearchableSelect
      value={value}
      onChange={onChange}
      groups={groups}
      placeholder={placeholder}
      size={size}
      disabled={disabled}
      emptyMessage="No lab test found — try another search"
    />
  )
}

export default LabTestSelect
