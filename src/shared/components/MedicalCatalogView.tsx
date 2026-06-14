import { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Form, InputGroup, Modal, Row, Table } from 'react-bootstrap'

import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { currency } from '@/context/constants'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import StatusBadge from '@/shared/components/StatusBadge'
import {
  deleteMedicineCatalogEntryAndPersist,
  getInventoryForMedicine,
  inventoryItems,
  medicineCatalog,
  persistMedicalCatalogNowAsync,
  peekNextMedicineCode,
  restockMedicineAndPersist,
  saveMedicineCatalogEntryAndPersist,
  syncAllMedicineActiveStatuses,
  systemSettings,
} from '@/shared/services/hmsStore'
import type { InventoryCategory, MedicineCatalogItem } from '@/shared/types'
import type { Permission } from '@/shared/types/roles'
import {
  downloadMedicalCatalogTemplate,
  importMedicalCatalogFromExcel,
  MEDICAL_CATALOG_HEADERS,
} from '@/shared/utils/medicalCatalogExcel'

const PAGE_SIZE = 10

type CategoryFilter = 'all' | string

const DEFAULT_CATEGORIES: InventoryCategory[] = ['Medicines', 'Medical Supplies', 'Consumables']
const DEFAULT_UNITS = ['Tablet', 'Capsule', 'Vial', 'Box', 'Bag', 'Bottle', 'Piece', 'Strip', 'Ampoule', 'Sachet']

const getStockQty = (item: MedicineCatalogItem) => getInventoryForMedicine(item)?.quantity ?? 0

export type MedicalCatalogViewProps = {
  breadcrumbs: { label: string; href?: string }[]
  permissions: Permission[]
}

const MedicalCatalogView = ({ breadcrumbs, permissions }: MedicalCatalogViewProps) => {
  const { dataVersion, isSupabase } = useHmsStoreContext()
  const [, setRefresh] = useState(0)
  const refresh = () => {
    syncAllMedicineActiveStatuses()
    setRefresh((t) => t + 1)
  }

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showRestockModal, setShowRestockModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [medicineCode, setMedicineCode] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<MedicineCatalogItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'danger' | 'warning'; text: string } | null>(
    null,
  )
  const [pageMessage, setPageMessage] = useState('')
  const [pageError, setPageError] = useState('')

  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [unit, setUnit] = useState('')
  const [newUnit, setNewUnit] = useState('')
  const [showNewUnit, setShowNewUnit] = useState(false)
  const [strength, setStrength] = useState('')
  const [purchasePrice, setPurchasePrice] = useState(0)
  const [sellingPrice, setSellingPrice] = useState(0)
  const [quantityInStock, setQuantityInStock] = useState(0)
  const [reorderLevel, setReorderLevel] = useState(10)

  const [restockItem, setRestockItem] = useState<MedicineCatalogItem | null>(null)
  const [restockQty, setRestockQty] = useState(0)
  const [restockPurchase, setRestockPurchase] = useState(0)
  const [restockSelling, setRestockSelling] = useState(0)
  const [restockReorder, setRestockReorder] = useState(10)

  const nextMedicineCode = useMemo(() => peekNextMedicineCode(), [medicineCatalog.length, systemSettings.medicineCodeNextNumber])

  const categoryOptions = useMemo(() => {
    const fromCatalog = medicineCatalog.map((m) => m.category)
    return [...new Set([...DEFAULT_CATEGORIES, ...fromCatalog])].sort()
  }, [medicineCatalog.length])

  const unitOptions = useMemo(() => {
    const fromCatalog = medicineCatalog.map((m) => m.unit)
    const fromInventory = inventoryItems.map((i) => i.unit)
    return [...new Set([...DEFAULT_UNITS, ...fromCatalog, ...fromInventory])].sort()
  }, [medicineCatalog.length, inventoryItems.length])

  const filterCategories = useMemo(
    () => ['all', ...categoryOptions] as CategoryFilter[],
    [categoryOptions],
  )

  const items = useMemo(() => {
    const q = search.toLowerCase().trim()
    return medicineCatalog
      .filter((m) => categoryFilter === 'all' || m.category === categoryFilter)
      .filter((m) => {
        if (!q) return true
        return `${m.medicineId} ${m.name} ${m.unit} ${m.category} ${m.strength ?? ''}`.toLowerCase().includes(q)
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [search, categoryFilter, medicineCatalog.length, dataVersion])

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return items.slice(start, start + PAGE_SIZE)
  }, [items, safePage])

  const rangeStart = items.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(safePage * PAGE_SIZE, items.length)

  useEffect(() => {
    syncAllMedicineActiveStatuses()
  }, [])

  useEffect(() => {
    setPage(1)
  }, [search, categoryFilter])

  const resetForm = () => {
    setEditId(null)
    setMedicineCode('')
    setFormError('')
    setName('')
    setCategory('Medicines')
    setNewCategory('')
    setShowNewCategory(false)
    setUnit('Tablet')
    setNewUnit('')
    setShowNewUnit(false)
    setStrength('')
    setPurchasePrice(0)
    setSellingPrice(0)
    setQuantityInStock(0)
    setReorderLevel(10)
  }

  const openCreate = () => {
    resetForm()
    setMedicineCode(peekNextMedicineCode())
    setShowModal(true)
  }

  const openEdit = (item: MedicineCatalogItem) => {
    const stock = getInventoryForMedicine(item)
    setEditId(item.id)
    setMedicineCode(item.medicineId)
    setFormError('')
    setName(item.name)
    setCategory(item.category)
    setNewCategory('')
    setShowNewCategory(false)
    setUnit(item.unit)
    setNewUnit('')
    setShowNewUnit(false)
    setStrength(item.strength ?? '')
    setPurchasePrice(item.purchasePrice ?? 0)
    setSellingPrice(item.price)
    setQuantityInStock(stock?.quantity ?? 0)
    setReorderLevel(stock?.reorderLevel ?? 10)
    setShowModal(true)
  }

  const openDelete = (item: MedicineCatalogItem) => {
    setDeleteTarget(item)
    setShowDeleteModal(true)
  }

  const openImport = () => {
    setImportFile(null)
    setImportMessage(null)
    setShowImportModal(true)
  }

  const openRestock = (item: MedicineCatalogItem) => {
    const stock = getInventoryForMedicine(item)
    setRestockItem(item)
    setRestockQty(0)
    setRestockPurchase(item.purchasePrice ?? 0)
    setRestockSelling(item.price)
    setRestockReorder(stock?.reorderLevel ?? 10)
    setShowRestockModal(true)
  }

  const resolveCategory = () => {
    if (showNewCategory) return newCategory.trim()
    return category.trim()
  }

  const resolveUnit = () => {
    if (showNewUnit) return newUnit.trim()
    return unit.trim()
  }

  const handleSave = async () => {
    const finalCategory = resolveCategory()
    const finalUnit = resolveUnit()
    if (!name.trim() || !finalCategory || !finalUnit) {
      setFormError('Medicine name, category, and unit are required.')
      return
    }
    if (sellingPrice < 0 || Number.isNaN(sellingPrice) || purchasePrice < 0 || Number.isNaN(purchasePrice)) {
      setFormError('Prices must be valid non-negative numbers.')
      return
    }

    try {
      setSaving(true)
      const saved = await saveMedicineCatalogEntryAndPersist({
        id: editId ?? undefined,
        medicineId: medicineCode.trim() || undefined,
        name: name.trim(),
        unit: finalUnit,
        category: finalCategory,
        strength: strength.trim() || undefined,
        purchasePrice: purchasePrice || undefined,
        sellingPrice,
        quantityInStock,
        reorderLevel,
      })

      setShowModal(false)
      if (isSupabase) {
        setPageMessage(
          editId
            ? `Medical item ${saved.medicineId} updated. Saved to database.`
            : `Medical item saved with code ${saved.medicineId}. Saved to database.`,
        )
      } else {
        setPageMessage(
          editId
            ? `Medical item ${saved.medicineId} updated. (database mode is off)`
            : `Medical item saved with code ${saved.medicineId}. (database mode is off)`,
        )
      }
      refresh()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save medical item')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    const deletedName = deleteTarget.name
    try {
      setSaving(true)
      if (isSupabase) {
        await deleteMedicineCatalogEntryAndPersist(deleteTarget.id)
        setPageMessage(`${deletedName} deleted. Saved to database.`)
      } else {
        setPageError('Database mode is off — enable VITE_USE_SUPABASE in .env')
        return
      }
      setShowDeleteModal(false)
      setDeleteTarget(null)
      refresh()
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Could not delete medicine')
      refresh()
    } finally {
      setSaving(false)
    }
  }

  const handleRestock = async () => {
    if (!restockItem || restockQty <= 0) return

    try {
      setSaving(true)
      if (isSupabase) {
        await restockMedicineAndPersist({
          medicineId: restockItem.medicineId,
          addQuantity: restockQty,
          purchasePrice: restockPurchase || undefined,
          sellingPrice: restockSelling || undefined,
          reorderLevel: restockReorder,
        })
        setPageMessage(
          `${restockItem.name} restocked — ${restockQty} units added. Status set to Active. Saved to database.`,
        )
      } else {
        setPageError('Database mode is off — enable VITE_USE_SUPABASE in .env')
        return
      }
      setShowRestockModal(false)
      refresh()
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Could not restock medicine')
      refresh()
    } finally {
      setSaving(false)
    }
  }

  const handleImport = async () => {
    if (!importFile) {
      setImportMessage({ type: 'danger', text: 'Please choose an Excel file first.' })
      return
    }

    setImporting(true)
    setImportMessage(null)

    try {
      const result = await importMedicalCatalogFromExcel(importFile)
      const saved = result.imported + result.updated + result.restocked

      if (saved === 0) {
        setImportMessage({
          type: 'danger',
          text: result.errors[0] ?? 'No rows were imported.',
        })
      } else {
        if (isSupabase) {
          await persistMedicalCatalogNowAsync()
        }
        const parts = [
          result.imported > 0 ? `${result.imported} new` : '',
          result.updated > 0 ? `${result.updated} updated` : '',
          result.restocked > 0 ? `${result.restocked} restocked` : '',
          result.skipped > 0 ? `${result.skipped} skipped` : '',
        ].filter(Boolean)

        setImportMessage({
          type: result.errors.length > 0 ? 'warning' : 'success',
          text: `Import complete: ${parts.join(', ')}.${isSupabase ? ' Saved to database.' : ''}`,
        })
        refresh()
        if (result.errors.length === 0) {
          setTimeout(() => setShowImportModal(false), 1800)
        }
      }
    } catch {
      setImportMessage({ type: 'danger', text: 'Could not read the Excel file. Use the template format.' })
    } finally {
      setImporting(false)
    }
  }

  const canSave = name.trim() && resolveCategory() && resolveUnit()

  return (
    <PermissionGuard permissions={permissions}>
      <PageMetaData title="Medical Catalog" />
      <PageHeader
        title="Medical Catalog"
        subtitle="Auto medicine codes, auto status from stock, and restock when end of stock"
        breadcrumbs={breadcrumbs}
        actionLabel="Add Medical"
        actionIcon="solar:add-circle-broken"
        onAction={openCreate}
      >
        <Button variant="outline-primary" onClick={openImport}>
          <IconifyIcon icon="solar:upload-minimalistic-broken" className="me-1" />
          Import / Restock Excel
        </Button>
      </PageHeader>

      {pageMessage && (
        <Alert variant="success" dismissible onClose={() => setPageMessage('')} className="py-2">
          {pageMessage}
        </Alert>
      )}
      {pageError && (
        <Alert variant="danger" dismissible onClose={() => setPageError('')} className="py-2">
          {pageError}
        </Alert>
      )}

      <Card className="mb-3">
        <CardBody>
          <Row className="g-2 align-items-center">
            <Col md={5}>
              <Form.Control
                type="search"
                placeholder="Search code, name, strength..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Col>
            <Col md={7}>
              <div className="d-flex flex-wrap gap-1">
                {filterCategories.map((cat) => (
                  <Button
                    key={cat}
                    size="sm"
                    variant={categoryFilter === cat ? 'primary' : 'outline-secondary'}
                    onClick={() => setCategoryFilter(cat)}
                  >
                    {cat === 'all' ? 'All' : cat}
                  </Button>
                ))}
              </div>
            </Col>
          </Row>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0">
          <div className="table-responsive">
            <Table hover className="mb-0 align-middle">
              <thead className="bg-light bg-opacity-50">
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th>Strength</th>
                  <th className="text-end">Purchase</th>
                  <th className="text-end">Selling</th>
                  <th className="text-end">Stock</th>
                  <th className="text-end">Reorder</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center text-muted py-4">
                      No items match your search or filter.
                    </td>
                  </tr>
                ) : (
                  pageItems.map((m) => {
                    const stock = getInventoryForMedicine(m)
                    const qty = stock?.quantity ?? 0
                    const isOutOfStock = qty <= 0
                    return (
                      <tr key={m.id} className={isOutOfStock ? 'table-danger' : undefined}>
                        <td className={isOutOfStock ? 'text-danger fw-medium' : 'text-muted fw-medium'}>
                          {m.medicineId}
                        </td>
                        <td className={isOutOfStock ? 'text-danger fw-semibold' : 'fw-medium'}>{m.name}</td>
                        <td>
                          <Badge bg={isOutOfStock ? 'danger-subtle' : 'secondary-subtle'} text={isOutOfStock ? 'danger' : 'secondary'}>
                            {m.category}
                          </Badge>
                        </td>
                        <td className={isOutOfStock ? 'text-danger' : undefined}>{m.unit}</td>
                        <td className={isOutOfStock ? 'text-danger' : undefined}>{m.strength ?? '—'}</td>
                        <td className={`text-end ${isOutOfStock ? 'text-danger' : ''}`}>
                          {currency}
                          {(m.purchasePrice ?? 0).toFixed(2)}
                        </td>
                        <td className={`text-end ${isOutOfStock ? 'text-danger' : ''}`}>
                          {currency}
                          {m.price.toFixed(2)}
                        </td>
                        <td className="text-end">
                          <span className={isOutOfStock ? 'text-danger fw-bold' : ''}>{qty}</span>
                        </td>
                        <td className={`text-end ${isOutOfStock ? 'text-danger' : ''}`}>
                          {stock?.reorderLevel ?? '—'}
                        </td>
                        <td>
                          {isOutOfStock ? (
                            <>
                              <Badge bg="danger">Inactive</Badge>
                              <Badge bg="danger-subtle" text="danger" className="ms-1">
                                End of stock
                              </Badge>
                            </>
                          ) : (
                            <StatusBadge status="Active" />
                          )}
                        </td>
                        <td>
                          <div className="d-flex flex-wrap gap-1">
                            <Button size="sm" variant="light" onClick={() => openEdit(m)}>
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant={isOutOfStock ? 'danger' : 'outline-success'}
                              onClick={() => openRestock(m)}
                            >
                              <IconifyIcon icon="solar:box-broken" className="me-1" />
                              Restock
                            </Button>
                            <Button size="sm" variant="outline-danger" onClick={() => openDelete(m)}>
                              Delete
                            </Button>
                          </div>
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
              {items.length === 0
                ? 'Showing 0 records'
                : `Showing ${rangeStart}–${rangeEnd} of ${items.length}`}
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

      <Modal show={showImportModal} onHide={() => setShowImportModal(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Import / Restock from Excel</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {importMessage && (
            <Alert variant={importMessage.type} className="mb-3">
              {importMessage.text}
            </Alert>
          )}

          <p className="text-muted">
            Upload Excel to add new items or <strong>restock existing items</strong> using the same{' '}
            <strong>Medicine Code</strong>. Status becomes Active automatically when quantity is greater than 0.
          </p>

          <div className="border rounded p-3 bg-light bg-opacity-50 mb-3">
            <p className="fw-medium mb-2">Columns</p>
            <p className="small text-muted mb-0">{MEDICAL_CATALOG_HEADERS.join(' · ')}</p>
          </div>

          <Button variant="outline-secondary" className="mb-3" onClick={downloadMedicalCatalogTemplate}>
            <IconifyIcon icon="solar:download-minimalistic-broken" className="me-1" />
            Download template
          </Button>

          <Form.Group>
            <Form.Label>Excel file</Form.Label>
            <Form.Control
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                const target = e.target as HTMLInputElement
                setImportFile(target.files?.[0] ?? null)
                setImportMessage(null)
              }}
            />
            {importFile && <Form.Text className="text-muted">Selected: {importFile.name}</Form.Text>}
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setShowImportModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleImport} disabled={!importFile || importing}>
            {importing ? 'Importing...' : 'Import data'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showRestockModal} onHide={() => setShowRestockModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Restock medicine</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {restockItem && (
            <>
              <div className="border rounded p-3 bg-light bg-opacity-50 mb-3">
                <p className="mb-1">
                  <span className="text-muted small">Medicine Code</span>
                  <br />
                  <strong>{restockItem.medicineId}</strong>
                </p>
                <p className="mb-1">
                  <span className="text-muted small">Name</span>
                  <br />
                  {restockItem.name}
                </p>
                <p className="mb-0">
                  <span className="text-muted small">Current stock</span>
                  <br />
                  <span className="text-danger fw-semibold">{getStockQty(restockItem)}</span>
                </p>
              </div>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Quantity to add</Form.Label>
                    <Form.Control
                      type="number"
                      min={1}
                      value={restockQty || ''}
                      onChange={(e) => setRestockQty(Number(e.target.value))}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Reorder level</Form.Label>
                    <Form.Control
                      type="number"
                      min={0}
                      value={restockReorder}
                      onChange={(e) => setRestockReorder(Number(e.target.value))}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Purchase price</Form.Label>
                    <Form.Control
                      type="number"
                      min={0}
                      step="0.01"
                      value={restockPurchase}
                      onChange={(e) => setRestockPurchase(Number(e.target.value))}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Selling price</Form.Label>
                    <Form.Control
                      type="number"
                      min={0}
                      step="0.01"
                      value={restockSelling}
                      onChange={(e) => setRestockSelling(Number(e.target.value))}
                    />
                  </Form.Group>
                </Col>
              </Row>
              <p className="small text-muted mb-0">
                After restock, status will automatically become <strong>Active</strong>.
              </p>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setShowRestockModal(false)}>
            Cancel
          </Button>
          <Button variant="success" onClick={handleRestock} disabled={!restockQty || restockQty <= 0}>
            Confirm restock
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Delete medicine</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {deleteTarget && (
            <p className="mb-0">
              Delete <strong>{deleteTarget.name}</strong> ({deleteTarget.medicineId})? This cannot be undone.
            </p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} disabled={saving}>
            {saving ? 'Deleting...' : 'Delete'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showModal} onHide={() => setShowModal(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{editId ? 'Edit Medical' : 'Add Medical'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {formError && <Alert variant="danger">{formError}</Alert>}

          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Code *</Form.Label>
                <Form.Control
                  value={medicineCode}
                  onChange={(e) => setMedicineCode(e.target.value.toUpperCase())}
                  placeholder={nextMedicineCode}
                  disabled={Boolean(editId)}
                />
                {!editId && (
                  <Form.Text muted>Leave blank to auto-generate ({nextMedicineCode})</Form.Text>
                )}
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Medicine Name *</Form.Label>
                <Form.Control
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Amoxicillin"
                  required
                />
              </Form.Group>
            </Col>
          </Row>

          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Category</Form.Label>
                {!showNewCategory ? (
                  <>
                    <Form.Select value={category} onChange={(e) => setCategory(e.target.value)}>
                      <option value="">Select category...</option>
                      {categoryOptions.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </Form.Select>
                    <Button
                      variant="link"
                      size="sm"
                      className="px-0 mt-1"
                      onClick={() => setShowNewCategory(true)}
                    >
                      + Add category name
                    </Button>
                  </>
                ) : (
                  <InputGroup>
                    <Form.Control
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      placeholder="New category name"
                    />
                    <Button variant="outline-secondary" onClick={() => setShowNewCategory(false)}>
                      Cancel
                    </Button>
                  </InputGroup>
                )}
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Unit</Form.Label>
                {!showNewUnit ? (
                  <>
                    <Form.Select value={unit} onChange={(e) => setUnit(e.target.value)}>
                      <option value="">Select unit...</option>
                      {unitOptions.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </Form.Select>
                    <Button
                      variant="link"
                      size="sm"
                      className="px-0 mt-1"
                      onClick={() => setShowNewUnit(true)}
                    >
                      + Add unit name
                    </Button>
                  </>
                ) : (
                  <InputGroup>
                    <Form.Control
                      value={newUnit}
                      onChange={(e) => setNewUnit(e.target.value)}
                      placeholder="New unit name"
                    />
                    <Button variant="outline-secondary" onClick={() => setShowNewUnit(false)}>
                      Cancel
                    </Button>
                  </InputGroup>
                )}
              </Form.Group>
            </Col>
          </Row>

          <Row>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Strength</Form.Label>
                <Form.Control
                  value={strength}
                  onChange={(e) => setStrength(e.target.value)}
                  placeholder="e.g. 500mg"
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Purchase Price ({currency})</Form.Label>
                <Form.Control
                  type="number"
                  min={0}
                  step="0.01"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(Number(e.target.value))}
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Selling Price ({currency})</Form.Label>
                <Form.Control
                  type="number"
                  min={0}
                  step="0.01"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(Number(e.target.value))}
                />
              </Form.Group>
            </Col>
          </Row>

          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Quantity in Stock</Form.Label>
                <Form.Control
                  type="number"
                  min={0}
                  value={quantityInStock}
                  onChange={(e) => setQuantityInStock(Number(e.target.value))}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Reorder Level</Form.Label>
                <Form.Control
                  type="number"
                  min={0}
                  value={reorderLevel}
                  onChange={(e) => setReorderLevel(Number(e.target.value))}
                />
              </Form.Group>
            </Col>
          </Row>

          <p className="small text-muted mb-0">
            Status is automatic: <strong>Active</strong> if quantity &gt; 0, <strong className="text-danger">Inactive (red)</strong> if quantity is 0.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button variant="success" onClick={handleSave} disabled={!canSave || saving}>
            <IconifyIcon icon={editId ? 'solar:pen-broken' : 'solar:add-circle-broken'} className="me-1" />
            {saving ? 'Saving...' : editId ? 'Update' : 'Save'}
          </Button>
        </Modal.Footer>
      </Modal>
    </PermissionGuard>
  )
}

export default MedicalCatalogView
