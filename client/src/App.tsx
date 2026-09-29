import { useRef, useState } from 'react'
import { CallControls } from './components/CallControls'
import { CallStatus } from './components/CallStatus'
import { CallSummary } from './components/CallSummary'
import { ChatInput } from './components/ChatInput'
import { TestOrders } from './components/TestOrders'
import { Transcript } from './components/Transcript'
import { useGeminiLive } from './hooks/useGeminiLive'
import type { GeminiCallState } from './hooks/useGeminiLive'
import { createCallOutcome } from './lib/callOutcome'
import type { CallOutcome } from './lib/callOutcome'
import type { ChatToolCall } from './lib/chat'

export type CallState = GeminiCallState

export interface TranscriptMessage {
  readonly id: number
  readonly speaker: 'customer' | 'aria'
  readonly text: string
  readonly timestamp: Date
  readonly isPartial?: boolean
}

export default function App() {
  const [callState, setCallState] = useState<CallState>('IDLE')
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([])
  const [toolCalls, setToolCalls] = useState<ChatToolCall[]>([])
  const [summary, setSummary] = useState<CallOutcome | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const submissionLock = useRef(false)
  const nextMessageId = useRef(1)
  const transcriptRef = useRef<TranscriptMessage[]>([])
  const toolCallsRef = useRef<ChatToolCall[]>([])
  const live = useGeminiLive({
    onTranscript: (turn) => {
      let partialIndex = -1
      for (let index = transcriptRef.current.length - 1; index >= 0; index -= 1) {
        const message = transcriptRef.current[index]
        if (message?.speaker === turn.speaker && message.isPartial) { partialIndex = index; break }
      }
      if (partialIndex >= 0) {
        const partial = transcriptRef.current[partialIndex]
        if (partial) {
          const updated = [...transcriptRef.current]
          updated[partialIndex] = { ...partial, text: turn.text, isPartial: !turn.isFinal }
          transcriptRef.current = updated
        }
      } else {
        transcriptRef.current = [...transcriptRef.current, {
          id: nextMessageId.current++, speaker: turn.speaker, text: turn.text,
          timestamp: new Date(), isPartial: !turn.isFinal,
        }]
      }
      setTranscript(transcriptRef.current)
    },
    onToolCall: (call) => {
      toolCallsRef.current = [...toolCallsRef.current, call]
      setToolCalls(toolCallsRef.current)
    },
    onStateChange: (state) => {
      setCallState(state)
      if (state === 'ENDED') setSummary(createCallOutcome(transcriptRef.current, toolCallsRef.current))
    },
  })
  const callActive = callState === 'CONNECTING' || callState === 'READY' || callState === 'LISTENING' || callState === 'THINKING' || callState === 'SPEAKING'

  function startCall() {
    if (submissionLock.current) return
    transcriptRef.current = []
    toolCallsRef.current = []
    setTranscript([])
    setToolCalls([])
    setSummary(null)
    setError(null)
    nextMessageId.current = 1
    void live.startCall()
  }

  function endCall() {
    if (!callActive) return
    live.endCall()
    setSummary(createCallOutcome(transcriptRef.current, toolCallsRef.current))
    setError(null)
    setCallState('ENDED')
  }

  function submitMessage() {
    const message = draft.trim()
    if (!message) {
      setError('Type a message before sending.')
      return
    }
    if ((callState !== 'LISTENING' && callState !== 'READY') || submissionLock.current) return

    submissionLock.current = true
    setIsSending(true)
    setError(null)
    transcriptRef.current = [...transcriptRef.current, {
      id: nextMessageId.current++, speaker: 'customer', text: message, timestamp: new Date(),
    }]
    setTranscript(transcriptRef.current)
    setDraft('')
    live.sendText(message)
    submissionLock.current = false
    setIsSending(false)
  }

  async function toggleListening() {
    if (!callActive || isSending || live.isStarting) return
    setError(null)
    await live.toggleMicrophone()
  }

  function useExample(question: string) {
    setDraft(question)
    if (callState === 'IDLE' || callState === 'ENDED') setError('Start a call to send a test message.')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">A</div>
          <div><p className="brand-name">Aura Skincare</p><p className="brand-subtitle">AI Customer Support · Aria</p></div>
        </div>
        <div className="mode-badge"><span className="mode-dot" />Voice + text test</div>
      </header>

      <main className="dashboard">
        <section className="conversation-panel panel" aria-label="Customer conversation">
          <div className="conversation-heading">
            <div>
              <p className="eyebrow">CUSTOMER CARE</p>
              <h1>Talk with Aria</h1>
              <p className="section-copy">Speak a turn or type a message to test Aura’s customer support agent.</p>
            </div>
          <CallStatus state={callState} recording={live.isMicrophoneOn} />
        </div>
        <CallControls
          active={callActive} busy={isSending} recording={live.isMicrophoneOn} startingMicrophone={live.isStarting}
          onStart={startCall} onEnd={endCall} onToggleListening={() => { void toggleListening() }}
        />
        <div className="text-mode-note"><span aria-hidden="true">ⓘ</span>Gemini Live listens and responds in real time. You can pause the microphone or type a message at any time.</div>
        <Transcript messages={transcript} state={callState} />
        {(error || live.error) && <p className="inline-error" role="alert">{error ?? live.error}</p>}
        <ChatInput value={draft} disabled={(callState !== 'LISTENING' && callState !== 'READY') || isSending || live.isStarting} onChange={setDraft} onSubmit={submitMessage} />
        </section>

        <aside className="sidebar" aria-label="Call details and test data">
          <TestOrders onSelect={useExample} disabled={isSending} />
          <CallSummary summary={summary} transcriptCount={transcript.length} toolCallCount={toolCalls.length} />
        </aside>
      </main>
      <footer className="page-footer">Aura Skincare support · Assessment test environment</footer>
    </div>
  )
}
