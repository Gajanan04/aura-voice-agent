import type { FormEvent, KeyboardEvent } from 'react'

interface ChatInputProps {
  readonly value: string
  readonly disabled: boolean
  readonly onChange: (value: string) => void
  readonly onSubmit: () => void
}

export function ChatInput({ value, disabled, onChange, onSubmit }: ChatInputProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      onSubmit()
    }
  }

  return (
    <form className="chat-composer" onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor="chat-message">Your message to Aria</label>
      <textarea
        id="chat-message" value={value} onChange={(event) => onChange(event.target.value)}
        placeholder={disabled ? 'Start a call to message Aria' : 'Type a message to Aria…'}
        rows={2} maxLength={2000} disabled={disabled} onKeyDown={handleKeyDown}
      />
      <div className="composer-bottom">
        <span>Text testing · Enter to send · Shift + Enter for a new line</span>
        <button className="send-button" type="submit" disabled={disabled || value.trim().length === 0}>
          Send <span aria-hidden="true">↗</span>
        </button>
      </div>
    </form>
  )
}
