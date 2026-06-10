const STATUS_VARIANTS: Record<string, string> = {
  Waiting: 'warning',
  'In Consultation': 'info',
  'Completed Consultation': 'success',
  'Lab Requested': 'primary',
  Printed: 'secondary',
  Admitted: 'dark',
  Assigned: 'success',
  Completed: 'success',
  Cancelled: 'danger',
  Pending: 'warning',
  'Awaiting Payment': 'warning',
  'Not Submitted': 'warning',
  Submitted: 'success',
  Viewed: 'success',
  'Not Viewed': 'warning',
  'In Progress': 'info',
  Dispensed: 'success',
  Active: 'success',
  Inactive: 'secondary',
  'In Active': 'info',
  Discharged: 'secondary',
  Critical: 'danger',
  Urgent: 'warning',
  Stable: 'info',
  Minor: 'success',
  Approved: 'success',
  Rejected: 'danger',
  Scheduled: 'primary',
  Surgery: 'primary',
  Delivered: 'info',
  'Pharmacy Approved': 'success',
  Administered: 'success',
  cash: 'success',
  credit: 'warning',
}

type StatusBadgeProps = {
  status: string
  className?: string
}

const StatusBadge = ({ status, className = '' }: StatusBadgeProps) => {
  const variant = STATUS_VARIANTS[status] ?? 'secondary'
  return <span className={`badge badge-soft-${variant} ${className}`}>{status}</span>
}

export default StatusBadge
