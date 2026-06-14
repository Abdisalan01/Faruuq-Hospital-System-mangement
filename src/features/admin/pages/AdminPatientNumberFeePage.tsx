import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, CardBody, Col, Form, Row, Table } from 'react-bootstrap'

import PageMetaData from '@/components/PageTitle'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import TablePagination from '@/shared/components/TablePagination'
import { useTablePagination } from '@/shared/hooks/useTablePagination'
import { currency } from '@/context/constants'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import {
  getReferralStaffForRegistration,
  getStaffRegistrationFee,
  persistRegistrationFeesNowAsync,
  setRegistrationFeeForAllReferralStaff,
  setStaffRegistrationFee,
} from '@/shared/services/hmsStore'
import { ROLE_LABELS } from '@/shared/types/roles'

const AdminPatientNumberFeePage = () => {
  const { dataVersion, isSupabase } = useHmsStoreContext()
  const referralStaff = useMemo(
    () => getReferralStaffForRegistration(),
    [dataVersion],
  )
  const defaultStaffId = referralStaff[0]?.id ?? ''

  const [selectedStaffId, setSelectedStaffId] = useState(defaultStaffId)
  const [individualFee, setIndividualFee] = useState(
    defaultStaffId ? getStaffRegistrationFee(defaultStaffId) : 0,
  )
  const [bulkFee, setBulkFee] = useState(10)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (selectedStaffId) {
      setIndividualFee(getStaffRegistrationFee(selectedStaffId))
    }
  }, [dataVersion, selectedStaffId])

  const showMessage = (text: string) => {
    setMessage(text)
    setTimeout(() => setMessage(''), 3500)
  }

  const handleStaffChange = (staffId: string) => {
    setSelectedStaffId(staffId)
    if (staffId) setIndividualFee(getStaffRegistrationFee(staffId))
  }

  const persistFees = async (successText: string) => {
    if (!isSupabase) {
      showMessage(successText)
      return
    }

    setSaving(true)
    try {
      await persistRegistrationFeesNowAsync()
      showMessage(`${successText} Saved to database.`)
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Unknown error'
      showMessage(`Database save failed: ${detail}`)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveIndividual = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStaffId) {
      showMessage('Select a doctor or emergency staff first.')
      return
    }
    setStaffRegistrationFee(selectedStaffId, individualFee)
    void persistFees('Fee saved for selected staff.')
  }

  const handleApplyAll = () => {
    setRegistrationFeeForAllReferralStaff(bulkFee)
    void persistFees(`Same fee (${currency}${bulkFee}) applied to all doctors and emergency staff.`)
  }

  const selectedStaff = referralStaff.find((s) => s.id === selectedStaffId)

  const referralStaffPagination = useTablePagination(referralStaff, 10, [referralStaff.length, dataVersion])

  return (
    <PermissionGuard permissions={['system_settings']}>
      <PageMetaData title="Patient Number Fee" />
      <PageHeader
        title="Registration Fee / Patient Number Fee"
        subtitle="Set registration fee per doctor or apply one fee to everyone"
        breadcrumbs={[
          { label: 'Hospital Dashboard', href: '/hms/dashboard' },
          { label: 'Patient Number Fee' },
        ]}
      />

      {message && <Alert variant="success" className="py-2">{message}</Alert>}

      <Row className="g-3 mb-3">
        <Col lg={6}>
          <Card className="h-100">
            <CardBody>
              <h5 className="mb-3">Set fee for one doctor</h5>
              <Form onSubmit={(e) => void handleSaveIndividual(e)}>
                <Form.Group className="mb-3">
                  <Form.Label>Select Doctor / Emergency</Form.Label>
                  <Form.Select
                    value={selectedStaffId}
                    onChange={(e) => handleStaffChange(e.target.value)}
                    required>
                    <option value="">Choose…</option>
                    {referralStaff.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.role === 'doctor'
                          ? `Dr. ${staff.firstName} ${staff.lastName}`
                          : `${staff.firstName} ${staff.lastName} (Emergency)`}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Registration Fee ({currency})</Form.Label>
                  <Form.Control
                    type="number"
                    min={0}
                    step={0.01}
                    value={individualFee}
                    onChange={(e) => setIndividualFee(Number(e.target.value))}
                    required
                  />
                </Form.Group>
                {selectedStaff && (
                  <p className="text-muted small mb-3">
                    Current: {ROLE_LABELS[selectedStaff.role]} —{' '}
                    <strong>
                      {currency}
                      {getStaffRegistrationFee(selectedStaff.id).toLocaleString()}
                    </strong>
                  </p>
                )}
                <Button type="submit" variant="success" disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </Form>
            </CardBody>
          </Card>
        </Col>

        <Col lg={6}>
          <Card className="h-100">
            <CardBody>
              <h5 className="mb-3">Same fee for everyone</h5>
              <Form.Group className="mb-3">
                <Form.Label>One fee for all ({currency})</Form.Label>
                <Form.Control
                  type="number"
                  min={0}
                  step={0.01}
                  value={bulkFee}
                  onChange={(e) => setBulkFee(Number(e.target.value))}
                />
                <Form.Text className="text-muted">
                  Apply one registration fee to many staff at once.
                </Form.Text>
              </Form.Group>
              <Button variant="primary" onClick={handleApplyAll} disabled={saving}>
                Apply to all doctors & emergency
              </Button>
            </CardBody>
          </Card>
        </Col>
      </Row>

      <Card>
        <CardBody>
          <h5 className="mb-3">Current fees</h5>
          <div className="table-responsive">
            <Table hover className="mb-0">
              <thead className="bg-light bg-opacity-50">
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Registration Fee</th>
                </tr>
              </thead>
              <tbody>
                {referralStaff.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center text-muted py-4">
                      No doctors or emergency staff yet. Add users first.
                    </td>
                  </tr>
                ) : (
                  referralStaffPagination.pageItems.map((staff) => (
                    <tr key={staff.id}>
                      <td className="fw-medium">
                        {staff.role === 'doctor'
                          ? `Dr. ${staff.firstName} ${staff.lastName}`
                          : `${staff.firstName} ${staff.lastName}`}
                      </td>
                      <td>{ROLE_LABELS[staff.role]}</td>
                      <td>
                        {currency}
                        {getStaffRegistrationFee(staff.id).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
          <TablePagination
            className="pt-3 border-top mt-3"
            totalItems={referralStaffPagination.totalItems}
            rangeStart={referralStaffPagination.rangeStart}
            rangeEnd={referralStaffPagination.rangeEnd}
            safePage={referralStaffPagination.safePage}
            totalPages={referralStaffPagination.totalPages}
            onPageChange={referralStaffPagination.setPage}
          />
        </CardBody>
      </Card>
    </PermissionGuard>
  )
}

export default AdminPatientNumberFeePage
