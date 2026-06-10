import { useMemo } from 'react'
import { Badge, Card, CardBody, Col, Row, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'

import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { currency } from '@/context/constants'
import { useAuthContext } from '@/context/useAuthContext'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import StatCard from '@/shared/components/StatCard'
import StatusBadge from '@/shared/components/StatusBadge'
import {
  departmentSupplyRequests,
  getInventoryForMedicine,
  getNursingInpatientMedicineRequests,
  getPatientById,
  inventoryItems as storeInventory,
  medicineCatalog,
  prescriptions as storePrescriptions,
} from '@/shared/services/hmsStore'

const QUICK_ACTIONS = [
  {
    label: 'Medical Catalog',
    icon: 'solar:pill-broken',
    href: '/hms/pharmacy/catalog',
    variant: 'primary',
  },
  {
    label: 'Stock Transactions',
    icon: 'solar:box-broken',
    href: '/hms/pharmacy/stock',
    variant: 'success',
  },
  {
    label: 'Supply Requests',
    icon: 'solar:clipboard-list-broken',
    href: '/hms/pharmacy/supply-requests',
    variant: 'warning',
  },
  {
    label: 'Inpatient Medicine Requests',
    icon: 'solar:document-medicine-broken',
    href: '/hms/pharmacy/prescriptions',
    variant: 'info',
  },
] as const

const PharmacyDashboardPage = () => {
  const { user } = useAuthContext()

  const stats = useMemo(() => {
    const catalogCount = medicineCatalog.length
    const lowStock = storeInventory.filter((i) => i.quantity <= i.reorderLevel).length
    const outOfStock = medicineCatalog.filter((m) => (getInventoryForMedicine(m)?.quantity ?? 0) <= 0).length
    const totalValue = storeInventory.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)
    const pendingRx = getNursingInpatientMedicineRequests('Pending').length
    const dispensedRx = getNursingInpatientMedicineRequests('Dispensed').length
    const pendingSupply = departmentSupplyRequests.filter((r) => r.status === 'Pending').length
    return { catalogCount, lowStock, outOfStock, totalValue, pendingRx, dispensedRx, pendingSupply }
  }, [storeInventory.length, storePrescriptions.length, medicineCatalog.length, departmentSupplyRequests.length])

  const lowStockItems = useMemo(
    () =>
      storeInventory
        .filter((i) => i.quantity <= i.reorderLevel)
        .sort((a, b) => a.quantity - b.quantity)
        .slice(0, 6),
    [storeInventory.length],
  )

  const pendingSupplyRequests = useMemo(
    () =>
      departmentSupplyRequests
        .filter((r) => r.status === 'Pending')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 6),
    [departmentSupplyRequests.length],
  )

  const pendingPrescriptions = useMemo(
    () => getNursingInpatientMedicineRequests('Pending').slice(0, 6),
    [storePrescriptions.length],
  )

  return (
    <PermissionGuard permissions={['inventory_management']}>
      <PageMetaData title="Pharmacy Dashboard" />
      <PageHeader
        title="Pharmacy Dashboard"
        subtitle="Inventory, supply requests, and dispensing overview"
        breadcrumbs={[{ label: 'Pharmacy Dashboard' }]}
        actionLabel="Add to Catalog"
        actionHref="/hms/pharmacy/catalog"
        actionIcon="solar:add-circle-broken"
      />

      <Card className="mb-4 border-0 shadow-sm overflow-hidden">
        <CardBody className="p-4 bg-success bg-opacity-10">
          <Row className="align-items-center g-3">
            <Col md={8}>
              <div className="d-flex align-items-center gap-3">
                <div className="avatar-lg bg-success bg-opacity-25 rounded-circle flex-centered">
                  <IconifyIcon icon="solar:pill-broken" className="fs-32 text-success" />
                </div>
                <div>
                  <p className="text-success fw-medium mb-1">Welcome back</p>
                  <h4 className="mb-1">
                    {user?.firstName} {user?.lastName}
                  </h4>
                  <p className="text-muted mb-0">
                    Manage medical stock, approve supply requests, and dispense prescriptions from one place.
                  </p>
                </div>
              </div>
            </Col>
            <Col md={4}>
              <div className="d-flex flex-wrap gap-2 justify-content-md-end">
                {QUICK_ACTIONS.map((action) => (
                  <Link
                    key={action.href}
                    to={action.href}
                    className={`btn btn-${action.variant} btn-sm`}
                  >
                    <IconifyIcon icon={action.icon} className="me-1" />
                    {action.label}
                  </Link>
                ))}
              </div>
            </Col>
          </Row>
        </CardBody>
      </Card>

      <Row className="mb-3">
        <StatCard
          title="Catalog Items"
          value={stats.catalogCount}
          icon="solar:pill-broken"
          variant="primary"
          link="/hms/pharmacy/catalog"
          linkLabel="Open catalog"
        />
        <StatCard
          title="Low Stock"
          value={stats.lowStock}
          icon="solar:danger-triangle-broken"
          variant="danger"
          link="/hms/pharmacy/stock"
          linkLabel="View stock"
        />
        <StatCard
          title="Pending Supply"
          value={stats.pendingSupply}
          icon="solar:clipboard-list-broken"
          variant="warning"
          link="/hms/pharmacy/supply-requests"
          linkLabel="Review requests"
        />
        <StatCard
          title="Inpatient Requests"
          value={stats.pendingRx}
          icon="solar:document-medicine-broken"
          variant="info"
          link="/hms/pharmacy/prescriptions"
          linkLabel="View requests"
        />
      </Row>

      <Row className="mb-3">
        <StatCard
          title="Stock Value"
          value={`${currency}${stats.totalValue.toFixed(2)}`}
          icon="solar:dollar-minimalistic-broken"
          variant="success"
          link="/hms/pharmacy/stock"
          linkLabel="Stock transactions"
        />
        <StatCard
          title="Out of Stock"
          value={stats.outOfStock}
          icon="solar:close-circle-broken"
          variant="danger"
          link="/hms/pharmacy/catalog"
          linkLabel="Restock items"
        />
        <StatCard
          title="Dispensed Today"
          value={stats.dispensedRx}
          icon="solar:check-circle-broken"
          variant="success"
          link="/hms/pharmacy/prescriptions"
          linkLabel="Medicine requests"
        />
        <Col md={6} xl={3}>
          <Card className="h-100 border-0 shadow-sm">
            <CardBody className="d-flex flex-column justify-content-center">
              <p className="text-muted mb-2">Quick tip</p>
              <p className="mb-3 small">
                Items with zero stock appear <Badge bg="danger">Inactive</Badge> in Medical Catalog. Use Restock to
                activate again.
              </p>
              <Link to="/hms/pharmacy/catalog" className="btn btn-outline-success btn-sm align-self-start">
                Go to Medical Catalog
              </Link>
            </CardBody>
          </Card>
        </Col>
      </Row>

      <Row className="g-3">
        <Col xl={6}>
          <Card className="h-100 border-0 shadow-sm">
            <CardBody>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="mb-0">
                  <IconifyIcon icon="solar:clipboard-list-broken" className="me-1 text-warning" />
                  Pending Supply Requests
                </h5>
                <Link to="/hms/pharmacy/supply-requests" className="btn btn-sm btn-soft-warning">
                  View all
                </Link>
              </div>
              <div className="table-responsive">
                <Table hover size="sm" className="mb-0 align-middle">
                  <thead className="bg-light bg-opacity-50">
                    <tr>
                      <th>Department</th>
                      <th>Items</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingSupplyRequests.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-center text-muted py-4">
                          No pending supply requests
                        </td>
                      </tr>
                    ) : (
                      pendingSupplyRequests.map((req) => (
                        <tr key={req.id}>
                          <td>
                            <Badge bg="secondary-subtle" text="secondary">
                              {req.department}
                            </Badge>
                          </td>
                          <td className="small">
                            {req.items.map((i) => i.supplyName).join(', ')}
                          </td>
                          <td className="small text-nowrap">
                            {new Date(req.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              </div>
            </CardBody>
          </Card>
        </Col>

        <Col xl={6}>
          <Card className="h-100 border-0 shadow-sm">
            <CardBody>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="mb-0">
                  <IconifyIcon icon="solar:danger-triangle-broken" className="me-1 text-danger" />
                  Low Stock Alert
                </h5>
                <Link to="/hms/pharmacy/stock" className="btn btn-sm btn-soft-danger">
                  Manage stock
                </Link>
              </div>
              <div className="table-responsive">
                <Table hover size="sm" className="mb-0 align-middle">
                  <thead className="bg-light bg-opacity-50">
                    <tr>
                      <th>Item</th>
                      <th>Qty</th>
                      <th>Reorder</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStockItems.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center text-muted py-4">
                          All items are above reorder level
                        </td>
                      </tr>
                    ) : (
                      lowStockItems.map((item) => (
                        <tr key={item.id} className={item.quantity <= 0 ? 'table-danger' : undefined}>
                          <td className="fw-medium">{item.name}</td>
                          <td className={item.quantity <= 0 ? 'text-danger fw-semibold' : ''}>{item.quantity}</td>
                          <td>{item.reorderLevel}</td>
                          <td>
                            <StatusBadge status={item.quantity <= 0 ? 'Inactive' : 'Active'} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              </div>
            </CardBody>
          </Card>
        </Col>
      </Row>

      {pendingPrescriptions.length > 0 && (
        <Card className="mt-3 border-0 shadow-sm">
          <CardBody>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="mb-0">
                <IconifyIcon icon="solar:document-medicine-broken" className="me-1 text-info" />
                Inpatient Medicine Requests (Nursing)
              </h5>
              <Link to="/hms/pharmacy/prescriptions" className="btn btn-sm btn-soft-info">
                View all
              </Link>
            </div>
            <div className="table-responsive">
              <Table hover size="sm" className="mb-0 align-middle">
                <thead className="bg-light bg-opacity-50">
                  <tr>
                    <th>Patient</th>
                    <th>Medicines</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingPrescriptions.map((rx) => {
                    const patient = getPatientById(rx.patientId)
                    return (
                      <tr key={rx.id}>
                        <td>{patient?.fullName ?? '—'}</td>
                        <td className="small">
                          {rx.items.map((i) => i.medicine).join(', ')}
                        </td>
                        <td>
                          <StatusBadge status={rx.status} />
                        </td>
                        <td className="small text-nowrap">
                          {new Date(rx.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            </div>
          </CardBody>
        </Card>
      )}
    </PermissionGuard>
  )
}

export default PharmacyDashboardPage
