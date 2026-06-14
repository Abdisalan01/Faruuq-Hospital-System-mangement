import { useEffect, useId, useMemo, useRef, useState } from 'react'

import IconifyIcon from '@/components/wrappers/IconifyIcon'

export type SearchableOption = {
  value: string
  label: string
  searchText?: string
}

export type SearchableOptionGroup = {
  label: string
  options: SearchableOption[]
}

type SearchableSelectProps = {
  value: string
  onChange: (value: string) => void
  groups: SearchableOptionGroup[]
  placeholder?: string
  disabled?: boolean
  size?: 'sm'
  emptyMessage?: string
}

const SearchableSelect = ({
  value,
  onChange,
  groups,
  placeholder = 'Search and select...',
  disabled = false,
  size,
  emptyMessage = 'No matches',
}: SearchableSelectProps) => {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selectedLabel = useMemo(() => {
    for (const group of groups) {
      const match = group.options.find((opt) => opt.value === value)
      if (match) return match.label
    }
    return ''
  }, [groups, value])

  const filteredGroups = useMemo(() => {
    const q = query.toLowerCase().trim()
    return groups
      .map((group) => ({
        ...group,
        options: group.options.filter((opt) => {
          if (!q) return true
          const hay = (opt.searchText ?? opt.label).toLowerCase()
          return hay.includes(q)
        }),
      }))
      .filter((group) => group.options.length > 0)
  }, [groups, query])

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const handleSelect = (next: string) => {
    onChange(next)
    setOpen(false)
    setQuery('')
  }

  const handleClear = () => {
    onChange('')
    setQuery('')
    setOpen(false)
  }

  return (
    <div
      ref={rootRef}
      className={`searchable-select ${open ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''} ${
        size === 'sm' ? 'searchable-select-sm' : ''
      }`}
    >
      <div className="searchable-select-field">
        <IconifyIcon icon="solar:magnifer-broken" className="searchable-select-icon" aria-hidden />
        <input
          type="text"
          className="searchable-select-input"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          value={open ? query : selectedLabel}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            if (!disabled) setOpen(true)
          }}
        />
        {value && !disabled && (
          <button type="button" className="searchable-select-clear" onClick={handleClear} aria-label="Clear">
            ×
          </button>
        )}
      </div>

      {open && !disabled && (
        <div id={listId} className="searchable-select-dropdown" role="listbox">
          {filteredGroups.length === 0 ? (
            <div className="searchable-select-empty">{emptyMessage}</div>
          ) : (
            filteredGroups.map((group) => (
              <div key={group.label} className="searchable-select-group">
                <div className="searchable-select-group-label">{group.label}</div>
                {group.options.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={opt.value === value}
                    className={`searchable-select-option ${opt.value === value ? 'is-selected' : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default SearchableSelect
