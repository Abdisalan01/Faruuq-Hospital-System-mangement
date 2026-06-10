import type { ApexOptions } from 'apexcharts'
import ReactApexChart from 'react-apexcharts'
import { Card, CardBody, CardHeader, CardTitle } from 'react-bootstrap'

import { patients } from '@/shared/services/hmsStore'

const PatientTrendsChart = () => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
  const series = [
    { name: 'New Patients', data: [12, 18, 15, 22, 19, patients.length + 10] },
    { name: 'Returning', data: [8, 12, 10, 14, 11, 16] },
  ]

  const options: ApexOptions = {
    chart: { type: 'line', height: 280, toolbar: { show: false } },
    stroke: { curve: 'smooth', width: 2 },
    colors: ['#003399', '#00a9ce'],
    xaxis: { categories: months },
    legend: { position: 'top' },
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h5" className="mb-0">
          Patient Trends
        </CardTitle>
      </CardHeader>
      <CardBody>
        <ReactApexChart options={options} series={series} type="line" height={280} />
      </CardBody>
    </Card>
  )
}

export default PatientTrendsChart
