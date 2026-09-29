import assert from 'node:assert/strict'
import { createCallOutcome } from '../test-dist/lib/callOutcome.js'

function transcript(customer, aria) {
  return [
    ...(customer ? [{ speaker: 'customer', text: customer }] : []),
    ...(aria ? [{ speaker: 'aria', text: aria }] : []),
  ]
}

function lookup(orderId, ok = true) {
  return [{
    name: 'get_order_details',
    arguments: { order_id: orderId },
    result: ok ? { ok: true, order: { order_id: orderId } } : { ok: false, error: { code: 'ORDER_NOT_FOUND' } },
  }]
}

const cases = [
  {
    name: 'valid ORD-101 delivery tracking',
    messages: transcript('Where is my order ORD-101?', 'It is out for delivery and expected at 6 PM today.'),
    tools: lookup('ORD-101'),
    expected: ['ORDER_TRACKING', 'ORD-101', 'RESOLVED'],
  },
  {
    name: 'ORD-103 cancellation eligibility is information, not an executed cancellation',
    messages: transcript('Can I cancel order ORD-103?', 'It is still processing, so it is eligible for cancellation.'),
    tools: lookup('ORD-103'),
    expected: ['ORDER_CANCELLATION', 'ORD-103', 'INFORMATION_PROVIDED'],
  },
  {
    name: 'general return policy question',
    messages: transcript('What is your return policy?', 'Returns are accepted within 7 days if unopened and unused.'),
    tools: [],
    expected: ['RETURN_REFUND', null, 'INFORMATION_PROVIDED'],
  },
  {
    name: 'shipping policy question',
    messages: transcript('What is the standard delivery time?', 'Standard delivery takes 3–5 business days.'),
    tools: [],
    expected: ['SHIPPING_INFORMATION', null, 'INFORMATION_PROVIDED'],
  },
  {
    name: 'out-of-scope flight request',
    messages: transcript('Can you book me a flight to Goa?', 'I can only help with Aura Skincare questions.'),
    tools: [],
    expected: ['OUT_OF_SCOPE', null, 'OUT_OF_SCOPE'],
  },
  {
    name: 'unknown customer intent remains unresolved',
    messages: transcript('Can you help me?', 'Could you tell me what you need help with?'),
    tools: [],
    expected: ['UNKNOWN', null, 'UNRESOLVED'],
  },
  {
    name: 'invalid order ID is not treated as resolved',
    messages: transcript('Track order ORD-999.', 'I could not find order ORD-999.'),
    tools: lookup('ORD-999', false),
    expected: ['ORDER_TRACKING', 'ORD-999', 'UNRESOLVED'],
  },
  {
    name: 'missing order ID stays unresolved when tracking requires a lookup',
    messages: transcript('Can you check my order?', 'Please share your order ID so I can check it.'),
    tools: [],
    expected: ['ORDER_TRACKING', null, 'UNRESOLVED'],
  },
  {
    name: 'single customer message without an Aria response remains unresolved',
    messages: transcript('Where is my order ORD-101?', ''),
    tools: [],
    expected: ['ORDER_TRACKING', 'ORD-101', 'UNRESOLVED'],
  },
  {
    name: 'a new unanswered tracking request cannot reuse an earlier order lookup or response',
    messages: [
      { speaker: 'customer', text: 'Where is ORD-101?' },
      { speaker: 'aria', text: 'ORD-101 is out for delivery.' },
      { speaker: 'customer', text: 'Where is ORD-102?' },
    ],
    tools: lookup('ORD-101'),
    expected: ['ORDER_TRACKING', 'ORD-102', 'UNRESOLVED'],
  },
  {
    name: 'a prior failed order lookup does not mark a later answered policy question unresolved',
    messages: [
      { speaker: 'customer', text: 'Track ORD-999.' },
      { speaker: 'aria', text: 'I could not find that order.' },
      { speaker: 'customer', text: 'What is the standard delivery time?' },
      { speaker: 'aria', text: 'Standard delivery takes 3–5 business days.' },
    ],
    tools: lookup('ORD-999', false),
    expected: ['SHIPPING_INFORMATION', 'ORD-999', 'INFORMATION_PROVIDED'],
  },
  {
    name: 'empty call has a controlled unresolved outcome',
    messages: [],
    tools: [],
    expected: ['UNKNOWN', null, 'UNRESOLVED'],
  },
  {
    name: 'unclear speech clarification does not fabricate a customer turn',
    messages: transcript('', 'I did not quite catch that. Could you please repeat?'),
    tools: [],
    expected: ['UNKNOWN', null, 'UNRESOLVED'],
  },
  {
    name: 'multiple order lookups retain IDs and select the latest lookup',
    messages: [
      { speaker: 'customer', text: 'Track order ORD-101.' },
      { speaker: 'aria', text: 'ORD-101 is out for delivery.' },
      { speaker: 'customer', text: 'Now check order ORD-102.' },
      { speaker: 'aria', text: 'ORD-102 was delivered.' },
    ],
    tools: [...lookup('ORD-101'), ...lookup('ORD-102')],
    expected: ['ORDER_TRACKING', 'ORD-102', 'RESOLVED'],
    summaryIncludes: ['ORD-101', 'ORD-102'],
  },
]

for (const testCase of cases) {
  const outcome = createCallOutcome(testCase.messages, testCase.tools)
  assert.deepEqual(
    [outcome.customer_intent, outcome.order_id, outcome.resolution_status],
    testCase.expected,
    testCase.name,
  )
  for (const text of testCase.summaryIncludes ?? []) assert.ok(outcome.call_summary.includes(text), testCase.name)
  assert.equal(typeof outcome.call_summary, 'string', testCase.name)
}

console.log(`Passed ${cases.length} call outcome tests.`)
