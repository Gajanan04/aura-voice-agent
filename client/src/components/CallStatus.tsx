import type { CallState } from '../App'

const labels: Record<CallState, string> = {
  IDLE: 'Idle', CONNECTING: 'Connecting', READY: 'Ready for message', LISTENING: 'Listening', THINKING: 'Thinking', SPEAKING: 'Speaking', ENDED: 'Ended',
}

export function CallStatus({ state, recording = false }: { readonly state: CallState; readonly recording?: boolean }) {
  return (
    <div className={`call-status status-${state.toLowerCase()}${recording ? ' status-recording' : ''}`} role="status" aria-live="polite">
      <span className="status-indicator" aria-hidden="true" />{labels[state]}
      {recording && <span className="mic-live-label">· Microphone active</span>}
    </div>
  )
}
