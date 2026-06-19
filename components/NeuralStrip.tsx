'use client'

import { useState } from 'react'

interface NeuralMsg {
  id: string
  role: string
  content: string
}

interface NeuralStripProps {
  messages: NeuralMsg[]
  facultyColor: string
  onEditMessage: (id: string, content: string) => void
  onOpenTranscript?: () => void
}

export function NeuralStrip({ messages, facultyColor, onEditMessage, onOpenTranscript }: NeuralStripProps) {
  const [hovered, setHovered] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const recent = messages.slice(-5)
  if (recent.length === 0) return null

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setEditingId(null) }}
      onClick={!hovered ? onOpenTranscript : undefined}
      style={{ marginBottom: '8px', cursor: !hovered ? 'pointer' : 'default' }}
    >
      {!hovered && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}>
          {recent.map((m, i) => (
            <div key={m.id} style={{
              width: '4px', height: '4px', borderRadius: '50%',
              background: m.role === 'assistant' ? facultyColor : 'rgba(255,255,255,0.3)',
              opacity: 0.3 + (i / recent.length) * 0.7,
            }} />
          ))}
        </div>
      )}

      {hovered && (
        <div style={{
          background: 'rgba(0,0,0,0.85)',
          border: `1px solid ${facultyColor}22`,
          borderRadius: '10px',
          padding: '8px',
          marginBottom: '6px',
          backdropFilter: 'blur(8px)',
          maxHeight: '160px',
          overflowY: 'auto',
          scrollbarWidth: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}>
          {recent.map(m => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
              <div style={{
                width: '4px', height: '4px', borderRadius: '50%', flexShrink: 0,
                background: m.role === 'assistant' ? facultyColor : 'rgba(255,255,255,0.4)',
                marginTop: '5px',
              }} />
              {editingId === m.id ? (
                <textarea
                  autoFocus
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onBlur={() => { onEditMessage(m.id, editText); setEditingId(null) }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      onEditMessage(m.id, editText)
                      setEditingId(null)
                    }
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.06)',
                    border: `1px solid ${facultyColor}44`, borderRadius: '6px',
                    color: 'rgba(255,255,255,0.8)', fontSize: '10px',
                    fontFamily: 'system-ui', padding: '3px 6px',
                    outline: 'none', resize: 'none', lineHeight: '1.4',
                  }}
                  rows={2}
                />
              ) : (
                <div
                  onClick={() => { setEditingId(m.id); setEditText(m.content) }}
                  style={{
                    flex: 1, fontSize: '10px', lineHeight: '1.4',
                    color: m.role === 'assistant' ? 'rgba(255,225,195,0.65)' : 'rgba(255,255,255,0.45)',
                    fontFamily: 'system-ui', cursor: 'text',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical' as const,
                  }}
                >
                  {m.content}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
