import { Button } from 'react-bootstrap'

import IconifyIcon from '@/components/wrappers/IconifyIcon'

type TablePaginationProps = {
  totalItems: number
  rangeStart: number
  rangeEnd: number
  safePage: number
  totalPages: number
  onPageChange: (page: number) => void
  disabled?: boolean
  className?: string
  emptyLabel?: string
}

const TablePagination = ({
  totalItems,
  rangeStart,
  rangeEnd,
  safePage,
  totalPages,
  onPageChange,
  disabled = false,
  className = '',
  emptyLabel = 'Showing 0 records',
}: TablePaginationProps) => (
  <div
    className={`d-flex flex-wrap justify-content-between align-items-center gap-2 ${className}`.trim()}
  >
    <p className="text-muted small mb-0">
      {totalItems === 0 ? emptyLabel : `Showing ${rangeStart}–${rangeEnd} of ${totalItems}`}
    </p>
    <div className="d-flex gap-2">
      <Button
        size="sm"
        variant="outline-secondary"
        disabled={disabled || safePage <= 1}
        onClick={() => onPageChange(Math.max(1, safePage - 1))}
      >
        <IconifyIcon icon="solar:alt-arrow-left-broken" className="me-1" />
        Prev
      </Button>
      <span className="align-self-center small text-muted">
        Page {safePage} of {totalPages}
      </span>
      <Button
        size="sm"
        variant="outline-secondary"
        disabled={disabled || safePage >= totalPages}
        onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
      >
        Next
        <IconifyIcon icon="solar:alt-arrow-right-broken" className="ms-1" />
      </Button>
    </div>
  </div>
)

export default TablePagination
