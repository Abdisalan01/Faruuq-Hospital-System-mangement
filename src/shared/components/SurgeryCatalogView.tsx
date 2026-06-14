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
  deleteSurgeryCatalogEntry,
  persistSurgeryCatalogNowAsync,
  peekNextSurgeryCode,
  saveSurgeryCatalogEntry,
  surgeryCatalog,
  systemSettings,
} from '@/shared/services/hmsStore'
import type { AnesthesiaType, SurgeryCatalog, SurgeryCategory, SurgeryRiskLevel } from '@/shared/types'
import type { Permission } from '@/shared/types/roles'
import {
  downloadSurgeryCatalogTemplate,
  importSurgeryCatalogFromExcel,
  SURGERY_CATALOG_HEADERS,
} from '@/shared/utils/surgeryCatalogExcel'

const PAGE_SIZE = 10

const CATEGORIES: SurgeryCategory[] = ['General', 'Orthopedic', 'Cardiac']
const ANESTHESIA_TYPES: AnesthesiaType[] = ['Local', 'General']
const RISK_LEVELS: SurgeryRiskLevel[] = ['Low', 'Medium', 'High']

type CategoryFilter = 'all' | SurgeryCategory

export type SurgeryCatalogViewProps = {
  breadcrumbs: { label: string; href?: string }[]
  permissions: Permission[]
  readOnly?: boolean
  title?: string
  subtitle?: string
}

const emptyForm = () => ({
  surgeryId: '',
  name: '',
  category: 'General' as SurgeryCategory,
  price: 0,
  isActive: true,
  duration: '',
  anesthesiaType: 'General' as AnesthesiaType,
  riskLevel: 'Medium' as SurgeryRiskLevel,
  description: '',
  requiredEquipment: '',
  preOpInstructions: '',
  postOpCare: '',
})

const riskBadgeBg = (risk?: SurgeryRiskLevel) => {
  if (risk === 'High') return 'danger'
  if (risk === 'Medium') return 'warning'
  if (risk === 'Low') return 'success'
  return 'secondary'
}

export default function SurgeryCatalogView({
  breadcrumbs,
  permissions,
  readOnly = false,
  title = 'Surgery Catalog',
  subtitle = 'Manage surgery ID, category, pricing, and clinical details',
}: SurgeryCatalogViewProps) {
  const { dataVersion, isSupabase } = useHmsStoreContext()
  const [, setRefresh] = useState(0)
  const refresh = () => setRefresh((t) => t + 1)

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SurgeryCatalog | null>(null)
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

  const nextSurgeryCode = useMemo(
    () => peekNextSurgeryCode(),
    [surgeryCatalog.length, systemSettings.surgeryCodeNextNumber],
  )

  const items = useMemo(() => {
    const q = search.toLowerCase().trim()
    return surgeryCatalog
      .filter((s) => categoryFilter === 'all' || s.category === categoryFilter)
      .filter((s) => {
        if (!q) return true
        return `${s.surgeryId} ${s.name} ${s.category} ${s.description ?? ''} ${s.riskLevel ?? ''}`
          .toLowerCase()
          .includes(q)
      })
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
  }, [search, categoryFilter, surgeryCatalog.length, dataVersion])

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
    setForm({ ...emptyForm(), surgeryId: peekNextSurgeryCode() })
    setFormError('')
    setShowModal(true)
  }

  const openEdit = (item: SurgeryCatalog) => {
    setEditId(item.id)
    setForm({
      surgeryId: item.surgeryId,
      name: item.name,
      category: item.category,
      price: item.price,
      isActive: item.isActive,
      duration: item.duration ?? '',
      anesthesiaType: item.anesthesiaType ?? 'General',
      riskLevel: item.riskLevel ?? 'Medium',
      description: item.description ?? '',
      requiredEquipment: item.requiredEquipment ?? '',
      preOpInstructions: item.preOpInstructions ?? '',
      postOpCare: item.postOpCare ?? '',
    })
    setFormError('')
    setShowModal(true)
  }

  const persistCatalog = async (successMessage: string) => {
    setPageError('')
    if (!isSupabase) {
      setPageMessage(`${successMessage} (database mode is off — enable VITE_USE_SUPABASE in .env)`)
      refresh()
      return
    }

    setSaving(true)
    try {
      await persistSurgeryCatalogNowAsync()
      setPageMessage(`${successMessage} Saved to database.`)
      refresh()
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Unknown error'
      setPageError(`Database save failed: ${detail}`)
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

  const openDelete = (item: SurgeryCatalog) => {
    setDeleteTarget(item)
    setShowDeleteModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormError('Surgery name is required')
      return
    }
    if (form.price < 0 || Number.isNaN(form.price)) {
      setFormError('Price must be a valid non-negative number')
      return
    }

    try {
      saveSurgeryCatalogEntry({
        id: editId ?? undefined,
        ...form,
        surgeryId: form.surgeryId,
      })
      setShowModal(false)
      await persistCatalog(editId ? 'Surgery updated.' : 'Surgery added.')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save surgery')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      deleteSurgeryCatalogEntry(deleteTarget.id)
      setShowDeleteModal(false)
      setDeleteTarget(null)
      await persistCatalog(`${deleteTarget.name} deleted.`)
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Could not delete surgery')
      refresh()
    }
  }

  const toggleActive = async (item: SurgeryCatalog) => {
    saveSurgeryCatalogEntry({ ...item, isActive: !item.isActive })
    await persistCatalog(item.isActive ? 'Surgery deactivated.' : 'Surgery activated.')
  }

  const handleImport = async () => {
    if (!importFile) {
      setImportMessage({ type: 'danger', text: 'Please choose an Excel file first.' })
      return
    }

    setImporting(true)
    setImportMessage(null)

    try {
      const result = await importSurgeryCatalogFromExcel(importFile)
      const saved = result.imported + result.updated

      if (saved === 0) {
        setImportMessage({
          type: 'danger',
          text: result.errors[0] ?? 'No rows were imported.',
        })
      } else {
        if (isSupabase) await persistSurgeryCatalogNowAsync()
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

  const updateForm = <K extends keyof typeof form,>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <PermissionGuard permissions={permissions}>
      <PageMetaData title={title} />
      <PageHeader
        title={title}
        subtitle={subtitle}
        breadcrumbs={breadcrumbs}
        actionLabel={readOnly ? undefined : 'Add Surgery'}
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
            <Col md={1} className="d-flex align-items-center justify-content-end text-muted small">
              {items.length}
            </Col>
          </Row>

          <div className="table-responsive">
            <Table hover className="mb-0 align-middle">
              <thead className="bg-light bg-opacity-50">
                <tr>
                  <th>Surgery ID</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Duration</th>
                  <th>Anesthesia</th>
                  <th>Risk</th>
                  <th>Price</th>
                  <th>Status</th>
                  {!readOnly && <th />}
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={readOnly ? 8 : 9} className="text-center text-muted py-4">
                      No surgeries found
                    </td>
                  </tr>
                ) : (
                  pageItems.map((s) => (
                    <tr key={s.id} className={!s.isActive ? 'text-muted' : undefined}>
                      <td className="fw-medium">{s.surgeryId}</td>
                      <td>
                        <div>{s.name}</div>
                        {s.description && <div className="small text-muted">{s.description}</div>}
                      </td>
                      <td>
                        <Badge bg="light" text="dark">
                          {s.category}
                        </Badge>
                      </td>
                      <td className="small">{s.duration ?? '—'}</td>
                      <td className="small">{s.anesthesiaType ?? '—'}</td>
                      <td>
                        {s.riskLevel ? (
                          <Badge bg={riskBadgeBg(s.riskLevel)}>{s.riskLevel}</Badge>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {currency}
                        {s.price.toLocaleString()}
                      </td>
                      <td>
                        <StatusBadge status={s.isActive ? 'Active' : 'Inactive'} />
                      </td>
                      {!readOnly && (
                        <td className="text-end">
                          <Button size="sm" variant="light" className="me-1" onClick={() => openEdit(s)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="outline-secondary" className="me-1" onClick={() => toggleActive(s)}>
                            {s.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button size="sm" variant="outline-danger" onClick={() => openDelete(s)}>
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
            <Modal.Title>{editId ? 'Edit Surgery' : 'Add Surgery'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {formError && <Alert variant="danger">{formError}</Alert>}
            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Surgery ID *</Form.Label>
                  <Form.Control
                    value={form.surgeryId}
                    onChange={(e) => updateForm('surgeryId', e.target.value)}
                    placeholder={nextSurgeryCode}
                    disabled={Boolean(editId)}
                  />
                  {!editId && <Form.Text muted>Leave blank to auto-generate ({nextSurgeryCode})</Form.Text>}
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Category *</Form.Label>
                  <Form.Select
                    value={form.category}
                    onChange={(e) => updateForm('category', e.target.value as SurgeryCategory)}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
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
              <Form.Label>Surgery Name *</Form.Label>
              <Form.Control value={form.name} onChange={(e) => updateForm('name', e.target.value)} required />
            </Form.Group>
            <Row>
              <Col md={4}>
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
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Duration</Form.Label>
                  <Form.Control
                    value={form.duration}
                    onChange={(e) => updateForm('duration', e.target.value)}
                    placeholder="e.g. 2 hours"
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Anesthesia Type</Form.Label>
                  <Form.Select
                    value={form.anesthesiaType}
                    onChange={(e) => updateForm('anesthesiaType', e.target.value as AnesthesiaType)}
                  >
                    {ANESTHESIA_TYPES.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
            <Form.Group className="mb-3">
              <Form.Label>Risk Level</Form.Label>
              <Form.Select
                value={form.riskLevel}
                onChange={(e) => updateForm('riskLevel', e.target.value as SurgeryRiskLevel)}
              >
                {RISK_LEVELS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={form.description}
                onChange={(e) => updateForm('description', e.target.value)}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Required Equipment</Form.Label>
              <Form.Control
                value={form.requiredEquipment}
                onChange={(e) => updateForm('requiredEquipment', e.target.value)}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Pre-op Instructions</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={form.preOpInstructions}
                onChange={(e) => updateForm('preOpInstructions', e.target.value)}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Post-op Care</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={form.postOpCare}
                onChange={(e) => updateForm('postOpCare', e.target.value)}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button variant="success" onClick={handleSave} disabled={!form.name.trim() || saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </Modal.Footer>
        </Modal>
      )}

      {!readOnly && (
        <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
          <Modal.Header closeButton>
            <Modal.Title>Delete surgery</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {deleteTarget && (
              <p className="mb-0">
                Delete <strong>{deleteTarget.name}</strong> ({deleteTarget.surgeryId})? This cannot be undone.
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
      )}

      {!readOnly && (
        <Modal show={showImportModal} onHide={() => setShowImportModal(false)} centered size="lg">
          <Modal.Header closeButton>
            <Modal.Title>Import Surgeries from Excel</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {importMessage && (
              <Alert variant={importMessage.type} className="mb-3">
                {importMessage.text}
              </Alert>
            )}

            <p className="text-muted">
              Upload Excel to add many surgeries at once. Use the same <strong>Surgery ID</strong> to update an
              existing surgery. Leave Surgery ID blank to auto-generate (e.g. {nextSurgeryCode}).
            </p>

            <div className="border rounded p-3 bg-light bg-opacity-50 mb-3">
              <p className="fw-medium mb-2">Columns</p>
              <p className="small text-muted mb-0">{SURGERY_CATALOG_HEADERS.join(' · ')}</p>
            </div>

            <Button variant="outline-secondary" className="mb-3" onClick={downloadSurgeryCatalogTemplate}>
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
