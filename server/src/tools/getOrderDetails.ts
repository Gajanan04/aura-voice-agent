import { mockOrders } from '../data/orders.js'
import type { OrderLookupResult } from '../data/types.js'

/** Looks up only seeded assessment orders; surrounding whitespace and letter case are ignored. */
export function get_order_details(orderId?: string | null): OrderLookupResult {
  if (typeof orderId !== 'string' || orderId.trim().length === 0) {
    return {
      ok: false,
      error: { code: 'MISSING_ORDER_ID', message: 'An order ID is required.' },
    }
  }

  const normalizedOrderId = orderId.trim().toUpperCase()
  const order = mockOrders.find((candidate) => candidate.orderId === normalizedOrderId)

  if (!order) {
    return {
      ok: false,
      error: { code: 'ORDER_NOT_FOUND', message: 'No order was found for that order ID.' },
    }
  }

  return { ok: true, order }
}
