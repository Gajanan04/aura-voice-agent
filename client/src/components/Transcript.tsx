import { useEffect, useRef } from 'react'
import type { CallState, TranscriptMessage } from '../App'

interface TranscriptProps {
  readonly messages: readonly TranscriptMessage[]
  readonly state: CallState
}

const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

export function Transcript({ messages, state }: TranscriptProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, state])

  return (
    <section className="transcript-section" aria-label="Live transcript" aria-live="polite">
      <div className="section-heading transcript-heading">
        <div><h2>Live transcript</h2><p>Customer and Aria messages appear here in order.</p></div>
        <span className="message-count">{messages.length} messages</span>
      </div>
      <div className="transcript-list">
        {messages.length === 0 ? (
          <div className="transcript-empty">
            <div className="empty-icon" aria-hidden="true">✳</div>
            <p>{state === 'IDLE' || state === 'ENDED' ? 'Start a call to begin your conversation.' : 'Your conversation will appear here.'}</p>
            <span>Use the test orders panel to try a sample question.</span>
          </div>
        ) : messages.map((message) => (
          <article className={`transcript-message message-${message.speaker}`} key={message.id}>
            <div className="message-avatar" aria-hidden="true">{message.speaker === 'aria' ? 'A' : 'Y'}</div>
            <div className="message-body">
              <div className="message-meta">
                <strong>{message.speaker === 'aria' ? 'Aria' : 'Customer'}</strong>
                <time dateTime={message.timestamp.toISOString()}>{timeFormatter.format(message.timestamp)}</time>
              </div>
              <p>{message.text}</p>
            </div>
          </article>
        ))}
        {state === 'THINKING' && <div className="thinking-row" role="status"><span className="thinking-dots"><i /><i /><i /></span>Aria is thinking…</div>}
        <div ref={bottomRef} />
      </div>
    </section>
  )
}
