interface CallControlsProps {
  readonly active: boolean
  readonly busy: boolean
  readonly recording: boolean
  readonly startingMicrophone: boolean
  readonly onStart: () => void
  readonly onEnd: () => void
  readonly onToggleListening: () => void
}

export function CallControls({ active, busy, recording, startingMicrophone, onStart, onEnd, onToggleListening }: CallControlsProps) {
  return (
    <div className="call-controls">
      <button className="button button-primary" type="button" onClick={onStart} disabled={active || busy}>
        <span className="button-icon" aria-hidden="true">▶</span>Start Call
      </button>
      <button className="button button-secondary" type="button" onClick={onEnd} disabled={!active}>
        <span className="end-indicator" aria-hidden="true" />End Call
      </button>
      <button className={`button ${recording ? 'button-recording' : 'button-microphone'}`} type="button" onClick={onToggleListening} disabled={!active || busy || startingMicrophone}>
        <span className="microphone-icon" aria-hidden="true">{recording ? '■' : '●'}</span>
        {startingMicrophone ? 'Connecting to Aria…' : recording ? 'Pause Listening' : 'Resume Listening'}
      </button>
      {busy && <span className="processing-caption">Please wait while Aria responds…</span>}
    </div>
  )
}
