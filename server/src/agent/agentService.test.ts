import assert from 'node:assert/strict'
import type {
  AgentModelClient,
  AgentModelRequest,
  AgentModelResponse,
} from './agentService.js'
import { AgentConfigurationError, agentService } from './agentService.js'

interface TestCase { readonly name: string; readonly run: () => void | Promise<void> }
const cases: TestCase[] = []

function test(name: string, run: TestCase['run']): void {
  cases.push({ name, run })
}

class MockModelClient implements AgentModelClient {
  readonly requests: AgentModelRequest[] = []
  private index = 0

  constructor(private readonly responses: readonly AgentModelResponse[]) {}

  async createResponse(request: AgentModelRequest): Promise<AgentModelResponse> {
    this.requests.push(request)
    const response = this.responses[this.index]
    this.index += 1
    if (!response) throw new Error('Mock response queue exhausted')
    return response
  }
}

function message(id: string, outputText: string): AgentModelResponse {
  return { id, outputText, functionCalls: [] }
}

function toolCall(orderId: string): AgentModelResponse {
  return {
    id: 'response-with-tool-call',
    outputText: '',
    functionCalls: [{
      callId: 'call-order-lookup',
      name: 'get_order_details',
      arguments: JSON.stringify({ order_id: orderId }),
    }],
  }
}

function productCatalogCall(): AgentModelResponse {
  return {
    id: 'response-with-catalog-call',
    outputText: '',
    functionCalls: [{ callId: 'call-product-catalog', name: 'get_product_catalog', arguments: '{}' }],
  }
}

test('answers an approved shipping policy question without calling a tool', async () => {
  const model = new MockModelClient([message(
    'response-policy',
    'Delivery is free above ₹499. Orders below that have a ₹50 shipping fee, and standard delivery takes 3–5 business days.',
  )])
  const result = await agentService({ message: 'What is your shipping policy?', modelClient: model, model: 'test-model' })

  assert.equal(result.toolCalls.length, 0)
  assert.match(result.message, /3–5 business days/)
  assert.match(model.requests[0].instructions, /Premium organic Indian skincare brand/)
  assert.match(model.requests[0].instructions, /freeDeliveryAboveRupees":499/)
})

test('calls get_product_catalog for a product-category question', async () => {
  const model = new MockModelClient([
    productCatalogCall(),
    message('response-catalog', 'Aura Skincare offers serums priced from ₹499 to ₹1,299.'),
  ])
  const result = await agentService({ message: 'What types of products do you have?', modelClient: model, model: 'test-model' })

  assert.match(result.message, /serums/i)
  assert.deepEqual(result.toolCalls[0], {
    name: 'get_product_catalog',
    arguments: {},
    result: {
      ok: true,
      categories: [
        { category: 'Face Wash', price_range: '₹299–₹599' },
        { category: 'Serums', price_range: '₹499–₹1,299' },
        { category: 'Sunscreens', price_range: '₹399–₹899' },
        { category: 'Toners', price_range: '₹349–₹699' },
        { category: 'Moisturizers', price_range: '₹399–₹999' },
        { category: 'Face Masks', price_range: '₹299–₹699' },
        { category: 'Lip Care', price_range: '₹199–₹499' },
        { category: 'Body Care', price_range: '₹299–₹899' },
        { category: 'Hair Care', price_range: '₹299–₹999' },
        { category: 'Perfumes / Fragrances', price_range: '₹599–₹1,499' },
      ],
    },
  })
  assert.match(model.requests[0].instructions, /asks what products or categories Aura Skincare offers.*call get_product_catalog before answering/i)
  assert.match(model.requests[0].instructions, /do not say the catalog or product list is unavailable while this tool is available/i)
  assert.match(model.requests[0].instructions, /do not invent individual products, individual prices, discounts, ingredients, benefits, stock status, or product claims/i)
  const toolResult = model.requests[1].input.find((item) => item.role === 'tool')
  assert.ok(toolResult && toolResult.role === 'tool')
  if (toolResult?.role === 'tool') {
    assert.equal(toolResult.name, 'get_product_catalog')
    assert.match(toolResult.content, /₹499–₹1,299/)
  }
})

test('product list, serum price-range, and product-type prompts dispatch the catalog tool', async () => {
  const prompts = [
    'What products do you have?',
    'What is the price range for serums?',
    'What types of skincare products do you sell?',
  ]
  const model = new MockModelClient(prompts.flatMap((_, index) => [
    productCatalogCall(),
    message(`response-guidance-${index}`, 'The catalog tool provides this information.'),
  ]))

  for (const prompt of prompts) {
    const result = await agentService({ message: prompt, modelClient: model, model: 'test-model' })
    assert.equal(result.toolCalls[0]?.name, 'get_product_catalog')
  }
  assert.match(model.requests[0]!.instructions, /what products or categories Aura Skincare offers/i)
  assert.match(model.requests[0]!.instructions, /category such as serums/i)
  assert.match(model.requests[0]!.instructions, /what types of skincare products it sells/i)
})

test('looks up ORD-101 and sends the real tool result back to the model', async () => {
  const model = new MockModelClient([toolCall('ORD-101'), message('response-final', 'ORD-101 is out for delivery with BlueDart, tracking BD-982103. It is expected at 6 PM today.')])
  const result = await agentService({ message: 'Where is ORD-101?', modelClient: model, model: 'test-model' })

  assert.match(result.message, /BlueDart/)
  assert.equal(result.toolCalls[0].name, 'get_order_details')
  assert.deepEqual(result.toolCalls[0].arguments, { order_id: 'ORD-101' })
  assert.deepEqual(result.toolCalls[0].result, {
    ok: true,
    order: {
      orderId: 'ORD-101', customer: 'Priya Sharma', product: 'Vitamin C Serum (30ml)',
      valueRupees: 699, status: 'Out for Delivery', courier: 'BlueDart',
      tracking: 'BD-982103', expected: '6 PM today',
    },
  })
  assert.equal(model.requests[1].toolChoice, 'none')
  const assistantToolMessage = model.requests[1].input.find((item) => item.role === 'assistant' && 'tool_calls' in item)
  assert.ok(assistantToolMessage && 'tool_calls' in assistantToolMessage)
  if (assistantToolMessage && 'tool_calls' in assistantToolMessage) {
    assert.equal(assistantToolMessage.tool_calls[0].function.name, 'get_order_details')
  }
  const sentToolResult = model.requests[1].input.find((item) => item.role === 'tool')
  assert.ok(sentToolResult && sentToolResult.role === 'tool')
  if (sentToolResult?.role === 'tool') assert.match(sentToolResult.content, /BD-982103/)
})

test('preserves Gemini model-turn signature and function-call ID for the tool round trip', async () => {
  const modelTurn = {
    role: 'model' as const,
    parts: [{
      functionCall: { id: 'gemini-function-call-id', name: 'get_order_details', args: { order_id: 'ORD-101' } },
      thoughtSignature: 'opaque-signature-fixture',
    }],
  }
  const model = new MockModelClient([
    {
      id: 'response-with-signed-tool-call',
      outputText: '',
      functionCalls: [{ callId: 'gemini-function-call-id', name: 'get_order_details', arguments: '{"order_id":"ORD-101"}' }],
      modelContent: modelTurn,
    },
    message('response-final', 'ORD-101 is out for delivery.'),
  ])

  await agentService({ message: 'Where is ORD-101?', modelClient: model, model: 'test-model' })

  const returnedModelTurn = model.requests[1].input[1]
  assert.ok(returnedModelTurn && returnedModelTurn.role === 'model')
  if (returnedModelTurn?.role === 'model') assert.equal(returnedModelTurn.modelContent.parts?.[0]?.thoughtSignature, 'opaque-signature-fixture')
  const toolResult = model.requests[1].input.find((item) => item.role === 'tool')
  assert.ok(toolResult && toolResult.role === 'tool')
  if (toolResult?.role === 'tool') assert.equal(toolResult.tool_call_id, 'gemini-function-call-id')
})

test('looks up ORD-102 and keeps its delivered order data grounded in the tool result', async () => {
  const model = new MockModelClient([
    toolCall('ORD-102'),
    message('response-delivered', 'ORD-102 was delivered by Delhivery 14 days ago.'),
  ])
  const result = await agentService({ message: 'Was ORD-102 delivered?', modelClient: model, model: 'test-model' })

  assert.match(result.message, /delivered by Delhivery/)
  assert.deepEqual(result.toolCalls[0].result, {
    ok: true,
    order: {
      orderId: 'ORD-102', customer: 'Rahul Verma', product: 'Hydrating Sunscreen SPF 50',
      valueRupees: 499, status: 'Delivered', courier: 'Delhivery', tracking: 'DL-441029', delivered: '14 days ago',
    },
  })
})

test('looks up ORD-103 for a cancellation question', async () => {
  const model = new MockModelClient([toolCall('ORD-103'), message('response-cancel', 'ORD-103 is Processing and marked eligible for cancellation.')])
  const result = await agentService({ message: 'Can I cancel ORD-103?', modelClient: model, model: 'test-model' })
  assert.match(result.message, /Processing/)
  assert.equal(result.toolCalls[0].result.ok, true)
  assert.match(model.requests[0].instructions, /cannot process the cancellation here/i)
})

test('returns policy-based guidance rather than agreeing to an unsupported return', async () => {
  const model = new MockModelClient([toolCall('ORD-101'), message(
    'response-return',
    'Returns are accepted within 7 days of delivery if the product is unopened, unused, and in its original packaging. I can’t confirm eligibility from purchase date alone.',
  )])
  const result = await agentService({
    message: 'I bought ORD-101 20 days ago. Can I return it?',
    modelClient: model,
    model: 'test-model',
  })

  assert.match(result.message, /7 days of delivery/)
  assert.match(result.message, /can’t confirm eligibility/)
  assert.equal(result.toolCalls[0].result.ok, true)
})

test('passes an unknown order result to the model without fabricating order details', async () => {
  const model = new MockModelClient([toolCall('ORD-999'), message('response-unknown', 'I couldn’t find ORD-999. Could you check the order ID?')])
  const result = await agentService({ message: 'Where is ORD-999?', modelClient: model, model: 'test-model' })

  assert.deepEqual(result.toolCalls[0].result, {
    ok: false,
    error: { code: 'ORDER_NOT_FOUND', message: 'No order was found for that order ID.' },
  })
  assert.match(result.message, /couldn’t find/)
  const toolResult = model.requests[1].input.find((item) => item.role === 'tool')
  assert.ok(toolResult && toolResult.role === 'tool')
  if (toolResult?.role === 'tool') assert.doesNotMatch(toolResult.content, /Priya|BlueDart/)
})

test('asks for an order ID when none was supplied and does not guess', async () => {
  const model = new MockModelClient([message('response-ask-id', 'Of course. Could you share your order ID so I can check it?')])
  const result = await agentService({ message: 'Can you check my order?', modelClient: model, model: 'test-model' })
  assert.equal(result.toolCalls.length, 0)
  assert.match(result.message, /order ID/)
})

test('politely refuses an unrelated flight-booking request', async () => {
  const model = new MockModelClient([message('response-scope', 'I can only help with Aura Skincare questions. Is there anything about your skincare order I can help with?')])
  const result = await agentService({ message: 'Can you book me a flight to Goa?', modelClient: model, model: 'test-model' })
  assert.equal(result.toolCalls.length, 0)
  assert.match(result.message, /Aura Skincare/)
})

test('rejects malformed tool arguments and returns the tool error to the model', async () => {
  const malformed: AgentModelResponse = {
    id: 'response-invalid-tool',
    outputText: '',
    functionCalls: [{ callId: 'call-invalid', name: 'get_order_details', arguments: '{"order_id":7}' }],
  }
  const model = new MockModelClient([malformed, message('response-invalid-final', 'Please share a valid order ID so I can check it.')])
  const result = await agentService({ message: 'Where is my order?', modelClient: model, model: 'test-model' })

  assert.deepEqual(result.toolCalls[0].result, {
    ok: false,
    error: {
      code: 'INVALID_TOOL_ARGUMENTS',
      message: 'The order lookup could not be completed because the tool request was invalid.',
    },
  })
  assert.deepEqual(result.toolCalls[0].arguments, {})
})

test('returns transcript-ready history and accepts prior user/assistant context', async () => {
  const model = new MockModelClient([message('response-context', 'Yes, standard delivery is 3–5 business days.')])
  const history = [
    { role: 'user', content: 'What is your shipping policy?' },
    { role: 'assistant', content: 'Delivery is free above ₹499.' },
  ] as const
  const result = await agentService({ message: 'And how long does it take?', history, modelClient: model, model: 'test-model' })

  assert.deepEqual(model.requests[0].input.slice(0, 2), history)
  assert.deepEqual(result.history.slice(-2), [
    { role: 'user', content: 'And how long does it take?' },
    { role: 'assistant', content: 'Yes, standard delivery is 3–5 business days.' },
  ])
})

test('uses prior intent when the customer supplies the requested order ID on the next turn', async () => {
  const scenarios = [
    {
      previousRequest: 'I want to cancel my order.',
      clarification: 'Could you share your order ID?',
      orderId: 'ORD-103',
      expectedStatus: 'Processing',
    },
    {
      previousRequest: 'My order is late.',
      clarification: 'Please share your order ID so I can check the status.',
      orderId: 'ORD-101',
      expectedStatus: 'Out for Delivery',
    },
  ] as const

  for (const scenario of scenarios) {
    const firstModel = new MockModelClient([message('response-ask-id', scenario.clarification)])
    const firstTurn = await agentService({
      message: scenario.previousRequest,
      modelClient: firstModel,
      model: 'test-model',
    })
    const followUpModel = new MockModelClient([
      toolCall(scenario.orderId),
      message('response-with-order', `The order status is ${scenario.expectedStatus}.`),
    ])
    const followUp = await agentService({
      message: scenario.orderId,
      history: firstTurn.history,
      modelClient: followUpModel,
      model: 'test-model',
    })

    assert.deepEqual(followUpModel.requests[0].input.slice(0, firstTurn.history.length), firstTurn.history)
    assert.deepEqual(followUp.toolCalls[0].arguments, { order_id: scenario.orderId })
    assert.equal(followUp.toolCalls[0].result.ok, true)
    if (followUp.toolCalls[0].result.ok && 'order' in followUp.toolCalls[0].result) {
      assert.equal(followUp.toolCalls[0].result.order.status, scenario.expectedStatus)
    }
    assert.match(followUp.message, new RegExp(scenario.expectedStatus))
  }
})

test('requires Gemini API key configuration for live agent calls', async () => {
  const previousKey = process.env.GEMINI_API_KEY
  delete process.env.GEMINI_API_KEY
  try {
    await assert.rejects(agentService({ message: 'Hello' }), AgentConfigurationError)
  } finally {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY
    else process.env.GEMINI_API_KEY = previousKey
  }
})

for (const item of cases) {
  try {
    await item.run()
    console.log(`✓ ${item.name}`)
  } catch (error) {
    console.error(`✗ ${item.name}`)
    console.error(error)
    process.exitCode = 1
  }
}
if (process.exitCode !== 1) console.log(`All ${cases.length} agent service tests passed.`)
