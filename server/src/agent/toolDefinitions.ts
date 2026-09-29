/** Gemini function schemas for the server-owned Aura tools. */
export const orderLookupTool = {
  name: 'get_order_details',
  description: 'Look up a customer order using its exact order ID. Use this whenever actual order information is needed. Do not guess an ID.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      order_id: { type: 'string', description: 'The order ID supplied by the customer, such as ORD-101.' },
    },
    required: ['order_id'],
    additionalProperties: false,
  },
} as const

export const productCatalogTool = {
  name: 'get_product_catalog',
  description: 'Call this tool whenever a customer asks what products or categories Aura Skincare offers, what types of skincare products it sells, or asks about general/category price ranges. It returns the complete category-level price ranges. Do not use for order questions.',
  parametersJsonSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
} as const

export const auraToolDefinitions = [orderLookupTool, productCatalogTool]
