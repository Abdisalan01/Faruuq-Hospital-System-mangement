import { useState } from 'react'
import { Button, Card, CardBody, Col, Form, Row } from 'react-bootstrap'
import { Link, useNavigate, useParams } from 'react-router-dom'

import PageMetaData from '@/components/PageTitle'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import { getDepartmentById } from '@/shared/services/hmsStore'

const DepartmentEditPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const dept = id ? getDepartmentById(id) : undefined

  const [name, setName] = useState(dept?.name ?? '')
  const [description, setDescription] = useState(dept?.description ?? '')
  const [isActive, setIsActive] = useState(dept?.isActive ?? true)

  if (!dept) {
    return (
      <PermissionGuard permissions={['department_management']}>
        <PageMetaData title="Department Not Found" />
        <div className="alert alert-warning">Department not found.</div>
        <Link to="/hms/administration/departments">Back to Departments</Link>
      </PermissionGuard>
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    dept.name = name
    dept.description = description
    dept.isActive = isActive
    navigate(`/hms/administration/departments/${dept.id}`)
  }

  return (
    <PermissionGuard permissions={['department_management']}>
      <PageMetaData title={`Edit Department: ${dept.name}`} />
      <PageHeader
        title="Edit Department"
        breadcrumbs={[
          { label: 'Hospital Dashboard', href: '/hms/dashboard' },
          { label: 'Departments', href: '/hms/administration/departments' },
          { label: dept.name, href: `/hms/administration/departments/${dept.id}` },
          { label: 'Edit' },
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
                Save Changes
              </Button>
              <Link to={`/hms/administration/departments/${dept.id}`} className="btn btn-light">
                Cancel
              </Link>
            </div>
          </Form>
        </CardBody>
      </Card>
    </PermissionGuard>
  )
}

export default DepartmentEditPage
