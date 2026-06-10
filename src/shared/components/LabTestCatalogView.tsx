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
  labTestCatalog,
  persistLabCatalogNowAsync,
  peekNextLabTestCode,
  saveLabTestCatalogEntry,
  systemSettings,
} from '@/shared/services/hmsStore'
import type { LabSampleType, LabTestCatalog, LabTestCategory } from '@/shared/types'
import type { Permission } from '@/shared/types/roles'
import {
  downloadLabTestCatalogTemplate,
  importLabTestCatalogFromExcel,
  LAB_TEST_CATALOG_HEADERS,
} from '@/shared/utils/labTestCatalogExcel'

const PAGE_SIZE = 10

const CATEGORIES: LabTestCategory[] = ['Laboratory', 'Radiology', 'Imaging']
const SAMPLE_TYPES: LabSampleType[] = ['Blood', 'Urine', 'Stool', 'Other', 'N/A']

type CategoryFilter = 'all' | LabTestCategory
type SampleFilter = 'all' | LabSampleType

export type LabTestCatalogViewProps = {
  breadcrumbs: { label: string; href?: string }[]
  permissions: Permission[]
  readOnly?: boolean
  title?: string
  subtitle?: string
}

const emptyForm = () => ({
  testId: '',
  testName: '',
  category: 'Laboratory' as LabTestCategory,
  price: 0,
  isActive: true,
  description: '',
  normalRange: '',
  unit: '',
  sampleType: 'Blood' as LabSampleType,
})

const LabTestCatalogView = ({
  breadcrumbs,
  permissions,
  readOnly = false,
  title = 'Lab Tests Catalog',
  subtitle = 'Manage test ID, category, pricing, and clinical details',
}: LabTestCatalogViewProps) => {
  const { dataVersion, isSupabase } = useHmsStoreContext()
  const [, setRefresh] = useState(0)
  const refresh = () => setRefresh((t) => t + 1)

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [sampleFilter, setSampleFilter] = useState<SampleFilter>('all')
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [pageMessage, setPageMessage] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'danger' | 'warning'; text: string } | null>(
    null,
  )

  const [form, setForm] = useState(emptyForm())

  const nextTestCode = useMemo(
    () => peekNextLabTestCode(),
    [labTestCatalog.length, systemSettings.labTestCodeNextNumber],
  )

  const items = useMemo(() => {
    const q = search.toLowerCase().trim()
    return labTestCatalog
      .filter((t) => categoryFilter === 'all' || t.category === categoryFilter)
      .filter((t) => sampleFilter === 'all' || t.sampleType === sampleFilter)
      .filter((t) => {
        if (!q) return true
        return `${t.testId} ${t.testName} ${t.category} ${t.sampleType ?? ''} ${t.description ?? ''}`
          .toLowerCase()
          .includes(q)
      })
      .sort((a, b) => a.category.localeCompare(b.category) || a.testName.localeCompare(b.testName))
  }, [search, categoryFilter, sampleFilter, labTestCatalog.length, dataVersion])

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return items.slice(start, start + PAGE_SIZE)
  }, [items, safePage])

  useEffect(() => {
    setPage(1)
  }, [search, categoryFilter, sampleFilter])

  const openCreate = () => {
    setEditId(null)
    setForm({ ...emptyForm(), testId: peekNextLabTestCode() })
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
      isActive: item.isActive,
      description: item.description ?? '',
      normalRange: item.normalRange ?? '',
      unit: item.unit ?? '',
      sampleType: item.sampleType ?? (item.category === 'Laboratory' ? 'Blood' : 'N/A'),
    })
    setFormError('')
    setShowModal(true)
  }

  const persistCatalog = async (successMessage: string) => {
    if (!isSupabase) {
      setPageMessage(`${successMessage} (database mode is off — enable VITE_USE_SUPABASE in .env)`)
      refresh()
      return
    }

    setSaving(true)
    try {
      await persistLabCatalogNowAsync()
      setPageMessage(`${successMessage} Saved to database.`)
      refresh()
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Unknown error'
      setPageMessage(`Database save failed: ${detail}`)
      refresh()
    } finally {
      setSaving(false)
    }
  }

  const openImport = () => {
    setImportFile(null)
    setImportMessage(null)
    setShowImportModal(true)
  }

  const handleSave = async () => {
    if (!form.testName.trim()) {
      setFormError('Test name is required')
      return
    }
    if (form.price < 0 || Number.isNaN(form.price)) {
      setFormError('Price is required')
      return
    }

    try {
      saveLabTestCatalogEntry({
        id: editId ?? undefined,
        ...form,
        sampleType: form.category === 'Laboratory' ? form.sampleType : 'N/A',
      })
      setShowModal(false)
      await persistCatalog(editId ? 'Test updated.' : 'Test added.')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save test')
    }
  }

  const toggleActive = async (item: LabTestCatalog) => {
    saveLabTestCatalogEntry({ ...item, isActive: !item.isActive })
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

  const updateForm = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'category' && value !== 'Laboratory') {
        next.sampleType = 'N/A'
      }
      if (key === 'category' && value === 'Laboratory' && prev.sampleType === 'N/A') {
        next.sampleType = 'Blood'
      }
      return next
    })
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

      <Card>
        <CardBody>
          <Row className="g-3 mb-3">
            <Col md={5}>
              <InputGroup>
                <InputGroup.Text>
                  <IconifyIcon icon="solar:magnifer-broken" />
                </InputGroup.Text>
                <Form.Control
                  placeholder="Search by ID, name, category..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </InputGroup>
            </Col>
            <Col md={3}>
              <Form.Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}>
                <option value="all">All categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col md={3}>
              <Form.Select
                value={sampleFilter}
                onChange={(e) => setSampleFilter(e.target.value as SampleFilter)}
                disabled={categoryFilter !== 'all' && categoryFilter !== 'Laboratory'}
              >
                <option value="all">All sample types</option>
                {SAMPLE_TYPES.map((s) => (
                  <option key={s} value={s}>
                    {s}
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
                  <th>Test ID</th>
                  <th>Test Name</th>
                  <th>Category</th>
                  <th>Sample</th>
                  <th>Price</th>
                  <th>Normal Range</th>
                  <th>Status</th>
                  {!readOnly && <th />}
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={readOnly ? 7 : 8} className="text-center text-muted py-4">
                      No tests found
                    </td>
                  </tr>
                ) : (
                  pageItems.map((t) => (
                    <tr key={t.id} className={!t.isActive ? 'text-muted' : undefined}>
                      <td className="fw-medium">{t.testId}</td>
                      <td>
                        <div>{t.testName}</div>
                        {t.description && <div className="small text-muted">{t.description}</div>}
                      </td>
                      <td>
                        <Badge bg="light" text="dark">
                          {t.category}
                        </Badge>
                      </td>
                      <td>{t.sampleType ?? '—'}</td>
                      <td>
                        {currency}
                        {t.price.toLocaleString()}
                      </td>
                      <td className="small">{t.normalRange ?? '—'}</td>
                      <td>
                        <StatusBadge status={t.isActive ? 'Active' : 'Inactive'} />
                      </td>
                      {!readOnly && (
                        <td className="text-end">
                          <Button size="sm" variant="light" className="me-1" onClick={() => openEdit(t)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="outline-secondary" onClick={() => toggleActive(t)}>
                            {t.isActive ? 'Deactivate' : 'Activate'}
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
                  <Form.Label>Test ID *</Form.Label>
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
                  <Form.Label>Status *</Form.Label>
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
                  <Form.Label>Category / Type *</Form.Label>
                  <Form.Select
                    value={form.category}
                    onChange={(e) => updateForm('category', e.target.value as LabTestCategory)}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Form.Select>
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
            {form.category === 'Laboratory' && (
              <Form.Group className="mb-3">
                <Form.Label>Sample Type</Form.Label>
                <Form.Select
                  value={form.sampleType}
                  onChange={(e) => updateForm('sampleType', e.target.value as LabSampleType)}
                >
                  {(['Blood', 'Urine', 'Stool', 'Other'] as LabSampleType[]).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            )}
            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={form.description}
                onChange={(e) => updateForm('description', e.target.value)}
              />
            </Form.Group>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Normal Range</Form.Label>
                  <Form.Control value={form.normalRange} onChange={(e) => updateForm('normalRange', e.target.value)} />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Unit</Form.Label>
                  <Form.Control value={form.unit} onChange={(e) => updateForm('unit', e.target.value)} />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button
              variant="success"
              onClick={handleSave}
              disabled={!form.testName.trim() || saving}
            >
              {saving ? 'Saving...' : 'Save'}
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
              Upload Excel to add many tests at once. Use the same <strong>Test ID</strong> to update an existing test.
              Leave Test ID blank to auto-generate (e.g. {nextTestCode}).
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
            <Button variant="primary" onClick={handleImport} disabled={!importFile || importing}>
              {importing ? 'Importing...' : 'Import data'}
            </Button>
          </Modal.Footer>
        </Modal>
      )}
    </PermissionGuard>
  )
}

export default LabTestCatalogView
