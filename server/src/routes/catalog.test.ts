import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createApp } from '../app.js'
import { get_product_catalog } from '../tools/getProductCatalog.js'

const server = createServer(createApp())
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
const address = server.address() as AddressInfo
try {
  const response = await fetch(`http://127.0.0.1:${address.port}/api/catalog`)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), get_product_catalog())
  console.log('GET /api/catalog returns the server-owned product catalog.')
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
}
