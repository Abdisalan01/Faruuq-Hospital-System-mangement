import { DEFAULT_PAGE_TITLE } from '@/context/constants'

const PageMetaData = ({ title }: { title: string }) => {
  const defaultTitle = DEFAULT_PAGE_TITLE
  return (
      <title>{title ? `${title} | Rasket React- Responsive Admin Dashboard Template` : defaultTitle}</title>
  )
}

export default PageMetaData
