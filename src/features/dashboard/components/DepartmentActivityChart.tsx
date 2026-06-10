import type { ApexOptions } from 'apexcharts'
import ReactApexChart from 'react-apexcharts'
import { Card, CardBody, CardHeader, CardTitle } from 'react-bootstrap'

const DepartmentActivityChart = () => {
  const series = [35, 25, 15, 12, 8, 5]
  const labels = ['General Medicine', 'Pediatrics', 'Emergency', 'Laboratory', 'Pharmacy', 'Inpatient']

  const options: ApexOptions = {
    chart: { type: 'donut', height: 280 },
    labels,
    colors: ['#003399', '#e30613', '#00a9ce', '#002266', '#003399', '#00a9ce'],
    legend: { position: 'bottom' },
    plotOptions: { pie: { donut: { size: '65%' } } },
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h5" className="mb-0">
          Department Activity
        </CardTitle>
      </CardHeader>
      <CardBody>
        <ReactApexChart options={options} series={series} type="donut" height={280} />
      </CardBody>
    </Card>
  )
}

export default DepartmentActivityChart
