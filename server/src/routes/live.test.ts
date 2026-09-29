import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { LiveTokenService } from './live.js'
import { createApp } from '../app.js'
import { GeminiConfigurationError } from '../live/tokenService.js'
import { geminiLiveConfig } from '../live/liveConfig.js'

async function withServer(service: LiveTokenService, run: (url: string) => Promise<void>): Promise<void> {
  const server = createServer(createApp(undefined, service))
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as AddressInfo
  try { await run(`http://127.0.0.1:${address.port}/api/live/token`) }
  finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) }
}

async function run(): Promise<void> {
  const liveDeclarations = geminiLiveConfig.tools?.flatMap((tool) => tool.functionDeclarations ?? []) ?? []
  const liveToolNames = liveDeclarations.map((tool) => tool.name)
  assert.deepEqual(liveToolNames, ['get_order_details', 'get_product_catalog'])

  const productCatalogDeclaration = liveDeclarations.find((tool) => tool.name === 'get_product_catalog')
  assert.ok(productCatalogDeclaration, 'Gemini Live exposes get_product_catalog')
  assert.equal(productCatalogDeclaration.parametersJsonSchema?.type, 'object')
  assert.deepEqual(productCatalogDeclaration.parametersJsonSchema?.properties, {})
  assert.equal('required' in productCatalogDeclaration.parametersJsonSchema, false)

  const liveInstructions = geminiLiveConfig.systemInstruction?.parts
    ?.map((part) => part.text ?? '')
    .join('\n') ?? ''
  assert.match(liveInstructions, /Whenever the customer asks what products or categories Aura Skincare offers.*call get_product_catalog before answering/i)
  assert.match(liveInstructions, /do not say the catalog or product list is unavailable while this tool is available/i)

  await withServer(async () => ({ token: 'short-lived-test-token', model: 'gemini-3.8-live' }), async (url) => {
    const response = await fetch(url, { method: 'POST' })
    assert.equal(response.status, 200)
    const payload = await response.json() as { token: string; model: string; config?: unknown }
    assert.equal(payload.token, 'short-lived-test-token')
    assert.equal(payload.model, 'gemini-3.8-live')
    assert.equal('config' in payload, false)
  })

  await withServer(async () => { throw new GeminiConfigurationError() }, async (url) => {
    const response = await fetch(url, { method: 'POST' })
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { error: 'Aria is not configured yet. Set GEMINI_API_KEY on the server, then restart it.' })
  })
  console.log('All 2 Gemini Live token route tests passed.')
}

void run().catch((error: unknown) => { console.error(error); process.exitCode = 1 })
