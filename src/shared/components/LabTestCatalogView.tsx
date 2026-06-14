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
  deleteLabTestCatalogEntry,
  labTestCatalog,
  persistLabCatalogNowAsync,
  peekNextLabTestCode,
  saveLabTestCatalogEntry,
  systemSettings,
} from '@/shared/services/hmsStore'
import type { LabTestCatalog } from '@/shared/types'
import { DEFAULT_LAB_TEST_CATEGORIES } from '@/shared/types'
import type { Permission } from '@/shared/types/roles'
import {
  downloadLabTestCatalogTemplate,
  importLabTestCatalogFromExcel,
  LAB_TEST_CATALOG_HEADERS,
} from '@/shared/utils/labTestCatalogExcel'

const PAGE_SIZE = 10

type CategoryFilter = 'all' | string

export type LabTestCatalogViewProps = {
  breadcrumbs: { label: string; href?: string }[]
  permissions: Permission[]
  readOnly?: boolean
  title?: string
  subtitle?: string
}

const emptyForm = (): {
  testId: string
  testName: string
  category: string
  price: number
  unitReference: string
  isActive: boolean
} => ({
  testId: '',
  testName: '',
  category: DEFAULT_LAB_TEST_CATEGORIES[0],
  price: 0,
  unitReference: '',
  isActive: true,
})

const LabTestCatalogView = ({
  breadcrumbs,
  permissions,
  readOnly = false,
  title = 'Lab Tests Catalog',
  subtitle = 'Manage Lab ID, test name, category, price, and unit reference',
}: LabTestCatalogViewProps) => {
  const { dataVersion, isSupabase } = useHmsStoreContext()

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LabTestCatalog | null>(null)
  const [pageMessage, setPageMessage] = useState('')
  const [pageError, setPageError] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'danger' | 'warning'; text: string } | null>(
    null,
  )

  const [form, setForm] = useState(emptyForm())
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newCategory, setNewCategory] = useState('')

  const categoryOptions = useMemo(() => {
    const fromCatalog = labTestCatalog.map((t) => t.category)
    return [...new Set([...DEFAULT_LAB_TEST_CATEGORIES, ...fromCatalog])].sort((a, b) =>
      a.localeCompare(b),
    )
  }, [labTestCatalog.length, dataVersion])

  const filterCategories = useMemo(
    () => ['all', ...categoryOptions] as CategoryFilter[],
    [categoryOptions],
  )

  const nextTestCode = useMemo(
    () => peekNextLabTestCode(),
    [labTestCatalog.length, systemSettings.labTestCodeNextNumber, dataVersion],
  )

  const items = useMemo(() => {
    const q = search.toLowerCase().trim()
    return labTestCatalog
      .filter((t) => categoryFilter === 'all' || t.category === categoryFilter)
      .filter((t) => {
        if (!q) return true
        return `${t.testId} ${t.testName} ${t.category} ${t.unitReference ?? ''}`.toLowerCase().includes(q)
      })
      .sort((a, b) => a.category.localeCompare(b.category) || a.testName.localeCompare(b.testName))
  }, [search, categoryFilter, dataVersion, labTestCatalog.length])

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return items.slice(start, start + PAGE_SIZE)
  }, [items, safePage])

  useEffect(() => {
    setPage(1)
  }, [search, categoryFilter])

  const openCreate = () => {
    setEditId(null)
    setForm({ ...emptyForm(), testId: peekNextLabTestCode() })
    setShowNewCategory(false)
    setNewCategory('')
    setFormError('')
    setShowModal(true)
  }

  const openEdit = (item: LabTestCatalog) => {
    setEditId(item.id)
    setForm({
      testId: item.testId,
      testName: item.testName,
      category: item.category,
      price: item.price,
      unitReference: item.unitReference ?? item.normalRange ?? item.unit ?? '',
      isActive: item.isActive,
    })
    setShowNewCategory(false)
    setNewCategory('')
    setFormError('')
    setShowModal(true)
  }

  const openDelete = (item: LabTestCatalog) => {
    setDeleteTarget(item)
    setShowDeleteModal(true)
  }

  const persistCatalog = async (successMessage: string) => {
    setPageError('')
    if (!isSupabase) {
      setPageMessage(`${successMessage} (database mode is off — enable VITE_USE_SUPABASE in .env)`)
      return
    }

    setSaving(true)
    try {
      await persistLabCatalogNowAsync()
      setPageMessage(`${successMessage} Saved to database.`)
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Unknown error'
      setPageError(`Database save failed: ${detail}`)
    } finally {
      setSaving(false)
    }
  }

  const openImport = () => {
    setImportFile(null)
    setImportMessage(null)
    setShowImportModal(true)
  }

  const resolveCategory = () => {
    if (showNewCategory) return newCategory.trim()
    return form.category.trim()
  }

  const handleSave = async () => {
    const finalCategory = resolveCategory()
    if (!form.testName.trim()) {
      setFormError('Test name is required')
      return
    }
    if (!finalCategory) {
      setFormError('Category is required')
      return
    }
    if (form.price < 0 || Number.isNaN(form.price)) {
      setFormError('Price must be a valid non-negative number')
      return
    }

    try {
      saveLabTestCatalogEntry({
        id: editId ?? undefined,
        testId: form.testId,
        testName: form.testName,
        category: finalCategory,
        price: form.price,
        unitReference: form.unitReference,
        isActive: form.isActive,
      })
      setShowModal(false)
      await persistCatalog(editId ? 'Test updated.' : 'Test added.')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save test')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      deleteLabTestCatalogEntry(deleteTarget.id)
      setShowDeleteModal(false)
      setDeleteTarget(null)
      await persistCatalog(`Test "${deleteTarget.testName}" deleted.`)
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Could not delete test')
    }
  }

  const toggleActive = async (item: LabTestCatalog) => {
    saveLabTestCatalogEntry({
      id: item.id,
      testId: item.testId,
      testName: item.testName,
      category: item.category,
      price: item.price,
      unitReference: item.unitReference,
      isActive: !item.isActive,
    })
    await persistCatalog(item.isActive ? 'Test deactivated.' : 'Test activated.')
  }

  const handleImport = async () => {
    if (!importFile) {
      setImportMessage({ type: 'danger', text: 'Please choose an Excel file first.' })
      return
    }

    setImporting(true)
    setImportMessage(null)

    try {
      const result = await importLabTestCatalogFromExcel(importFile)
      const saved = result.imported + result.updated

      if (saved === 0) {
        setImportMessage({
          type: 'danger',
          text: result.errors[0] ?? 'No rows were imported.',
        })
      } else {
        if (isSupabase) {
          await persistLabCatalogNowAsync()
        }
        const parts = [
          result.imported > 0 ? `${result.imported} new` : '',
          result.updated > 0 ? `${result.updated} updated` : '',
          result.skipped > 0 ? `${result.skipped} skipped` : '',
        ].filter(Boolean)

        setImportMessage({
          type: result.errors.length > 0 ? 'warning' : 'success',
          text: `Import complete: ${parts.join(', ')}.${isSupabase ? ' Saved to database.' : ''}`,
        })
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

  const updateForm = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <PermissionGuard permissions={permissions}>
      <PageMetaData title={title} />
      <PageHeader
        title={title}
        subtitle={subtitle}
        breadcrumbs={breadcrumbs}
        actionLabel={readOnly ? undefined : 'Add Test'}
        actionIcon="solar:add-circle-broken"
        onAction={readOnly ? undefined : openCreate}
      >
        {!readOnly && (
          <Button variant="outline-primary" onClick={openImport}>
            <IconifyIcon icon="solar:upload-minimalistic-broken" className="me-1" />
            Import Excel
          </Button>
        )}
      </PageHeader>

      {pageMessage && (
        <Alert variant="success" dismissible onClose={() => setPageMessage('')}>
          {pageMessage}
        </Alert>
      )}
      {pageError && (
        <Alert variant="danger" dismissible onClose={() => setPageError('')}>
          {pageError}
        </Alert>
      )}

      <Card>
        <CardBody>
          <Row className="g-3 mb-3">
            <Col md={8}>
              <InputGroup>
                <InputGroup.Text>
                  <IconifyIcon icon="solar:magnifer-broken" />
                </InputGroup.Text>
                <Form.Control
                  placeholder="Search by Lab ID, name, category, unit reference..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </InputGroup>
            </Col>
            <Col md={3}>
              <Form.Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">All categories</option>
                {filterCategories
                  .filter((c) => c !== 'all')
                  .map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </Form.Select>
            </Col>
            <Col md={1} className="d-flex align-items-center justify-content-end text-muted small">
              {items.length} tests
            </Col>
          </Row>

          <div className="table-responsive">
            <Table hover className="mb-0 align-middle">
              <thead className="bg-light bg-opacity-50">
                <tr>
                  <th>Lab ID</th>
                  <th>Test Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Unit Reference</th>
                  <th>Status</th>
                  {!readOnly && <th />}
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={readOnly ? 6 : 7} className="text-center text-muted py-4">
                      No tests found
                    </td>
                  </tr>
                ) : (
                  pageItems.map((t) => (
                    <tr key={t.id} className={!t.isActive ? 'text-muted' : undefined}>
                      <td className="fw-medium">{t.testId}</td>
                      <td>{t.testName}</td>
                      <td>
                        <Badge bg="light" text="dark">
                          {t.category}
                        </Badge>
                      </td>
                      <td>
                        {currency}
                        {t.price.toLocaleString()}
                      </td>
                      <td className="small">{t.unitReference ?? '—'}</td>
                      <td>
                        <StatusBadge status={t.isActive ? 'Active' : 'Inactive'} />
                      </td>
                      {!readOnly && (
                        <td className="text-end">
                          <Button size="sm" variant="light" className="me-1" onClick={() => openEdit(t)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="outline-secondary" className="me-1" onClick={() => toggleActive(t)}>
                            {t.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button size="sm" variant="outline-danger" onClick={() => openDelete(t)}>
                            Delete
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center mt-3">
              <span className="text-muted small">
                Page {safePage} of {totalPages}
              </span>
              <div className="d-flex gap-2">
                <Button size="sm" variant="light" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="light"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(safePage + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {!readOnly && (
        <Modal show={showModal} onHide={() => setShowModal(false)} centered size="lg">
          <Modal.Header closeButton>
            <Modal.Title>{editId ? 'Edit Lab Test' : 'Add Lab Test'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {formError && <Alert variant="danger">{formError}</Alert>}
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Lab ID *</Form.Label>
                  <Form.Control
                    value={form.testId}
                    onChange={(e) => updateForm('testId', e.target.value)}
                    placeholder={nextTestCode}
                    disabled={Boolean(editId)}
                  />
                  {!editId && <Form.Text muted>Leave blank to auto-generate ({nextTestCode})</Form.Text>}
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Status</Form.Label>
                  <Form.Select
                    value={form.isActive ? 'active' : 'inactive'}
                    onChange={(e) => updateForm('isActive', e.target.value === 'active')}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
            <Form.Group className="mb-3">
              <Form.Label>Test Name *</Form.Label>
              <Form.Control value={form.testName} onChange={(e) => updateForm('testName', e.target.value)} required />
            </Form.Group>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Category *</Form.Label>
                  {!showNewCategory ? (
                    <>
                      <Form.Select
                        value={form.category}
                        onChange={(e) => updateForm('category', e.target.value)}
                      >
                        <option value="">Select category...</option>
                        {categoryOptions.map((c) => (
                          <option key={c} value={c}>
                            {c}
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
                  <Form.Label>Price ({currency}) *</Form.Label>
                  <Form.Control
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.price}
                    onChange={(e) => updateForm('price', Number(e.target.value))}
                  />
                </Form.Group>
              </Col>
            </Row>
            <Form.Group className="mb-3">
              <Form.Label>Unit Reference</Form.Label>
              <Form.Control
                value={form.unitReference}
                onChange={(e) => updateForm('unitReference', e.target.value)}
                placeholder="e.g. 4.5-11.0 x10^9/L"
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button variant="success" onClick={() => void handleSave()} disabled={!form.testName.trim() || saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </Modal.Footer>
        </Modal>
      )}

      {!readOnly && (
        <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
          <Modal.Header closeButton>
            <Modal.Title>Delete lab test</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {deleteTarget && (
              <p className="mb-0">
                Delete <strong>{deleteTarget.testName}</strong> ({deleteTarget.testId})? This cannot be undone.
              </p>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void handleDelete()} disabled={saving}>
              {saving ? 'Deleting...' : 'Delete'}
            </Button>
          </Modal.Footer>
        </Modal>
      )}

      {!readOnly && (
        <Modal show={showImportModal} onHide={() => setShowImportModal(false)} centered size="lg">
          <Modal.Header closeButton>
            <Modal.Title>Import Lab Tests from Excel</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {importMessage && (
              <Alert variant={importMessage.type} className="mb-3">
                {importMessage.text}
              </Alert>
            )}

            <p className="text-muted">
              Upload Excel to add many tests at once. Use the same <strong>Lab ID</strong> to update an existing test.
              Leave Lab ID blank to auto-generate (e.g. {nextTestCode}).
            </p>

            <div className="border rounded p-3 bg-light bg-opacity-50 mb-3">
              <p className="fw-medium mb-2">Columns</p>
              <p className="small text-muted mb-0">{LAB_TEST_CATALOG_HEADERS.join(' · ')}</p>
            </div>

            <Button variant="outline-secondary" className="mb-3" onClick={downloadLabTestCatalogTemplate}>
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
            <Button variant="primary" onClick={() => void handleImport()} disabled={!importFile || importing}>
              {importing ? 'Importing...' : 'Import data'}
            </Button>
          </Modal.Footer>
        </Modal>
      )}
    </PermissionGuard>
  )
}

export default LabTestCatalogView
