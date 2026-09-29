import assert from 'node:assert/strict'
import { LiveTranscriptOrder } from '../test-dist/lib/liveTranscriptOrder.js'

function harness() {
  const messages = []
  const order = new LiveTranscriptOrder((turn) => {
    let partialIndex = -1
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index]?.speaker === turn.speaker && !messages[index]?.isFinal) {
        partialIndex = index
        break
      }
    }
    if (partialIndex >= 0) messages[partialIndex] = { ...messages[partialIndex], ...turn }
    else messages.push({ ...turn })
  })
  return { messages, order }
}

function visible(messages) {
  return messages.map(({ speaker, text }) => ({ speaker, text }))
}

function check(name, run) {
  run()
  console.log(`✓ ${name}`)
}

check('commits the customer before Aria for one turn', () => {
  const { messages, order } = harness()
  order.customerFinal('Hi Aria, how are you?')
  order.ariaTranscript("I'm fine.")
  order.modelTurnFinished()
  assert.deepEqual(visible(messages), [
    { speaker: 'customer', text: 'Hi Aria, how are you?' },
    { speaker: 'aria', text: "I'm fine." },
  ])
})

check('preserves customer-Aria ordering across consecutive turns', () => {
  const { messages, order } = harness()
  order.customerFinal('Hi Aria, how are you?')
  order.ariaTranscript("I'm fine.")
  order.modelTurnFinished()
  order.customerActivityStarted()
  order.customerFinal('Where is my order ORD-101?')
  order.ariaTranscript('Your order is out for delivery.')
  order.modelTurnFinished()
  assert.deepEqual(visible(messages), [
    { speaker: 'customer', text: 'Hi Aria, how are you?' },
    { speaker: 'aria', text: "I'm fine." },
    { speaker: 'customer', text: 'Where is my order ORD-101?' },
    { speaker: 'aria', text: 'Your order is out for delivery.' },
  ])
})

check('holds Aria when the finalized customer transcription is delayed', () => {
  const { messages, order } = harness()
  order.reset(false)
  order.ariaTranscript("I'm fine.")
  order.modelTurnFinished()
  assert.deepEqual(visible(messages), [])
  order.customerFinal('Hi Aria, how are you?')
  assert.deepEqual(visible(messages), [
    { speaker: 'customer', text: 'Hi Aria, how are you?' },
    { speaker: 'aria', text: "I'm fine." },
  ])
})

check('ignores duplicate final events without duplicating messages', () => {
  const { messages, order } = harness()
  order.customerActivityStarted()
  order.customerFinal('Hi Aria.')
  order.customerFinal('Hi Aria.')
  order.ariaTranscript('Hello.')
  order.modelTurnFinished()
  order.modelTurnFinished()
  assert.deepEqual(visible(messages), [
    { speaker: 'customer', text: 'Hi Aria.' },
    { speaker: 'aria', text: 'Hello.' },
  ])
})

check('resets pending turns between calls', () => {
  const { messages, order } = harness()
  order.customerActivityStarted()
  order.ariaTranscript('Old response.')
  order.modelTurnFinished()
  messages.length = 0
  order.reset()
  order.ariaTranscript('Welcome to Aura Skincare.')
  order.modelTurnFinished()
  assert.deepEqual(visible(messages), [{ speaker: 'aria', text: 'Welcome to Aura Skincare.' }])
})

console.log('All 5 Live transcript ordering tests passed.')
