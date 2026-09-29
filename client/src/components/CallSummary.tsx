import type { CallOutcome } from '../lib/callOutcome'

interface CallSummaryProps {
  readonly summary: CallOutcome | null
  readonly transcriptCount: number
  readonly toolCallCount: number
}

export function CallSummary({ summary, transcriptCount, toolCallCount }: CallSummaryProps) {
  return (
    <section className="panel summary-panel">
      <div className="section-heading">
        <div><p className="eyebrow">AFTER THE CALL</p><h2>Call log &amp; summary</h2></div>
        <span className="summary-icon" aria-hidden="true">⌁</span>
      </div>
      {!summary ? (
        <div className="summary-placeholder">
          <p>End the call to create a structured outcome.</p>
          <div className="summary-stats">
            <span><strong>{transcriptCount}</strong> transcript messages</span>
            <span><strong>{toolCallCount}</strong> order lookups</span>
          </div>
        </div>
      ) : (
        <>
          <div className="summary-stats summary-stats-ready">
            <span><strong>{transcriptCount}</strong> transcript messages</span>
            <span><strong>{toolCallCount}</strong> order lookups</span>
          </div>
          <p className="json-label">Structured call outcome</p>
          <pre className="summary-json">{JSON.stringify(summary, null, 2)}</pre>
          <p className="summary-footnote">Generated from this browser session’s transcript and tool results.</p>
        </>
      )}
    </section>
  )
}
