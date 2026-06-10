import { useMemo } from 'react'
import { Form } from 'react-bootstrap'

import { currency } from '@/context/constants'
import { getActiveLabTests, labTestCatalog } from '@/shared/services/hmsStore'
import type { LabTestCategory } from '@/shared/types'

const CATEGORY_ORDER: LabTestCategory[] = ['Laboratory', 'Radiology', 'Imaging']

const formatOptionLabel = (testName: string, sampleType?: string, price?: number) => {
  const sample = sampleType && sampleType !== 'N/A' ? ` · ${sampleType}` : ''
  const priceText = price != null ? ` (${currency}${price})` : ''
  return `${testName}${sample}${priceText}`
}

type LabTestSelectProps = {
  value: string
  onChange: (testName: string) => void
  size?: 'sm'
  placeholder?: string
  categoryFilter?: LabTestCategory | 'all'
  excludeNames?: string[]
}

export const LabTestSelect = ({
  value,
  onChange,
  size,
  placeholder = 'Select test...',
  categoryFilter = 'all',
  excludeNames = [],
}: LabTestSelectProps) => {
  const grouped = useMemo(() => {
    const active = getActiveLabTests(categoryFilter === 'all' ? undefined : categoryFilter)
    const excluded = new Set(excludeNames.filter(Boolean))
    const filtered = active.filter((t) => !excluded.has(t.testName) || t.testName === value)

    return CATEGORY_ORDER.map((category) => ({
      category,
      tests: filtered.filter((t) => t.category === category),
    })).filter((g) => g.tests.length > 0)
  }, [categoryFilter, excludeNames, value, labTestCatalog.length])

  return (
    <Form.Select size={size} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {grouped.map(({ category, tests }) => (
        <optgroup key={category} label={category}>
          {tests.map((t) => (
            <option key={t.id} value={t.testName}>
              {formatOptionLabel(t.testName, t.sampleType, t.price)}
            </option>
          ))}
        </optgroup>
      ))}
    </Form.Select>
  )
}

export default LabTestSelect
