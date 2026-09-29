import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createApp } from '../app.js'

async function run(): Promise<void> {
  const server = createServer(createApp())
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as AddressInfo
  const baseUrl = `http://127.0.0.1:${address.port}`

  try {
    // 1. Root route serves index.html (SPA Entry)
    const rootRes = await fetch(`${baseUrl}/`)
    assert.equal(rootRes.status, 200)
    const rootText = await rootRes.text()
    assert.match(rootText, /<div id="root"><\/div>/)

    // 2. Non-API route falls back to SPA index.html
    const spaRes = await fetch(`${baseUrl}/any-client-route`)
    assert.equal(spaRes.status, 200)
    const spaText = await spaRes.text()
    assert.match(spaText, /<div id="root"><\/div>/)

    // 3. API routes are preserved and not intercepted by SPA fallback
    const healthRes = await fetch(`${baseUrl}/api/health`)
    assert.equal(healthRes.status, 200)
    assert.deepEqual(await healthRes.json(), { status: 'ok' })
    assert.equal(healthRes.headers.get('access-control-allow-origin'), '*')

    // 4. CORS preflight OPTIONS request returns 204 with CORS headers
    const optionsRes = await fetch(`${baseUrl}/api/orders/lookup`, { method: 'OPTIONS' })
    assert.equal(optionsRes.status, 204)
    assert.equal(optionsRes.headers.get('access-control-allow-origin'), '*')
    assert.equal(optionsRes.headers.get('access-control-allow-methods'), 'GET, POST, OPTIONS')

    console.log('All static asset, SPA fallback, & CORS route tests passed.')
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
}

void run().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
