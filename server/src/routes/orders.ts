import { Router } from 'express'
import { get_order_details } from '../tools/getOrderDetails.js'

export function createOrdersRouter(): Router {
  const router = Router()
  router.post('/lookup', (request, response) => {
    const body: unknown = request.body
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      response.status(400).json({ error: 'An order ID is required.' })
      return
    }
    const orderId = 'order_id' in body ? body.order_id : undefined
    if (orderId !== undefined && typeof orderId !== 'string') {
      response.status(400).json({ error: 'The order ID must be a string.' })
      return
    }
    response.json(typeof orderId === 'string' ? get_order_details(orderId) : get_order_details())
  })
  return router
}
