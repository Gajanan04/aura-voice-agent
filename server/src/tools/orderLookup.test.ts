import assert from 'node:assert/strict'
import { get_order_details } from './getOrderDetails.js'

let failures = 0

function test(name: string, run: () => void): void {
  try {
    run()
    console.log(`✓ ${name}`)
  } catch (error) {
    failures += 1
    console.error(`✗ ${name}`)
    console.error(error)
  }
}

test('returns ORD-101 exactly', () => {
  assert.deepEqual(get_order_details('ORD-101'), {
    ok: true,
    order: {
      orderId: 'ORD-101', customer: 'Priya Sharma', product: 'Vitamin C Serum (30ml)',
      valueRupees: 699, status: 'Out for Delivery', courier: 'BlueDart',
      tracking: 'BD-982103', expected: '6 PM today',
    },
  })
})

test('returns ORD-102 exactly', () => {
  assert.deepEqual(get_order_details('ORD-102'), {
    ok: true,
    order: {
      orderId: 'ORD-102', customer: 'Rahul Verma', product: 'Hydrating Sunscreen SPF 50',
      valueRupees: 499, status: 'Delivered', courier: 'Delhivery',
      tracking: 'DL-441029', delivered: '14 days ago',
    },
  })
})

test('returns ORD-103 exactly', () => {
  assert.deepEqual(get_order_details('ORD-103'), {
    ok: true,
    order: {
      orderId: 'ORD-103', customer: 'Ananya Patel', product: 'Green Tea Face Wash + Toner',
      valueRupees: 850, status: 'Processing',
      ordered: '3 hours ago', cancellation: 'Eligible',
    },
  })
})

test('unknown IDs do not produce an order', () => {
  assert.deepEqual(get_order_details('ORD-999'), {
    ok: false,
    error: { code: 'ORDER_NOT_FOUND', message: 'No order was found for that order ID.' },
  })
})

test('missing and empty IDs return a missing-ID error', () => {
  for (const input of [undefined, null, '', '   ']) {
    assert.deepEqual(get_order_details(input), {
      ok: false,
      error: { code: 'MISSING_ORDER_ID', message: 'An order ID is required.' },
    })
  }
})

test('lookup is case-insensitive and ignores surrounding whitespace', () => {
  assert.deepEqual(get_order_details('  ord-101\t'), get_order_details('ORD-101'))
})

if (failures > 0) {
  process.exitCode = 1
} else {
  console.log('All 6 order lookup tests passed.')
}
