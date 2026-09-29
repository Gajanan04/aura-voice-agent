import type { Order } from './types.js'

export const mockOrders: readonly Order[] = [
  {
    orderId: 'ORD-101',
    customer: 'Priya Sharma',
    product: 'Vitamin C Serum (30ml)',
    valueRupees: 699,
    status: 'Out for Delivery',
    courier: 'BlueDart',
    tracking: 'BD-982103',
    expected: '6 PM today',
  },
  {
    orderId: 'ORD-102',
    customer: 'Rahul Verma',
    product: 'Hydrating Sunscreen SPF 50',
    valueRupees: 499,
    status: 'Delivered',
    courier: 'Delhivery',
    tracking: 'DL-441029',
    delivered: '14 days ago',
  },
  {
    orderId: 'ORD-103',
    customer: 'Ananya Patel',
    product: 'Green Tea Face Wash + Toner',
    valueRupees: 850,
    status: 'Processing',
    ordered: '3 hours ago',
    cancellation: 'Eligible',
  },
]
