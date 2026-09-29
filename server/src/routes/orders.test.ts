import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createApp } from '../app.js'

async function withServer(run: (url: string) => Promise<void>): Promise<void> {
  const server = createServer(createApp())
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as AddressInfo
  try { await run(`http://127.0.0.1:${address.port}/api/orders/lookup`) }
  finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) }
}

async function run(): Promise<void> {
  await withServer(async (url) => {
    const response = await fetch(url, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ order_id: 'ORD-101' }),
    })
    assert.equal(response.status, 200)
    const result = await response.json() as { ok: boolean; order?: { orderId: string; tracking: string } }
    assert.equal(result.ok, true)
    assert.equal(result.order?.orderId, 'ORD-101')
    assert.equal(result.order?.tracking, 'BD-982103')
  })
  await withServer(async (url) => {
    const response = await fetch(url, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ order_id: 'ORD-999' }),
    })
    assert.deepEqual(await response.json(), { ok: false, error: { code: 'ORDER_NOT_FOUND', message: 'No order was found for that order ID.' } })
  })
  console.log('All 2 order lookup route tests passed.')
}

void run().catch((error: unknown) => { console.error(error); process.exitCode = 1 })
