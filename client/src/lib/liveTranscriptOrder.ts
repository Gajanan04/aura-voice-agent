export interface LiveTranscriptTurn {
  readonly speaker: 'customer' | 'aria'
  readonly text: string
  readonly isFinal: boolean
}

function appendText(current: string, next: string): string {
  const clean = next.trim()
  if (!clean) return current
  return [current.trim(), clean].filter(Boolean).join(' ')
}

/** Orders independent Gemini Live transcription events by finalized turn state. */
export class LiveTranscriptOrder {
  private pendingCustomerText = ''
  private pendingAriaText = ''
  private customerTurnOpen = false
  private modelTurnComplete = false
  private ariaMayBeCommitted = true
  private lastCustomerFinal = ''

  constructor(private readonly onTranscript: (turn: LiveTranscriptTurn) => void) {}

  reset(allowInitialAria = true): void {
    this.pendingCustomerText = ''
    this.pendingAriaText = ''
    this.customerTurnOpen = false
    this.modelTurnComplete = false
    this.ariaMayBeCommitted = allowInitialAria
    this.lastCustomerFinal = ''
  }

  customerActivityStarted(): void {
    if (this.customerTurnOpen) return
    this.customerTurnOpen = true
    this.pendingCustomerText = ''
    if (!this.pendingAriaText) this.modelTurnComplete = false
    this.lastCustomerFinal = ''
    this.ariaMayBeCommitted = false
  }

  customerInterim(text: string): void {
    const clean = text.trim()
    if (!clean) return
    this.customerActivityStarted()
    const visibleText = appendText(this.pendingCustomerText, clean)
    this.onTranscript({ speaker: 'customer', text: visibleText, isFinal: false })
  }

  customerFinal(text: string): void {
    const clean = text.trim()
    if (!this.customerTurnOpen && clean && clean === this.lastCustomerFinal) return
    this.customerActivityStarted()
    if (clean) this.pendingCustomerText = appendText(this.pendingCustomerText, clean)
    const customer = this.pendingCustomerText.trim()
    if (customer) this.onTranscript({ speaker: 'customer', text: customer, isFinal: true })
    this.pendingCustomerText = ''
    this.customerTurnOpen = false
    this.lastCustomerFinal = clean
    this.ariaMayBeCommitted = true
    this.publishPendingAria()
  }

  customerTextAlreadyCommitted(): void {
    this.customerTurnOpen = false
    this.pendingCustomerText = ''
    this.lastCustomerFinal = ''
    this.modelTurnComplete = false
    this.ariaMayBeCommitted = true
  }

  ariaTranscript(text: string): void {
    const clean = text.trim()
    if (!clean) return
    this.pendingAriaText = appendText(this.pendingAriaText, clean)
    if (this.ariaMayBeCommitted) {
      this.onTranscript({ speaker: 'aria', text: this.pendingAriaText, isFinal: false })
    }
  }

  modelTurnFinished(): void {
    this.modelTurnComplete = true
    this.publishPendingAria()
  }

  finishCall(): void {
    const customer = this.pendingCustomerText.trim()
    if (customer) this.onTranscript({ speaker: 'customer', text: customer, isFinal: true })
    this.pendingCustomerText = ''
    this.customerTurnOpen = false
    const aria = this.pendingAriaText.trim()
    if (aria) this.onTranscript({ speaker: 'aria', text: aria, isFinal: true })
    this.pendingAriaText = ''
    this.modelTurnComplete = false
    this.ariaMayBeCommitted = false
  }

  private publishPendingAria(): void {
    if (!this.ariaMayBeCommitted) return
    const aria = this.pendingAriaText.trim()
    if (!aria) return
    if (this.modelTurnComplete) {
      this.onTranscript({ speaker: 'aria', text: aria, isFinal: true })
      this.pendingAriaText = ''
      this.modelTurnComplete = false
      this.ariaMayBeCommitted = false
      return
    }
    this.onTranscript({ speaker: 'aria', text: aria, isFinal: false })
  }
}
