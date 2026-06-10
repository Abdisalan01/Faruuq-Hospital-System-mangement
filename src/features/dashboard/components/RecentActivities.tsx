import { Card, CardBody, CardHeader, CardTitle, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'

import IconifyIcon from '@/components/wrappers/IconifyIcon'
import StatusBadge from '@/shared/components/StatusBadge'
import { admissions, labRequests, patients, prescriptions } from '@/shared/services/hmsStore'

type ActivityItem = {
  id: string
  type: string
  description: string
  time: string
  icon: string
  link: string
  status?: string
}

const RecentActivities = () => {
  const activities: ActivityItem[] = [
    ...patients.slice(-2).map((p) => ({
      id: p.id,
      type: 'Registration',
      description: `New patient registered: ${p.fullName}`,
      time: p.createdAt,
      icon: 'solar:user-plus-broken',
      link: `/hms/patients/${p.id}`,
    })),
    ...labRequests
      .filter((l) => l.status === 'Completed')
      .slice(0, 2)
      .map((l) => ({
        id: l.id,
        type: 'Lab Result',
        description: `Lab results completed: ${l.requestNumber}`,
        time: l.completedAt ?? l.createdAt,
        icon: 'solar:test-tube-broken',
        link: `/hms/laboratory/requests/${l.id}`,
      })),
    ...prescriptions.slice(0, 2).map((rx) => ({
      id: rx.id,
      type: 'Prescription',
      description: `Prescription issued for patient`,
      time: rx.createdAt,
      icon: 'solar:pill-broken',
      link: '/hms/pharmacy/prescriptions',
      status: rx.status,
    })),
    ...admissions.slice(0, 1).map((a) => ({
      id: a.id,
      type: 'Admission',
      description: `Patient admitted to ward`,
      time: a.admittedAt,
      icon: 'solar:bed-broken',
      link: '/hms/administration/operational-reports',
    })),
  ].slice(0, 8)

  return (
    <Card>
      <CardHeader className="d-flex justify-content-between align-items-center">
        <CardTitle as="h5" className="mb-0">
          Recent Activities
        </CardTitle>
      </CardHeader>
      <CardBody className="p-0">
        <div className="table-responsive">
          <Table className="table-hover mb-0">
            <thead className="bg-light bg-opacity-50">
              <tr>
                <th className="border-0 py-2">Activity</th>
                <th className="border-0 py-2">Description</th>
                <th className="border-0 py-2">Time</th>
                <th className="border-0 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((activity) => (
                <tr key={`${activity.type}-${activity.id}`}>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <IconifyIcon icon={activity.icon} className="text-primary fs-18" />
                      <span className="fw-medium">{activity.type}</span>
                    </div>
                  </td>
                  <td>
                    <Link to={activity.link} className="text-reset">
                      {activity.description}
                    </Link>
                  </td>
                  <td className="text-muted">{new Date(activity.time).toLocaleString()}</td>
                  <td>{activity.status ? <StatusBadge status={activity.status} /> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </CardBody>
    </Card>
  )
}

export default RecentActivities
