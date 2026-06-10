import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { currency } from '@/context/constants'
import type { InpatientBillingMode } from '@/shared/types'

type InpatientBillingModeSelectorProps = {
  value: InpatientBillingMode
  onChange?: (mode: InpatientBillingMode) => void
  nightlyRate?: number
  readOnly?: boolean
  namePrefix?: string
}

const InpatientBillingModeSelector = ({
  value,
  onChange,
  nightlyRate,
  readOnly = false,
  namePrefix = 'billing',
}: InpatientBillingModeSelectorProps) => {
  const options: {
    mode: InpatientBillingMode
    title: string
    subtitle: string
    icon: string
    accent: 'cash' | 'book'
  }[] = [
    {
      mode: 'nightly_cash',
      title: 'Pay nightly (cash)',
      subtitle: 'Collect bed fee each night at reception — paid immediately, not on book',
      icon: 'solar:wallet-money-broken',
      accent: 'cash',
    },
    {
      mode: 'credit_book',
      title: 'Open credit book',
      subtitle: 'Bed fee posts to book each night automatically — patient pays total at exit',
      icon: 'solar:notebook-bookmark-broken',
      accent: 'book',
    },
  ]

  return (
    <div className="inpatient-billing-selector">
      <p className="text-muted small mb-2">
        Bed billing{nightlyRate != null ? ` — ${currency}${nightlyRate}/night` : ''}
      </p>
      <div className="row g-2">
        {options.map((opt) => {
          const selected = value === opt.mode
          return (
            <div key={opt.mode} className="col-md-6">
              <button
                type="button"
                className={`inpatient-billing-option inpatient-billing-option--${opt.accent} ${selected ? 'inpatient-billing-option--selected' : ''}`}
                onClick={() => !readOnly && onChange?.(opt.mode)}
                disabled={readOnly && !selected}
                aria-pressed={selected}
              >
                <div className="d-flex align-items-start gap-2 text-start w-100">
                  <span className={`inpatient-billing-option__icon inpatient-billing-option__icon--${opt.accent}`}>
                    <IconifyIcon icon={opt.icon} width={22} />
                  </span>
                  <div className="flex-grow-1">
                    <div className="d-flex justify-content-between align-items-center gap-2">
                      <strong className="small">{opt.title}</strong>
                      {selected && (
                        <span className="badge bg-primary-subtle text-primary">Active</span>
                      )}
                    </div>
                    <p className="text-muted mb-0 mt-1" style={{ fontSize: '0.75rem', lineHeight: 1.35 }}>
                      {opt.subtitle}
                    </p>
                  </div>
                </div>
                {!readOnly && (
                  <input
                    type="radio"
                    className="visually-hidden"
                    name={`${namePrefix}-mode`}
                    checked={selected}
                    onChange={() => onChange?.(opt.mode)}
                  />
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default InpatientBillingModeSelector
