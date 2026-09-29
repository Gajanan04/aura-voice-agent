export type OrderLookupResult =
  | { readonly ok: true; readonly order: Readonly<Record<string, unknown>> }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }

export interface ProductCategory {
  readonly category: string
  readonly price_range: string
}

export type ProductCatalogResult =
  | { readonly ok: true; readonly categories: readonly ProductCategory[] }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }

export interface LiveSessionCredentials {
  readonly token: string
  readonly model: string
}

async function apiError(response: Response, fallback: string): Promise<Error> {
  try {
    const payload: unknown = await response.json()
    if (typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string') {
      return new Error(payload.error)
    }
  } catch { /* use the safe message below */ }
  return new Error(fallback)
}

export async function requestLiveCredentials(): Promise<LiveSessionCredentials> {
  let response: Response
  try {
    response = await fetch('/api/live/token', { method: 'POST' })
  } catch {
    throw new Error('Can’t reach Aura support. Check that the backend is running and try again.')
  }
  if (!response.ok) throw await apiError(response, 'Gemini Live could not be started. Please try again.')
  const payload: unknown = await response.json()
  if (typeof payload !== 'object' || payload === null || !('token' in payload) || typeof payload.token !== 'string'
    || !('model' in payload) || typeof payload.model !== 'string') {
    throw new Error('Aura support returned invalid Gemini Live session details.')
  }
  return { token: payload.token, model: payload.model }
}

export async function lookupOrder(orderId: string): Promise<OrderLookupResult> {
  let response: Response
  try {
    response = await fetch('/api/orders/lookup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ order_id: orderId }),
    })
  } catch {
    throw new Error('Can’t reach Aura’s order lookup service.')
  }
  if (!response.ok) throw await apiError(response, 'Aura’s order lookup could not be completed.')
  return await response.json() as OrderLookupResult
}

export async function lookupProductCatalog(): Promise<ProductCatalogResult> {
  let response: Response
  try {
    response = await fetch('/api/catalog')
  } catch {
    throw new Error('Can’t reach Aura’s product catalog.')
  }
  if (!response.ok) throw await apiError(response, 'Aura’s product catalog could not be returned.')
  return await response.json() as ProductCatalogResult
}
