import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createApp } from '../app.js'
import type { ChatService } from './chat.js'

interface TestCase { readonly name: string; readonly run: () => void | Promise<void> }
const cases: TestCase[] = []
function test(name: string, run: TestCase['run']): void { cases.push({ name, run }) }

async function withServer(service: ChatService, run: (url: string) => Promise<void>): Promise<void> {
  const server = createServer(createApp(service))
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as AddressInfo
  try {
    await run(`http://127.0.0.1:${address.port}/api/chat`)
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
}

test('POST /api/chat returns a structured response and updated history', async () => {
  const service: ChatService = async ({ message, history }) => ({
    message: `Aria reply to: ${message}`,
    toolCalls: [],
    history: [...(history ?? []), { role: 'user', content: message }, { role: 'assistant', content: `Aria reply to: ${message}` }],
  })

  await withServer(service, async (url) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Hello Aura', history: [{ role: 'user', content: 'Earlier question' }] }),
    })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      message: 'Aria reply to: Hello Aura',
      toolCalls: [],
      history: [
        { role: 'user', content: 'Earlier question' },
        { role: 'user', content: 'Hello Aura' },
        { role: 'assistant', content: 'Aria reply to: Hello Aura' },
      ],
    })
  })
})

test('POST /api/chat rejects an empty message with 400', async () => {
  await withServer(async () => { throw new Error('Service must not be called') }, async (url) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: '  ' }),
    })
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { error: 'A non-empty message is required.' })
  })
})

test('POST /api/chat hides internal errors from users', async () => {
  await withServer(async () => { throw new Error('sensitive internal detail') }, async (url) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Hi' }),
    })
    assert.equal(response.status, 502)
    const responseText = await response.text()
    assert.match(responseText, /temporarily unavailable/)
    assert.doesNotMatch(responseText, /sensitive internal detail|stack|GEMINI_API_KEY/)
  })
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
if (process.exitCode !== 1) console.log(`All ${cases.length} chat route tests passed.`)
