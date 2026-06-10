import { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, CardBody, Col, Form, Modal, Row, Table } from 'react-bootstrap'

import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { currency } from '@/context/constants'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import {
  beds,
  deleteBedEntry,
  deleteRoomEntry,
  deleteWardEntry,
  getBedsForRoom,
  persistRoomsBedsNowAsync,
  rooms,
  saveBedEntry,
  saveRoomEntry,
  saveWardEntry,
  wards,
} from '@/shared/services/hmsStore'
import type { Bed, Room, Ward } from '@/shared/types'

const RoomBedManagementPage = () => {
  const { dataVersion, isSupabase } = useHmsStoreContext()
  const [, setRefresh] = useState(0)
  const refresh = () => setRefresh((t) => t + 1)

  const [selectedRoomId, setSelectedRoomId] = useState(rooms[0]?.id ?? '')
  const [pageMessage, setPageMessage] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const [showWardModal, setShowWardModal] = useState(false)
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [showBedModal, setShowBedModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const [editWardId, setEditWardId] = useState<string | null>(null)
  const [editRoomId, setEditRoomId] = useState<string | null>(null)
  const [editBedId, setEditBedId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'ward' | 'room' | 'bed'; item: Ward | Room | Bed } | null>(
    null,
  )

  const [wardName, setWardName] = useState('')
  const [wardDescription, setWardDescription] = useState('')
  const [roomName, setRoomName] = useState('')
  const [wardId, setWardId] = useState(wards[0]?.id ?? '')
  const [bedName, setBedName] = useState('')
  const [bedNumber, setBedNumber] = useState('')
  const [dailyRate, setDailyRate] = useState(25)
  const [bedRoomId, setBedRoomId] = useState(selectedRoomId)

  const wardRows = useMemo(() => [...wards], [dataVersion, wards.length])
  const roomRows = useMemo(() => [...rooms], [dataVersion, rooms.length])
  const roomBeds = useMemo(
    () => getBedsForRoom(selectedRoomId),
    [selectedRoomId, dataVersion, beds.length],
  )

  const deleteSummary = useMemo(() => {
    if (!deleteTarget) return ''
    if (deleteTarget.type === 'ward') {
      const wardRooms = rooms.filter((r) => r.wardId === deleteTarget.item.id)
      const bedCount = beds.filter((b) => wardRooms.some((r) => r.id === b.roomId)).length
      return wardRooms.length > 0
        ? ` This will also delete ${wardRooms.length} room(s) and ${bedCount} bed(s).`
        : ''
    }
    if (deleteTarget.type === 'room') {
      const bedCount = getBedsForRoom(deleteTarget.item.id).length
      return bedCount > 0 ? ` This will also delete ${bedCount} bed(s).` : ''
    }
    return ''
  }, [deleteTarget, rooms.length, beds.length])

  useEffect(() => {
    if (!selectedRoomId && rooms.length > 0) {
      setSelectedRoomId(rooms[0].id)
    }
  }, [rooms.length, selectedRoomId, dataVersion])

  const persistFacility = async (successMessage: string) => {
    if (!isSupabase) {
      setPageMessage(`${successMessage} (database mode is off — enable VITE_USE_SUPABASE in .env)`)
      refresh()
      return
    }

    setSaving(true)
    try {
      await persistRoomsBedsNowAsync()
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

  const openCreateWard = () => {
    setEditWardId(null)
    setWardName('')
    setWardDescription('')
    setFormError('')
    setShowWardModal(true)
  }

  const openEditWard = (ward: Ward) => {
    setEditWardId(ward.id)
    setWardName(ward.name)
    setWardDescription(ward.description)
    setFormError('')
    setShowWardModal(true)
  }

  const openCreateRoom = () => {
    setEditRoomId(null)
    setWardId(wards[0]?.id ?? '')
    setRoomName('')
    setFormError('')
    setShowRoomModal(true)
  }

  const openEditRoom = (room: Room) => {
    setEditRoomId(room.id)
    setWardId(room.wardId)
    setRoomName(room.name)
    setFormError('')
    setShowRoomModal(true)
  }

  const openCreateBed = () => {
    setEditBedId(null)
    setBedRoomId(selectedRoomId)
    setBedName('')
    setBedNumber('')
    setDailyRate(25)
    setFormError('')
    setShowBedModal(true)
  }

  const openEditBed = (bed: Bed) => {
    setEditBedId(bed.id)
    setBedRoomId(bed.roomId)
    setBedName(bed.name)
    setBedNumber(bed.bedNumber)
    setDailyRate(bed.dailyRate)
    setFormError('')
    setShowBedModal(true)
  }

  const openDelete = (type: 'ward' | 'room' | 'bed', item: Ward | Room | Bed) => {
    setDeleteTarget({ type, item })
    setShowDeleteModal(true)
  }

  const handleSaveWard = async () => {
    try {
      saveWardEntry({
        id: editWardId ?? undefined,
        name: wardName,
        description: wardDescription,
      })
      setShowWardModal(false)
      await persistFacility(editWardId ? 'Ward updated.' : 'Ward created.')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save ward')
    }
  }

  const handleSaveRoom = async () => {
    try {
      const saved = saveRoomEntry({
        id: editRoomId ?? undefined,
        wardId,
        name: roomName,
      })
      setShowRoomModal(false)
      if (!editRoomId) setSelectedRoomId(saved.id)
      await persistFacility(editRoomId ? 'Room updated.' : 'Room created.')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save room')
    }
  }

  const handleSaveBed = async () => {
    try {
      saveBedEntry({
        id: editBedId ?? undefined,
        roomId: bedRoomId,
        bedNumber,
        name: bedName,
        dailyRate,
      })
      setShowBedModal(false)
      await persistFacility(editBedId ? 'Bed updated.' : 'Bed added.')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save bed')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    try {
      if (deleteTarget.type === 'ward') {
        deleteWardEntry(deleteTarget.item.id)
        if (selectedRoomId && rooms.find((r) => r.id === selectedRoomId)?.wardId === deleteTarget.item.id) {
          setSelectedRoomId(rooms.find((r) => r.wardId !== deleteTarget.item.id)?.id ?? '')
        }
      } else if (deleteTarget.type === 'room') {
        deleteRoomEntry(deleteTarget.item.id)
        if (selectedRoomId === deleteTarget.item.id) {
          setSelectedRoomId(rooms.find((r) => r.id !== deleteTarget.item.id)?.id ?? '')
        }
      } else {
        deleteBedEntry(deleteTarget.item.id)
      }

      setShowDeleteModal(false)
      setDeleteTarget(null)
      const label =
        deleteTarget.type === 'ward'
          ? (deleteTarget.item as Ward).name
          : deleteTarget.type === 'room'
            ? (deleteTarget.item as Room).name
            : (deleteTarget.item as Bed).name
      await persistFacility(`${label} deleted.`)
    } catch (err) {
      setPageMessage(err instanceof Error ? err.message : 'Could not delete')
      refresh()
    }
  }

  return (
    <PermissionGuard permissions={['system_settings', 'user_management']}>
      <PageMetaData title="Rooms & Beds" />
      <PageHeader
        title="Rooms & Beds"
        subtitle="Manage wards, rooms, and beds with full create, edit, and delete"
        breadcrumbs={[
          { label: 'Hospital Dashboard', href: '/hms/dashboard' },
          { label: 'Rooms & Beds' },
        ]}
      />

      {pageMessage && (
        <Alert variant="success" dismissible onClose={() => setPageMessage('')} className="py-2">
          {pageMessage}
        </Alert>
      )}

      <Row>
        <Col lg={4} className="mb-3">
          <Card className="mb-3">
            <CardBody>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="mb-0">Wards</h5>
                <Button size="sm" variant="outline-success" onClick={openCreateWard}>
                  <IconifyIcon icon="solar:add-circle-broken" className="me-1" />
                  New Ward
                </Button>
              </div>
              <div className="table-responsive">
                <Table hover size="sm" className="mb-0 align-middle">
                  <thead className="bg-light bg-opacity-50">
                    <tr>
                      <th>Ward</th>
                      <th>Rooms</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wardRows.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-muted small py-3">
                          No wards yet. Create a ward first.
                        </td>
                      </tr>
                    ) : (
                      wardRows.map((ward) => {
                        const roomCount = rooms.filter((r) => r.wardId === ward.id).length
                        return (
                          <tr key={ward.id}>
                            <td>
                              <div className="fw-medium">{ward.name}</div>
                              {ward.description && <div className="small text-muted">{ward.description}</div>}
                            </td>
                            <td>{roomCount}</td>
                            <td className="text-end text-nowrap">
                              <Button size="sm" variant="light" className="me-1" onClick={() => openEditWard(ward)}>
                                Edit
                              </Button>
                              <Button size="sm" variant="outline-danger" onClick={() => openDelete('ward', ward)}>
                                Delete
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

          <Card>
            <CardBody>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="mb-0">Rooms</h5>
                <Button size="sm" variant="success" onClick={openCreateRoom} disabled={wards.length === 0}>
                  <IconifyIcon icon="solar:add-circle-broken" className="me-1" />
                  New Room
                </Button>
              </div>
              <div className="table-responsive">
                <Table hover size="sm" className="mb-0 align-middle">
                  <thead className="bg-light bg-opacity-50">
                    <tr>
                      <th>Room</th>
                      <th>Ward</th>
                      <th>Beds</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roomRows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-muted small py-3">
                          No rooms yet.
                        </td>
                      </tr>
                    ) : (
                      roomRows.map((room) => {
                        const ward = wards.find((w) => w.id === room.wardId)
                        const count = getBedsForRoom(room.id).length
                        const isSelected = selectedRoomId === room.id
                        return (
                          <tr
                            key={room.id}
                            className={isSelected ? 'table-primary' : undefined}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setSelectedRoomId(room.id)}
                          >
                            <td className="fw-medium">{room.name}</td>
                            <td>{ward?.name ?? '—'}</td>
                            <td>{count}</td>
                            <td className="text-end text-nowrap" onClick={(e) => e.stopPropagation()}>
                              <Button size="sm" variant="light" className="me-1" onClick={() => openEditRoom(room)}>
                                Edit
                              </Button>
                              <Button size="sm" variant="outline-danger" onClick={() => openDelete('room', room)}>
                                Delete
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
        </Col>

        <Col lg={8} className="mb-3">
          <Card>
            <CardBody>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="mb-0">Beds — {rooms.find((r) => r.id === selectedRoomId)?.name ?? 'Select a room'}</h5>
                {selectedRoomId && (
                  <Button size="sm" variant="primary" onClick={openCreateBed}>
                    Add Bed
                  </Button>
                )}
              </div>
              {!selectedRoomId ? (
                <p className="text-muted">Select a room to manage beds.</p>
              ) : (
                <div className="table-responsive">
                  <Table hover size="sm" className="mb-0 align-middle">
                    <thead className="bg-light bg-opacity-50">
                      <tr>
                        <th>Bed #</th>
                        <th>Name</th>
                        <th>Daily Rate</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {roomBeds.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center text-muted py-3">
                            No beds in this room. Add a bed.
                          </td>
                        </tr>
                      ) : (
                        roomBeds.map((bed) => (
                          <tr key={bed.id}>
                            <td>{bed.bedNumber}</td>
                            <td>{bed.name}</td>
                            <td>
                              {currency}
                              {bed.dailyRate.toLocaleString()}
                            </td>
                            <td>
                              <Badge bg={bed.isOccupied ? 'warning' : 'success'}>
                                {bed.isOccupied ? 'Occupied' : 'Available'}
                              </Badge>
                            </td>
                            <td className="text-end">
                              <Button size="sm" variant="light" className="me-1" onClick={() => openEditBed(bed)}>
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline-danger"
                                onClick={() => openDelete('bed', bed)}
                                disabled={bed.isOccupied}
                              >
                                Delete
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </Table>
                </div>
              )}
            </CardBody>
          </Card>
        </Col>
      </Row>

      <Modal
        show={showWardModal}
        onHide={() => {
          setShowWardModal(false)
          setFormError('')
        }}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>{editWardId ? 'Edit Ward' : 'New Ward'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {formError && <Alert variant="danger">{formError}</Alert>}
          <Form.Group className="mb-3">
            <Form.Label>Ward Name *</Form.Label>
            <Form.Control value={wardName} onChange={(e) => setWardName(e.target.value)} placeholder="e.g. ICU Ward" />
          </Form.Group>
          <Form.Group className="mb-0">
            <Form.Label>Description</Form.Label>
            <Form.Control
              value={wardDescription}
              onChange={(e) => setWardDescription(e.target.value)}
              placeholder="e.g. Intensive care unit"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setShowWardModal(false)}>
            Cancel
          </Button>
          <Button variant="success" onClick={handleSaveWard} disabled={!wardName.trim() || saving}>
            {saving ? 'Saving...' : editWardId ? 'Update' : 'Create'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={showRoomModal}
        onHide={() => {
          setShowRoomModal(false)
          setFormError('')
        }}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>{editRoomId ? 'Edit Room' : 'New Room'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {formError && <Alert variant="danger">{formError}</Alert>}
          <Form.Group className="mb-3">
            <Form.Label>Room Name *</Form.Label>
            <Form.Control value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="e.g. Room 103" />
          </Form.Group>
          <Form.Group className="mb-0">
            <Form.Label>Ward *</Form.Label>
            <Form.Select value={wardId} onChange={(e) => setWardId(e.target.value)}>
              {wards.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setShowRoomModal(false)}>
            Cancel
          </Button>
          <Button variant="success" onClick={handleSaveRoom} disabled={!roomName.trim() || !wardId || saving}>
            {saving ? 'Saving...' : editRoomId ? 'Update' : 'Create'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={showBedModal}
        onHide={() => {
          setShowBedModal(false)
          setFormError('')
        }}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>{editBedId ? 'Edit Bed' : 'Add Bed'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {formError && <Alert variant="danger">{formError}</Alert>}
          <Form.Group className="mb-3">
            <Form.Label>Room *</Form.Label>
            <Form.Select value={bedRoomId} onChange={(e) => setBedRoomId(e.target.value)}>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Bed Number *</Form.Label>
            <Form.Control value={bedNumber} onChange={(e) => setBedNumber(e.target.value)} placeholder="e.g. 103-A" />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Bed Name *</Form.Label>
            <Form.Control value={bedName} onChange={(e) => setBedName(e.target.value)} placeholder="e.g. Bed A" />
          </Form.Group>
          <Form.Group className="mb-0">
            <Form.Label>Daily Rate ({currency}) *</Form.Label>
            <Form.Control type="number" min={0} value={dailyRate} onChange={(e) => setDailyRate(Number(e.target.value))} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setShowBedModal(false)}>
            Cancel
          </Button>
          <Button
            variant="success"
            onClick={handleSaveBed}
            disabled={!bedNumber.trim() || !bedName.trim() || !bedRoomId || saving}
          >
            {saving ? 'Saving...' : editBedId ? 'Update' : 'Add'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Confirm delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {deleteTarget && (
            <p className="mb-0">
              Delete <strong>{deleteTarget.item.name}</strong>? This cannot be undone.
              {deleteSummary}
              {deleteTarget.type === 'bed' && (deleteTarget.item as Bed).isOccupied && (
                <span className="d-block mt-2 text-danger">This bed is occupied and cannot be deleted.</span>
              )}
            </p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            disabled={saving || (deleteTarget?.type === 'bed' && (deleteTarget.item as Bed).isOccupied)}
          >
            {saving ? 'Deleting...' : 'Delete'}
          </Button>
        </Modal.Footer>
      </Modal>
    </PermissionGuard>
  )
}

export default RoomBedManagementPage
