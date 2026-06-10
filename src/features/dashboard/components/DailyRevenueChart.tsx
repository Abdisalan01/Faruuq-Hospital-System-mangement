import type { ApexOptions } from 'apexcharts'
import ReactApexChart from 'react-apexcharts'
import { Card, CardBody, CardHeader, CardTitle } from 'react-bootstrap'

import { currency } from '@/context/constants'
import { incomeRecords } from '@/shared/services/hmsStore'

const DailyRevenueChart = () => {
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toLocaleDateString('en-US', { weekday: 'short' })
  })

  const series = [
    {
      name: 'Revenue',
      data: [120, 180, 150, 220, 190, 250, incomeRecords.reduce((s, r) => s + r.amount, 0) || 210],
    },
  ]

  const options: ApexOptions = {
    chart: { type: 'area', height: 280, toolbar: { show: false }, zoom: { enabled: false } },
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 2 },
    fill: { type: 'gradient', gradient: { opacityFrom: 0.4, opacityTo: 0.05 } },
    colors: ['#003399'],
    xaxis: { categories: last7Days },
    yaxis: { labels: { formatter: (v) => `${currency}${v}` } },
    tooltip: { y: { formatter: (v) => `${currency}${v}` } },
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h5" className="mb-0">
          Daily Revenue
        </CardTitle>
      </CardHeader>
      <CardBody>
        <ReactApexChart options={options} series={series} type="area" height={280} />
      </CardBody>
    </Card>
  )
}

export default DailyRevenueChart
