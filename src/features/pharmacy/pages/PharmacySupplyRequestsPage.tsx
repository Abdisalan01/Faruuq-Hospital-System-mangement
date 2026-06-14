import { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Form, Row, Table } from 'react-bootstrap'

import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import AddSupplyRequestModal from '@/features/pharmacy/components/AddSupplyRequestModal'
import { useAuthContext } from '@/context/useAuthContext'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import StatCard from '@/shared/components/StatCard'
import StatusBadge from '@/shared/components/StatusBadge'
import {
  deliverDepartmentSupplyRequest,
  departmentSupplyRequests,
  getStaffById,
  persistSupplyRequestNowAsync,
  touchHmsStore,
} from '@/shared/services/hmsStore'
import type { SupplyRequestDepartment } from '@/shared/types'

const PAGE_SIZE = 8
const ALLOWED_DEPARTMENTS: SupplyRequestDepartment[] = ['Doctor', 'Emergency', 'Laboratory', 'Nursing']

type StatusFilter = 'all' | 'Pending' | 'Approved' | 'Delivered'
type DepartmentFilter = 'all' | SupplyRequestDepartment

const DEPARTMENT_COLORS: Record<SupplyRequestDepartment, { badge: string; text: string }> = {
  Doctor: { badge: 'primary-subtle', text: 'primary' },
  Emergency: { badge: 'danger-subtle', text: 'danger' },
  Laboratory: { badge: 'info-subtle', text: 'info' },
  Nursing: { badge: 'success-subtle', text: 'success' },
}

const PharmacySupplyRequestsPage = () => {
  const { user } = useAuthContext()
  const { isSupabase, dataVersion } = useHmsStoreContext()
  const [tick, setTick] = useState(0)
  const refresh = () => setTick((t) => t + 1)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [departmentFilter, setDepartmentFilter] = useState<DepartmentFilter>('all')
  const [page, setPage] = useState(1)
  const [message, setMessage] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)

  const requests = useMemo(
    () =>
      departmentSupplyRequests
        .filter((r) => ALLOWED_DEPARTMENTS.includes(r.department))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [departmentSupplyRequests.length, tick, dataVersion],
  )

  const stats = useMemo(() => {
    const pending = requests.filter((r) => r.status === 'Pending').length
    const approved = requests.filter((r) => r.status === 'Approved').length
    const delivered = requests.filter((r) => r.status === 'Delivered').length
    return { pending, approved, delivered, total: requests.length }
  }, [requests])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return requests.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (departmentFilter !== 'all' && r.department !== departmentFilter) return false
      if (!q) return true

      const staff = getStaffById(r.requesterId)
      const requester = staff ? `${staff.firstName} ${staff.lastName}` : ''
      const items = r.items.map((i) => i.supplyName).join(' ')
      const hay = `${r.department} ${requester} ${r.requesterName ?? ''} ${items} ${r.notes ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [requests, search, statusFilter, departmentFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, safePage])

  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filtered.length)

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, departmentFilter])

  const approve = async (id: string) => {
    const req = departmentSupplyRequests.find((r) => r.id === id)
    if (!req || req.status !== 'Pending') return

    req.status = 'Approved'
    touchHmsStore()

    try {
      if (isSupabase) await persistSupplyRequestNowAsync()
      setMessage(`Request approved.${isSupabase ? ' Saved to database.' : ''}`)
    } catch {
      setMessage('Approved locally but database save failed.')
    }
    refresh()
  }

  const deliver = async (id: string) => {
    const result = deliverDepartmentSupplyRequest(id, user?.id ?? 'staff-006')
    if (!result.ok) {
      setMessage(result.error ?? 'Could not deliver.')
      return
    }

    try {
      if (isSupabase) await persistSupplyRequestNowAsync()
      setMessage(`Items delivered and stock deducted.${isSupabase ? ' Saved to database.' : ''}`)
    } catch {
      setMessage('Delivered locally but database save failed.')
    }
    refresh()
  }

  const getRequesterDisplay = (req: (typeof requests)[number]) => {
    if (req.requesterName?.trim()) return req.requesterName.trim()
    const staff = getStaffById(req.requesterId)
    if (!staff) return '—'
    const name = `${staff.firstName} ${staff.lastName}`
    return req.department === 'Doctor' ? `Dr. ${name}` : name
  }

  const formatItems = (items: { supplyName: string; quantity: number; unit: string }[]) =>
    items.map((i) => `${i.supplyName} ×${i.quantity} ${i.unit}`).join(', ')

  return (
    <PermissionGuard permissions={['inventory_management']}>
      <PageMetaData title="Supply Requests" />
      <PageHeader
        title="Supply Requests"
        subtitle="Incoming orders from Doctor, Emergency, Laboratory, and Nursing"
        breadcrumbs={[
          { label: 'Pharmacy', href: '/hms/pharmacy/dashboard' },
          { label: 'Supply Requests' },
        ]}
        actionLabel="Add Request"
        actionIcon="solar:add-circle-broken"
        onAction={() => setShowAddModal(true)}
      />

      {message && (
        <Alert variant="success" dismissible onClose={() => setMessage('')} className="py-2">
          {message}
        </Alert>
      )}

      <Row className="mb-3">
        <StatCard title="Pending" value={stats.pending} icon="solar:clock-circle-broken" variant="warning" />
        <StatCard title="Approved" value={stats.approved} icon="solar:check-circle-broken" variant="info" />
        <StatCard title="Delivered" value={stats.delivered} icon="solar:delivery-broken" variant="success" />
        <StatCard title="Total Requests" value={stats.total} icon="solar:box-broken" variant="primary" />
      </Row>

      <Card className="mb-3 border-0 shadow-sm">
        <CardBody>
          <Row className="g-2 align-items-center">
            <Col md={4}>
              <Form.Control
                type="search"
                placeholder="Search department, requester, items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Col>
            <Col md={8}>
              <div className="d-flex flex-wrap gap-1 mb-2">
                <span className="small text-muted align-self-center me-1">Status:</span>
                {(
                  [
                    ['all', 'All'],
                    ['Pending', 'Pending'],
                    ['Approved', 'Approved'],
                    ['Delivered', 'Delivered'],
                  ] as const
                ).map(([key, label]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={statusFilter === key ? 'dark' : 'outline-secondary'}
                    onClick={() => setStatusFilter(key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <div className="d-flex flex-wrap gap-1">
                <span className="small text-muted align-self-center me-1">Department:</span>
                <Button
                  size="sm"
                  variant={departmentFilter === 'all' ? 'primary' : 'outline-secondary'}
                  onClick={() => setDepartmentFilter('all')}
                >
                  All
                </Button>
                {ALLOWED_DEPARTMENTS.map((dept) => (
                  <Button
                    key={dept}
                    size="sm"
                    variant={departmentFilter === dept ? 'primary' : 'outline-secondary'}
                    onClick={() => setDepartmentFilter(dept)}
                  >
                    {dept}
                  </Button>
                ))}
              </div>
            </Col>
          </Row>
        </CardBody>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardBody className="p-0">
          <div className="table-responsive">
            <Table hover className="mb-0 align-middle">
              <thead className="bg-light bg-opacity-50">
                <tr>
                  <th>Date</th>
                  <th>Department</th>
                  <th>Requester</th>
                  <th>Items</th>
                  <th>Notes</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-5">
                      <IconifyIcon icon="solar:box-minimalistic-broken" className="fs-48 mb-2 d-block mx-auto" />
                      No supply requests match your filters.
                    </td>
                  </tr>
                ) : (
                  pageItems.map((req) => {
                    const colors = DEPARTMENT_COLORS[req.department]
                    return (
                      <tr key={req.id}>
                        <td className="small text-nowrap">
                          {new Date(req.createdAt).toLocaleString()}
                        </td>
                        <td>
                          <Badge bg={colors.badge} text={colors.text}>
                            {req.department}
                          </Badge>
                        </td>
                        <td className="fw-medium">{getRequesterDisplay(req)}</td>
                        <td className="small" style={{ maxWidth: 280 }}>
                          {formatItems(req.items)}
                        </td>
                        <td className="small text-muted">{req.notes ?? '—'}</td>
                        <td>
                          <StatusBadge status={req.status} />
                        </td>
                        <td>
                          {req.status === 'Pending' ? (
                            <Button
                              size="sm"
                              variant="outline-primary"
                              onClick={() => void approve(req.id)}
                            >
                              <IconifyIcon icon="solar:check-circle-broken" className="me-1" />
                              Approve
                            </Button>
                          ) : req.status === 'Approved' ? (
                            <Button
                              size="sm"
                              variant="outline-success"
                              onClick={() => void deliver(req.id)}
                            >
                              <IconifyIcon icon="solar:delivery-broken" className="me-1" />
                              Deliver
                            </Button>
                          ) : (
                            <span className="text-muted small">Completed</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </Table>
          </div>

          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 p-3 border-top">
            <p className="text-muted small mb-0">
              {filtered.length === 0
                ? 'Showing 0 records'
                : `Showing ${rangeStart}–${rangeEnd} of ${filtered.length}`}
            </p>
            <div className="d-flex gap-2">
              <Button
                size="sm"
                variant="outline-secondary"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
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
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
                <IconifyIcon icon="solar:alt-arrow-right-broken" className="ms-1" />
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      <AddSupplyRequestModal
        show={showAddModal}
        onHide={() => setShowAddModal(false)}
        onSaved={() => {
          refresh()
          setMessage('Supply request added.')
        }}
      />
    </PermissionGuard>
  )
}

export default PharmacySupplyRequestsPage
