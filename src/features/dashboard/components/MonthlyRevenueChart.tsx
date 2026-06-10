import type { ApexOptions } from 'apexcharts'
import ReactApexChart from 'react-apexcharts'
import { Card, CardBody, CardHeader, CardTitle } from 'react-bootstrap'

import { currency } from '@/context/constants'

const MonthlyRevenueChart = () => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
  const series = [{ name: 'Revenue', data: [4200, 5100, 4800, 6200, 5800, 6500] }]

  const options: ApexOptions = {
    chart: { type: 'bar', height: 280, toolbar: { show: false } },
    plotOptions: { bar: { borderRadius: 4, columnWidth: '50%' } },
    colors: ['#003399'],
    xaxis: { categories: months },
    yaxis: { labels: { formatter: (v) => `${currency}${(v / 1000).toFixed(1)}k` } },
    tooltip: { y: { formatter: (v) => `${currency}${v}` } },
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h5" className="mb-0">
          Monthly Revenue
        </CardTitle>
      </CardHeader>
      <CardBody>
        <ReactApexChart options={options} series={series} type="bar" height={280} />
      </CardBody>
    </Card>
  )
}

export default MonthlyRevenueChart
