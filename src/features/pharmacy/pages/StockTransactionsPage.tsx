import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Col,
  Form,
  Row,
  Table,
} from 'react-bootstrap'

import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { currency } from '@/context/constants'
import { useAuthContext } from '@/context/useAuthContext'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import StatCard from '@/shared/components/StatCard'
import StatusBadge from '@/shared/components/StatusBadge'
import {
  generateId,
  inventoryItems,
  persistStockTransactionsNowAsync,
  stockTransactions as storeTransactions,
  syncMedicineStatusForInventoryItem,
  touchHmsStore,
} from '@/shared/services/hmsStore'
import type { InventoryCategory } from '@/shared/types'

const PAGE_SIZE = 10
const CATEGORIES: InventoryCategory[] = ['Medicines', 'Medical Supplies', 'Consumables']

type CategoryFilter = 'all' | InventoryCategory

type CartLine = {
  itemId: string
  name: string
  unitPrice: number
  quantity: number
  available: number
}

const toDateKey = (iso: string) => iso.slice(0, 10)

const StockTransactionsPage = () => {
  const { user } = useAuthContext()
  const { isSupabase } = useHmsStoreContext()
  const [, setTick] = useState(0)
  const refresh = () => setTick((t) => t + 1)

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [historyDateFrom, setHistoryDateFrom] = useState('')
  const [historyDateTo, setHistoryDateTo] = useState('')
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState<CategoryFilter>('all')
  const [historyPage, setHistoryPage] = useState(1)

  const [cart, setCart] = useState<CartLine[]>([])
  const [pickItemId, setPickItemId] = useState('')
  const [pickQty, setPickQty] = useState(1)
  const [customerName, setCustomerName] = useState('')
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null)

  const totalStockQty = useMemo(
    () => inventoryItems.reduce((sum, i) => sum + i.quantity, 0),
    [inventoryItems.length],
  )

  const availableItems = useMemo(() => {
    const q = search.toLowerCase().trim()
    return inventoryItems
      .filter((i) => categoryFilter === 'all' || i.category === categoryFilter)
      .filter((i) => {
        if (!q) return true
        return `${i.name} ${i.category} ${i.unit}`.toLowerCase().includes(q)
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [search, categoryFilter, inventoryItems.length])

  const transactions = useMemo(
    () => [...storeTransactions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [storeTransactions.length],
  )

  const filteredHistory = useMemo(() => {
    return transactions.filter((txn) => {
      const item = inventoryItems.find((i) => i.id === txn.itemId)
      if (historyCategoryFilter !== 'all' && item?.category !== historyCategoryFilter) return false

      const txnDate = toDateKey(txn.createdAt)
      if (historyDateFrom && txnDate < historyDateFrom) return false
      if (historyDateTo && txnDate > historyDateTo) return false

      return true
    })
  }, [transactions, historyDateFrom, historyDateTo, historyCategoryFilter])

  const historySummary = useMemo(() => {
    let totalAmount = 0
    let totalQty = 0
    const itemIds = new Set<string>()

    for (const txn of filteredHistory) {
      totalQty += txn.quantity
      totalAmount += (txn.unitPrice ?? 0) * txn.quantity
      itemIds.add(txn.itemId)
    }

    const stockInHand = [...itemIds].reduce((sum, id) => {
      const item = inventoryItems.find((i) => i.id === id)
      return sum + (item?.quantity ?? 0)
    }, 0)

    return { totalAmount, totalQty, stockInHand, count: filteredHistory.length }
  }, [filteredHistory])

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / PAGE_SIZE))
  const safePage = Math.min(historyPage, totalPages)

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return filteredHistory.slice(start, start + PAGE_SIZE)
  }, [filteredHistory, safePage])

  const rangeStart = filteredHistory.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filteredHistory.length)

  useEffect(() => {
    setHistoryPage(1)
  }, [historyDateFrom, historyDateTo, historyCategoryFilter])

  const cartTotal = cart.reduce((s, line) => s + line.quantity * line.unitPrice, 0)
  const cartQty = cart.reduce((s, line) => s + line.quantity, 0)

  const addToCart = (itemId?: string) => {
    const id = itemId ?? pickItemId
    const item = inventoryItems.find((i) => i.id === id)
    if (!item || pickQty <= 0) return

    if (item.quantity < pickQty) {
      setMessage({ type: 'danger', text: `Insufficient stock for ${item.name}` })
      return
    }

    setCart((prev) => {
      const existing = prev.find((l) => l.itemId === item.id)
      if (existing) {
        const newQty = existing.quantity + pickQty
        if (item.quantity < newQty) {
          setMessage({ type: 'danger', text: `Insufficient stock for ${item.name}` })
          return prev
        }
        return prev.map((l) =>
          l.itemId === item.id ? { ...l, quantity: newQty } : l,
        )
      }
      return [
        ...prev,
        {
          itemId: item.id,
          name: item.name,
          unitPrice: item.unitPrice,
          quantity: pickQty,
          available: item.quantity,
        },
      ]
    })
    setPickItemId('')
    setPickQty(1)
    setMessage(null)
  }

  const updateCartQty = (itemId: string, quantity: number) => {
    const item = inventoryItems.find((i) => i.id === itemId)
    if (!item || quantity <= 0) {
      setCart((prev) => prev.filter((l) => l.itemId !== itemId))
      return
    }
    if (item.quantity < quantity) {
      setMessage({ type: 'danger', text: `Only ${item.quantity} in stock for ${item.name}` })
      return
    }
    setCart((prev) => prev.map((l) => (l.itemId === itemId ? { ...l, quantity } : l)))
  }

  const completeTransaction = async () => {
    if (cart.length === 0) {
      setMessage({ type: 'danger', text: 'Add at least one item to the cart.' })
      return
    }

    const ref = customerName.trim() || undefined
    const note = notes.trim() || undefined

    for (const line of cart) {
      const item = inventoryItems.find((i) => i.id === line.itemId)
      if (!item) continue

      if (item.quantity < line.quantity) {
        setMessage({ type: 'danger', text: `Insufficient stock for ${item.name}` })
        return
      }
      item.quantity -= line.quantity
      syncMedicineStatusForInventoryItem(item)

      storeTransactions.push({
        id: generateId('st'),
        itemId: item.id,
        type: 'Dispense',
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        reference: ref,
        notes: note,
        createdAt: new Date().toISOString(),
        createdBy: user?.id ?? 'staff-006',
      })
    }

    touchHmsStore()

    try {
      if (isSupabase) await persistStockTransactionsNowAsync()
    } catch {
      setMessage({ type: 'danger', text: 'Sale saved locally but database sync failed.' })
      refresh()
      return
    }

    setMessage({
      type: 'success',
      text: `Sale completed — ${cart.length} item(s), total ${currency}${cartTotal.toFixed(2)}.${
        isSupabase ? ' Saved to database.' : ''
      }`,
    })
    setCart([])
    setCustomerName('')
    setNotes('')
    refresh()
  }

  const getItemName = (id: string) => inventoryItems.find((i) => i.id === id)?.name ?? '—'

  return (
    <PermissionGuard permissions={['stock_management']}>
      <PageMetaData title="Stock Transactions" />
      <PageHeader
        title="Stock Transactions"
        subtitle="Dispense medicines and review sales history"
        breadcrumbs={[
          { label: 'Pharmacy', href: '/hms/pharmacy/dashboard' },
          { label: 'Stock Transactions' },
        ]}
      />

      {message && (
        <Alert variant={message.type} dismissible onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <Row className="mb-3">
        <StatCard
          title="Items in Stock"
          value={totalStockQty}
          icon="solar:box-broken"
          variant="primary"
        />
        <StatCard
          title="Cart Items"
          value={cart.length}
          icon="solar:cart-large-2-broken"
          variant="warning"
        />
        <StatCard
          title="Cart Total"
          value={`${currency}${cartTotal.toFixed(2)}`}
          icon="solar:wallet-money-broken"
          variant="success"
        />
        <StatCard
          title="Cart Qty"
          value={cartQty}
          icon="solar:hashtag-broken"
          variant="info"
        />
      </Row>

      <Row className="g-3 mb-3">
        <Col xl={5}>
          <Card className="h-100 border-primary border-opacity-25">
            <CardBody>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="mb-0">
                  <IconifyIcon icon="solar:box-minimalistic-broken" className="me-1 text-primary" />
                  Browse stock
                </h5>
                <Badge bg="primary-subtle" text="primary">
                  {availableItems.length} items
                </Badge>
              </div>

              <Form.Control
                type="search"
                className="mb-2"
                placeholder="Search item name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <div className="d-flex flex-wrap gap-1 mb-3">
                <Button
                  size="sm"
                  variant={categoryFilter === 'all' ? 'primary' : 'outline-secondary'}
                  onClick={() => setCategoryFilter('all')}
                >
                  All
                </Button>
                {CATEGORIES.map((cat) => (
                  <Button
                    key={cat}
                    size="sm"
                    variant={categoryFilter === cat ? 'primary' : 'outline-secondary'}
                    onClick={() => setCategoryFilter(cat)}
                  >
                    {cat}
                  </Button>
                ))}
              </div>

              <div className="border rounded" style={{ maxHeight: 320, overflowY: 'auto' }}>
                {availableItems.length === 0 ? (
                  <p className="text-muted text-center py-4 mb-0">No items found.</p>
                ) : (
                  availableItems.map((item) => (
                    <div
                      key={item.id}
                      className={`d-flex justify-content-between align-items-center px-3 py-2 border-bottom ${
                        pickItemId === item.id ? 'bg-primary bg-opacity-10' : ''
                      }`}
                      role="button"
                      onClick={() => setPickItemId(item.id)}
                    >
                      <div>
                        <div className="fw-medium">{item.name}</div>
                        <small className="text-muted">
                          {item.category} · {item.unit} · Stock: {item.quantity}
                        </small>
                      </div>
                      <div className="text-end">
                        <div className="fw-semibold text-success">
                          {currency}
                          {item.unitPrice.toFixed(2)}
                        </div>
                        <Button
                          size="sm"
                          variant="outline-primary"
                          className="mt-1"
                          onClick={(e) => {
                            e.stopPropagation()
                            setPickItemId(item.id)
                            addToCart(item.id)
                          }}
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <Row className="g-2 mt-3 align-items-end">
                <Col xs={5}>
                  <Form.Label className="small text-muted">Quantity</Form.Label>
                  <Form.Control
                    type="number"
                    min={1}
                    value={pickQty}
                    onChange={(e) => setPickQty(Number(e.target.value))}
                  />
                </Col>
                <Col xs={7}>
                  <Button
                    variant="primary"
                    className="w-100"
                    onClick={() => addToCart()}
                    disabled={!pickItemId}
                  >
                    <IconifyIcon icon="solar:add-circle-broken" className="me-1" />
                    Add to cart
                  </Button>
                </Col>
              </Row>
            </CardBody>
          </Card>
        </Col>

        <Col xl={7}>
          <Card className="h-100 border-success border-opacity-25">
            <CardBody>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="mb-0">
                  <IconifyIcon icon="solar:cart-large-2-broken" className="me-1 text-success" />
                  Sale cart
                </h5>
                {cart.length > 0 && (
                  <Button size="sm" variant="link" className="text-danger" onClick={() => setCart([])}>
                    Clear cart
                  </Button>
                )}
              </div>

              {cart.length === 0 ? (
                <div className="text-center py-5 text-muted border rounded bg-light bg-opacity-50">
                  <IconifyIcon icon="solar:cart-large-minimalistic-broken" className="fs-48 mb-2" />
                  <p className="mb-0">Select items from the left and add them to the cart.</p>
                </div>
              ) : (
                <div className="table-responsive mb-3">
                  <Table size="sm" hover className="mb-0">
                    <thead className="bg-light bg-opacity-50">
                      <tr>
                        <th>Item</th>
                        <th>Price</th>
                        <th style={{ width: 90 }}>Qty</th>
                        <th className="text-end">Subtotal</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map((line) => (
                        <tr key={line.itemId}>
                          <td>{line.name}</td>
                          <td>
                            {currency}
                            {line.unitPrice.toFixed(2)}
                          </td>
                          <td>
                            <Form.Control
                              type="number"
                              size="sm"
                              min={1}
                              value={line.quantity}
                              onChange={(e) => updateCartQty(line.itemId, Number(e.target.value))}
                            />
                          </td>
                          <td className="text-end">
                            {currency}
                            {(line.quantity * line.unitPrice).toFixed(2)}
                          </td>
                          <td className="text-end">
                            <Button
                              size="sm"
                              variant="link"
                              className="text-danger p-0"
                              onClick={() => setCart((prev) => prev.filter((l) => l.itemId !== line.itemId))}
                            >
                              Remove
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}

              <Row className="g-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="small">Customer / Patient (optional)</Form.Label>
                    <Form.Control
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Who is buying?"
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="small">Notes (optional)</Form.Label>
                    <Form.Control
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Additional notes"
                    />
                  </Form.Group>
                </Col>
              </Row>

              <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mt-3 pt-3 border-top">
                <div>
                  <span className="text-muted d-block small">Total qty</span>
                  <span className="fw-semibold">{cartQty}</span>
                </div>
                <div>
                  <span className="text-muted d-block small">Total amount</span>
                  <span className="fs-4 fw-bold text-success">
                    {currency}
                    {cartTotal.toFixed(2)}
                  </span>
                </div>
                <Button
                  variant="success"
                  size="lg"
                  onClick={() => void completeTransaction()}
                  disabled={cart.length === 0}
                >
                  <IconifyIcon icon="solar:wallet-money-broken" className="me-1" />
                  Complete sale
                </Button>
              </div>
            </CardBody>
          </Card>
        </Col>
      </Row>

      <Card>
        <CardBody>
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <h5 className="mb-0">
              <IconifyIcon icon="solar:history-broken" className="me-1" />
              Transaction history
            </h5>
            <Badge bg="secondary-subtle" text="secondary">
              {historySummary.count} records
            </Badge>
          </div>

          <Row className="g-2 mb-3">
            <Col md={3}>
              <Form.Label className="small text-muted">From date</Form.Label>
              <Form.Control
                type="date"
                value={historyDateFrom}
                onChange={(e) => setHistoryDateFrom(e.target.value)}
              />
            </Col>
            <Col md={3}>
              <Form.Label className="small text-muted">To date</Form.Label>
              <Form.Control
                type="date"
                value={historyDateTo}
                onChange={(e) => setHistoryDateTo(e.target.value)}
              />
            </Col>
            <Col md={6}>
              <Form.Label className="small text-muted">Category</Form.Label>
              <div className="d-flex flex-wrap gap-1">
                <Button
                  size="sm"
                  variant={historyCategoryFilter === 'all' ? 'dark' : 'outline-secondary'}
                  onClick={() => setHistoryCategoryFilter('all')}
                >
                  All
                </Button>
                {CATEGORIES.map((cat) => (
                  <Button
                    key={cat}
                    size="sm"
                    variant={historyCategoryFilter === cat ? 'dark' : 'outline-secondary'}
                    onClick={() => setHistoryCategoryFilter(cat)}
                  >
                    {cat}
                  </Button>
                ))}
              </div>
            </Col>
          </Row>

          <Row className="g-2 mb-3">
            <Col md={4}>
              <div className="border rounded p-3 bg-light bg-opacity-50 h-100">
                <p className="text-muted small mb-1">Total amount</p>
                <h4 className="mb-0 text-success">
                  {currency}
                  {historySummary.totalAmount.toFixed(2)}
                </h4>
              </div>
            </Col>
            <Col md={4}>
              <div className="border rounded p-3 bg-light bg-opacity-50 h-100">
                <p className="text-muted small mb-1">Total qty sold</p>
                <h4 className="mb-0">{historySummary.totalQty}</h4>
              </div>
            </Col>
            <Col md={4}>
              <div className="border rounded p-3 bg-light bg-opacity-50 h-100">
                <p className="text-muted small mb-1">Stock in hand (filtered items)</p>
                <h4 className="mb-0 text-primary">{historySummary.stockInHand}</h4>
              </div>
            </Col>
          </Row>

          <div className="table-responsive">
            <Table hover className="mb-0 align-middle">
              <thead className="bg-light bg-opacity-50">
                <tr>
                  <th>Date</th>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Qty</th>
                  <th className="text-end">Amount</th>
                  <th className="text-end">Stock now</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-muted py-4">
                      No transactions match your date or category filters.
                    </td>
                  </tr>
                ) : (
                  pageItems.map((txn) => {
                    const item = inventoryItems.find((i) => i.id === txn.itemId)
                    const amount = (txn.unitPrice ?? 0) * txn.quantity
                    return (
                      <tr key={txn.id}>
                        <td className="small">{new Date(txn.createdAt).toLocaleString()}</td>
                        <td className="fw-medium">{getItemName(txn.itemId)}</td>
                        <td>
                          {item?.category && (
                            <Badge bg="secondary-subtle" text="secondary" className="small">
                              {item.category}
                            </Badge>
                          )}
                        </td>
                        <td>
                          <StatusBadge status={txn.type} />
                        </td>
                        <td>{txn.quantity}</td>
                        <td className="text-end">
                          {txn.unitPrice != null ? `${currency}${amount.toFixed(2)}` : '—'}
                        </td>
                        <td className="text-end fw-semibold">{item?.quantity ?? '—'}</td>
                        <td className="small">{txn.reference ?? txn.notes ?? '—'}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </Table>
          </div>

          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 pt-3 border-top mt-0">
            <p className="text-muted small mb-0">
              {filteredHistory.length === 0
                ? 'Showing 0 records'
                : `Showing ${rangeStart}–${rangeEnd} of ${filteredHistory.length}`}
            </p>
            <div className="d-flex gap-2">
              <Button
                size="sm"
                variant="outline-secondary"
                disabled={safePage <= 1}
                onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
              >
                <IconifyIcon icon="solar:alt-arrow-left-broken" className="me-1" />
                Prev
              </Button>
              <span className="align-self-center small text-muted">
                Page {safePage} of {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline-secondary"
                disabled={safePage >= totalPages}
                onClick={() => setHistoryPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
                <IconifyIcon icon="solar:alt-arrow-right-broken" className="ms-1" />
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </PermissionGuard>
  )
}

export default StockTransactionsPage
