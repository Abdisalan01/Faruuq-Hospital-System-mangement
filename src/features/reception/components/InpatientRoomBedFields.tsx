import { useMemo } from 'react'
import { Alert, Col, Form, Row } from 'react-bootstrap'

import { currency } from '@/context/constants'
import InpatientBillingModeSelector from '@/features/reception/components/InpatientBillingModeSelector'
import {
  beds,
  getAvailableBedCountInRoom,
  getAvailableBedsInRoom,
  getRoomById,
  getSelectableBedsInRoom,
  rooms,
} from '@/shared/services/hmsStore'
import type { InpatientBillingMode } from '@/shared/types'

type InpatientRoomBedFieldsProps = {
  roomId: string
  bedId: string
  billingMode: InpatientBillingMode
  onRoomChange: (roomId: string) => void
  onBedChange: (bedId: string) => void
  onBillingModeChange: (mode: InpatientBillingMode) => void
  isEditMode?: boolean
  excludeAdmissionId?: string
  currentBedId?: string
}

const InpatientRoomBedFields = ({
  roomId,
  bedId,
  billingMode,
  onRoomChange,
  onBedChange,
  onBillingModeChange,
  isEditMode = false,
  excludeAdmissionId,
  currentBedId,
}: InpatientRoomBedFieldsProps) => {
  const bedsSelectable = useMemo(() => {
    if (!roomId) return []
    if (isEditMode) {
      return getSelectableBedsInRoom(roomId, currentBedId, excludeAdmissionId)
    }
    return getAvailableBedsInRoom(roomId)
  }, [roomId, isEditMode, currentBedId, excludeAdmissionId, beds.length])

  const roomsForAssign = useMemo(() => {
    if (isEditMode) return rooms
    return rooms.filter((r) => getAvailableBedCountInRoom(r.id) > 0)
  }, [isEditMode, beds.length])

  const selectedBed = bedId ? beds.find((b) => b.id === bedId) : undefined
  const bedValue =
    bedId && (bedsSelectable.some((b) => b.id === bedId) || (isEditMode && bedId === currentBedId))
      ? bedId
      : bedId && isEditMode
        ? bedId
        : ''

  return (
    <>
      <Row>
        <Col md={6}>
          <Form.Group className="mb-3">
            <Form.Label>Room</Form.Label>
            <Form.Select
              value={roomId}
              onChange={(e) => {
                onRoomChange(e.target.value)
                onBedChange('')
              }}
              required
            >
              <option value="">Select room...</option>
              {roomsForAssign.map((r) => {
                const available = getAvailableBedCountInRoom(
                  r.id,
                  isEditMode ? excludeAdmissionId : undefined,
                )
                return (
                  <option key={r.id} value={r.id}>
                    {r.name} — {available} available / {r.bedCount} beds
                  </option>
                )
              })}
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group className="mb-3">
            <Form.Label>Bed</Form.Label>
            <Form.Select
              value={bedValue}
              onChange={(e) => onBedChange(e.target.value)}
              required
              disabled={!roomId}
            >
              <option value="">Select bed...</option>
              {isEditMode &&
                bedId &&
                currentBedId === bedId &&
                !bedsSelectable.some((b) => b.id === bedId) && (
                  <option value={bedId}>
                    Bed {beds.find((b) => b.id === bedId)?.bedNumber ?? bedId} — (current)
                  </option>
                )}
              {bedsSelectable.map((b) => (
                <option key={b.id} value={b.id}>
                  Bed {b.bedNumber} — Available — {currency}
                  {b.dailyRate}/night
                  {b.id === currentBedId ? ' (current)' : ''}
                </option>
              ))}
            </Form.Select>
            {roomId && bedsSelectable.length === 0 && (
              <Form.Text className="text-danger">
                No vacant beds in this room — choose another room.
              </Form.Text>
            )}
            {!isEditMode && roomsForAssign.length === 0 && (
              <Form.Text className="text-danger d-block mt-2">
                All beds are occupied. Free a bed or add beds in Administration.
              </Form.Text>
            )}
          </Form.Group>
        </Col>
      </Row>

      {selectedBed && (
        <Alert variant="secondary" className="py-2 small">
          <strong>Bed price:</strong> {currency}
          {selectedBed.dailyRate} per night ({getRoomById(roomId)?.name})
        </Alert>
      )}

      <InpatientBillingModeSelector
        value={billingMode}
        onChange={onBillingModeChange}
        nightlyRate={selectedBed?.dailyRate}
        namePrefix="room-bed"
      />
    </>
  )
}

export default InpatientRoomBedFields
