export type CustomerIntent =
  | 'ORDER_TRACKING'
  | 'ORDER_CANCELLATION'
  | 'RETURN_REFUND'
  | 'SHIPPING_INFORMATION'
  | 'COD_INFORMATION'
  | 'GENERAL_PRODUCT_INFORMATION'
  | 'OUT_OF_SCOPE'
  | 'UNKNOWN'

export type ResolutionStatus = 'RESOLVED' | 'UNRESOLVED' | 'OUT_OF_SCOPE' | 'INFORMATION_PROVIDED'

export interface CallOutcome {
  readonly customer_intent: CustomerIntent
  readonly order_id: string | null
  readonly resolution_status: ResolutionStatus
  readonly call_summary: string
}

export interface CallTranscriptEntry {
  readonly speaker: 'customer' | 'aria'
  readonly text: string
}

export interface CallToolEvent {
  readonly name: string
  readonly arguments: Readonly<Record<string, unknown>>
  readonly result: {
    readonly ok: boolean
    readonly error?: { readonly code: string }
  }
}

const orderIdPattern = /\bORD-\d{3}\b/gi

function classifyMessage(message: string): CustomerIntent {
  const text = message.toLowerCase()
  if (/\b(book|booking|reserve|reservation)\b.*\b(flight|hotel|restaurant|taxi|cab)\b|\b(flight to|plane ticket|weather forecast|taxi|cab fare|stock market|crypto price)\b/.test(text)) {
    return 'OUT_OF_SCOPE'
  }
  if (/\b(cancel|cancellation|refuse delivery)\b/.test(text)) return 'ORDER_CANCELLATION'
  if (/\b(return|refund|damaged|defective|replacement)\b/.test(text)) return 'RETURN_REFUND'
  if (/\b(where is|where's|track(ing)?|order status|delivery status|check my order|when (will|should) (my order|it arrive)|expected delivery|order.*\b(arrive|reach|deliver)\b)\b/.test(text)) {
    return 'ORDER_TRACKING'
  }
  if (/\b(cod|cash on delivery|pay (by|with) cash|cash at (the )?doorstep|upi at (the )?doorstep)\b/.test(text)) {
    return 'COD_INFORMATION'
  }
  if (/\b(shipping|delivery charge|shipping fee|free delivery|standard delivery|delivery time|shipping policy|deliver(y|ies) take)\b/.test(text)) {
    return 'SHIPPING_INFORMATION'
  }
  if (/\b(product|ingredient|serum|sunscreen|face wash|toner|skincare|skin care)\b/.test(text)) {
    return 'GENERAL_PRODUCT_INFORMATION'
  }
  return 'UNKNOWN'
}

function collectOrderIds(messages: readonly CallTranscriptEntry[], toolCalls: readonly CallToolEvent[]): string[] {
  const ids: string[] = []
  for (const message of messages) {
    if (message.speaker !== 'customer') continue
    for (const match of message.text.matchAll(orderIdPattern)) ids.push(match[0].toUpperCase())
  }
  for (const call of toolCalls) {
    if (call.name !== 'get_order_details') continue
    const value = call.arguments.order_id
    if (typeof value === 'string' && value.trim()) ids.push(value.trim().toUpperCase())
  }
  return [...new Set(ids)]
}

function needsOrderLookup(intent: CustomerIntent, lastCustomerMessage: string): boolean {
  if (intent === 'ORDER_TRACKING' || intent === 'ORDER_CANCELLATION') return true
  return intent === 'RETURN_REFUND' && /\b(my|this|the) order\b/i.test(lastCustomerMessage)
}

function hasAriaRespondedToLatestCustomerMessage(messages: readonly CallTranscriptEntry[]): boolean {
  let lastCustomerIndex = -1
  let lastAriaIndex = -1
  messages.forEach((message, index) => {
    if (message.speaker === 'customer' && message.text.trim()) lastCustomerIndex = index
    if (message.speaker === 'aria' && message.text.trim()) lastAriaIndex = index
  })
  return lastAriaIndex > lastCustomerIndex
}

function lastOrderIdIn(message: string): string | null {
  const ids = [...message.matchAll(orderIdPattern)]
  return ids.at(-1)?.[0].toUpperCase() ?? null
}

function getResolutionStatus(
  intent: CustomerIntent,
  customerMessages: readonly CallTranscriptEntry[],
  messages: readonly CallTranscriptEntry[],
  orderLookups: readonly CallToolEvent[],
): ResolutionStatus {
  if (intent === 'OUT_OF_SCOPE') return 'OUT_OF_SCOPE'
  if (customerMessages.length === 0) return 'UNRESOLVED'

  const lastCustomerMessage = customerMessages.at(-1)?.text ?? ''
  if (needsOrderLookup(intent, lastCustomerMessage)) {
    const latestLookup = orderLookups.at(-1)
    const requestedOrderId = lastOrderIdIn(lastCustomerMessage)
    const lookedUpOrderId = typeof latestLookup?.arguments.order_id === 'string'
      ? latestLookup.arguments.order_id.trim().toUpperCase()
      : null
    if (!latestLookup?.result.ok || !hasAriaRespondedToLatestCustomerMessage(messages)) return 'UNRESOLVED'
    if (requestedOrderId && requestedOrderId !== lookedUpOrderId) return 'UNRESOLVED'
    return intent === 'ORDER_TRACKING' ? 'RESOLVED' : 'INFORMATION_PROVIDED'
  }

  if (intent === 'UNKNOWN' || !hasAriaRespondedToLatestCustomerMessage(messages)) return 'UNRESOLVED'
  return 'INFORMATION_PROVIDED'
}

function describeIntent(intent: CustomerIntent): string {
  switch (intent) {
    case 'ORDER_TRACKING': return 'order delivery status'
    case 'ORDER_CANCELLATION': return 'order cancellation'
    case 'RETURN_REFUND': return 'returns or refunds'
    case 'SHIPPING_INFORMATION': return 'shipping information'
    case 'COD_INFORMATION': return 'cash on delivery'
    case 'GENERAL_PRODUCT_INFORMATION': return 'product information'
    case 'OUT_OF_SCOPE': return 'a request outside Aura Skincare support'
    case 'UNKNOWN': return 'an unclear request'
  }
}

function quoteExcerpt(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  return normalized.length > 240 ? `${normalized.slice(0, 237)}…` : normalized
}

export function createCallOutcome(
  messages: readonly CallTranscriptEntry[],
  toolCalls: readonly CallToolEvent[],
): CallOutcome {
  const customerMessages = messages.filter((message) => message.speaker === 'customer' && message.text.trim())
  const ariaMessages = messages.filter((message) => message.speaker === 'aria' && message.text.trim())
  const orderLookups = toolCalls.filter((call) => call.name === 'get_order_details')
  const orderIds = collectOrderIds(messages, toolCalls)
  const lastCustomerMessage = customerMessages.at(-1)?.text
  const lastCustomerOrderId = lastCustomerMessage ? lastOrderIdIn(lastCustomerMessage) : null
  const intent = customerMessages
    .map((message) => classifyMessage(message.text))
    .filter((messageIntent) => messageIntent !== 'UNKNOWN')
    .at(-1) ?? 'UNKNOWN'
  const latestLookupOrderId = orderLookups
    .map((call) => call.arguments.order_id)
    .reverse()
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0)
    ?.trim().toUpperCase() ?? null
  const orderId = lastCustomerOrderId ?? latestLookupOrderId ?? orderIds.at(-1) ?? null
  const resolutionStatus = getResolutionStatus(intent, customerMessages, messages, orderLookups)

  let callSummary: string
  const lastAriaMessage = ariaMessages.at(-1)?.text
  if (!lastCustomerMessage) {
    callSummary = 'No customer speech was recorded, so the customer’s intent could not be determined.'
  } else if (intent === 'UNKNOWN') {
    callSummary = `Customer’s request was unclear: “${quoteExcerpt(lastCustomerMessage)}”.`
  } else {
    callSummary = `Customer asked about ${describeIntent(intent)}${orderIds.length ? ` (${orderIds.join(', ')})` : ''}.`
  }
  callSummary += lastAriaMessage
    ? ` Aria replied: “${quoteExcerpt(lastAriaMessage)}”.`
    : ' Aria had not replied before the call ended.'
  callSummary += ` Resolution: ${resolutionStatus}.`

  return {
    customer_intent: intent,
    order_id: orderId,
    resolution_status: resolutionStatus,
    call_summary: callSummary,
  }
}
