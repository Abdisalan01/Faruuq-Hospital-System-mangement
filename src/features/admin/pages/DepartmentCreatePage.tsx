import { useState } from 'react'
import { Button, Card, CardBody, Col, Form, Row } from 'react-bootstrap'
import { Link, useNavigate } from 'react-router-dom'

import PageMetaData from '@/components/PageTitle'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import { departments, generateId, persistFullSnapshotNowAsync } from '@/shared/services/hmsStore'

const DepartmentCreatePage = () => {
  const navigate = useNavigate()
  const { isSupabase } = useHmsStoreContext()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const newDept = {
      id: generateId('dept'),
      name,
      description,
      isActive,
      createdAt: new Date().toISOString().split('T')[0],
    }
    departments.push(newDept)
    try {
      if (isSupabase) await persistFullSnapshotNowAsync()
    } catch {
      return
    }
    navigate(`/hms/administration/departments/${newDept.id}`)
  }

  return (
    <PermissionGuard permissions={['department_management']}>
      <PageMetaData title="Create Department" />
      <PageHeader
        title="Create Department"
        breadcrumbs={[
          { label: 'Hospital Dashboard', href: '/hms/dashboard' },
          { label: 'Departments', href: '/hms/administration/departments' },
          { label: 'Create' },
        ]}
      />
      <Card>
        <CardBody>
          <Form onSubmit={handleSubmit}>
            <Row>
              <Col md={12}>
                <Form.Group className="mb-3">
                  <Form.Label>Department Name</Form.Label>
                  <Form.Control value={name} onChange={(e) => setName(e.target.value)} required />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group className="mb-3">
                  <Form.Label>Description</Form.Label>
                  <Form.Control as="textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} required />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Check type="switch" label="Active" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="mb-3" />
              </Col>
            </Row>
            <div className="d-flex gap-2">
              <Button type="submit" variant="success">
                Create Department
              </Button>
              <Link to="/hms/administration/departments" className="btn btn-light">
                Cancel
              </Link>
            </div>
          </Form>
        </CardBody>
      </Card>
    </PermissionGuard>
  )
}

export default DepartmentCreatePage
