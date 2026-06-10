import { useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Table } from 'react-bootstrap'

import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { currency } from '@/context/constants'
import { useAuthContext } from '@/context/useAuthContext'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import StatusBadge from '@/shared/components/StatusBadge'
import {
  collectPatientDiscountPayment,
  getPatientById,
  getReceptionPendingPatientDiscounts,
  getStaffById,
  patientDiscounts,
  persistPatientDiscountNowAsync,
} from '@/shared/services/hmsStore'
import { FEE_TYPE_LABELS } from '@/shared/utils/discountLimits'

const ReceptionPatientDiscountsPage = () => {
  const { user } = useAuthContext()
  const { isSupabase } = useHmsStoreContext()
  const [tick, setTick] = useState(0)
  const refresh = () => setTick((t) => t + 1)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const pending = useMemo(
    () =>
      getReceptionPendingPatientDiscounts().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [patientDiscounts.length, tick],
  )

  const collect = async (id: string) => {
    setError('')
    setMessage('')
    setSaving(true)
    try {
      if (!collectPatientDiscountPayment(id, user?.id ?? 'staff-002')) {
        setError('Could not collect payment.')
        return
      }
      if (isSupabase) await persistPatientDiscountNowAsync()
      setMessage(
        isSupabase
          ? 'Payment collected, discount applied, and saved to database.'
          : 'Payment collected and discount applied.',
      )
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save to database')
    } finally {
      setSaving(false)
    }
  }

  const getDoctorName = (id: string) => {
    const d = getStaffById(id)
    return d ? `Dr. ${d.firstName} ${d.lastName}` : '—'
  }

  return (
    <PermissionGuard permissions={['receive_payments']}>
      <PageMetaData title="Patient Discounts" />
      <PageHeader
        title="Patient Discounts"
        subtitle="Collect payments for admin-approved patient discounts"
        breadcrumbs={[
          { label: 'Reception', href: '/hms/reception/dashboard' },
          { label: 'Patient Discounts' },
        ]}
      />

      {message && (
        <Alert variant="success" dismissible onClose={() => setMessage('')} className="py-2">
          {message}
        </Alert>
      )}
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')} className="py-2">
          {error}
        </Alert>
      )}

      <Card className="border-0 shadow-sm">
        <CardBody className="p-0">
          <div className="table-responsive">
            <Table hover className="mb-0 align-middle">
              <thead className="bg-light bg-opacity-50">
                <tr>
                  <th>Patient ID</th>
                  <th>Name</th>
                  <th>Doctor</th>
                  <th>Fee Type</th>
                  <th className="text-end">Fee</th>
                  <th className="text-end">Discount</th>
                  <th className="text-end">Amount to collect</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pending.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center text-muted py-5">
                      No patient discounts waiting for payment.
                    </td>
                  </tr>
                ) : (
                  pending.map((row) => {
                    const patient = getPatientById(row.patientId)
                    return (
                      <tr key={row.id}>
                        <td>{patient?.id ?? row.patientId}</td>
                        <td className="fw-medium">{patient?.fullName ?? '—'}</td>
                        <td>{getDoctorName(row.doctorId)}</td>
                        <td>
                          <Badge bg="info-subtle" text="info">
                            {FEE_TYPE_LABELS[row.feeType]}
                          </Badge>
                        </td>
                        <td className="text-end">
                          {currency}
                          {row.feeAmount.toFixed(2)}
                        </td>
                        <td className="text-end text-danger">
                          -{currency}
                          {row.discountAmount.toFixed(2)}
                          {row.discountPercent > 0 && (
                            <span className="text-muted small"> ({row.discountPercent}%)</span>
                          )}
                        </td>
                        <td className="text-end fw-bold">
                          {currency}
                          {row.netAmount.toFixed(2)}
                        </td>
                        <td>
                          <StatusBadge status="Pending" />
                        </td>
                        <td>
                          <Button size="sm" variant="success" disabled={saving} onClick={() => void collect(row.id)}>
                            <IconifyIcon icon="solar:wallet-money-broken" className="me-1" />
                            Collect payment
                          </Button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </Table>
          </div>
        </CardBody>
      </Card>
    </PermissionGuard>
  )
}

export default ReceptionPatientDiscountsPage
