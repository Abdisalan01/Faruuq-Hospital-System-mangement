import { useEffect, useMemo, useState } from 'react'

const DEFAULT_PAGE_SIZE = 10

export function useTablePagination<T>(
  items: T[],
  pageSize: number = DEFAULT_PAGE_SIZE,
  resetDeps: unknown[] = [],
) {
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(page, totalPages)

  useEffect(() => {
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset page when filters change
  }, resetDeps)

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, safePage, pageSize])

  const rangeStart = items.length === 0 ? 0 : (safePage - 1) * pageSize + 1
  const rangeEnd = Math.min(safePage * pageSize, items.length)

  return {
    page,
    setPage,
    safePage,
    totalPages,
    pageItems,
    rangeStart,
    rangeEnd,
    totalItems: items.length,
    pageSize,
  }
}
