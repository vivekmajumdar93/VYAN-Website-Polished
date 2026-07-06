'use client'

import { motion, AnimatePresence } from 'framer-motion'

interface StoredChat {
  id: string
  title: string
  messages: { role: string; content: string; ts: number }[]
  createdAt: number
  lastInteractionAt: number
  topic?: string
}

interface ChatHistoryModalProps {
  visible: boolean
  chats: StoredChat[]
  activeChatId: string
  onSelectChat: (id: string) => void
  onDeleteChat: (id: string) => void
  onNewChat: () => void
  onClose: () => void
}

export function ChatHistoryModal({
  visible, chats, activeChatId,
  onSelectChat, onDeleteChat, onNewChat, onClose,
}: ChatHistoryModalProps) {
  const totalMessages = chats.reduce((sum, c) => sum + c.messages.length, 0)

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px',
          }}
        >
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.7)',
              backdropFilter: 'blur(10px)',
            }}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'relative', zIndex: 1,
              width: '100%', maxWidth: '480px',
              maxHeight: '78vh',
              background: 'rgba(0,0,0,0.92)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '20px',
              backdropFilter: 'blur(24px)',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div style={{
              padding: '22px 22px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              flexShrink: 0,
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}>
                <div>
                  <div style={{
                    fontFamily: 'var(--font-vyan)', fontSize: '14px',
                    letterSpacing: '0.3em', color: 'rgba(255,255,255,0.85)',
                    textTransform: 'uppercase', marginBottom: '6px',
                  }}>
                    Conversation Threads
                  </div>
                  <div style={{
                    fontSize: '9px', letterSpacing: '0.2em',
                    color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-vyan)',
                    textTransform: 'uppercase',
                  }}>
                    {chats.length} conversation{chats.length !== 1 ? 's' : ''}
                    {' · '}{totalMessages} messages
                  </div>
                </div>
                <button
                  onClick={onClose}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px', color: 'rgba(255,255,255,0.4)',
                    padding: '6px 10px', cursor: 'pointer', fontSize: '12px',
                  }}
                >✕</button>
              </div>
            </div>

            <div style={{
              flex: 1, overflowY: 'auto',
              scrollbarWidth: 'none', padding: '12px 16px',
              display: 'flex', flexDirection: 'column', gap: '8px',
            }}>
              {chats.length === 0 && (
                <p style={{
                  color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-vyan)',
                  fontSize: '13px', textAlign: 'center', padding: '24px 0',
                }}>
                  No conversations yet.
                </p>
              )}
              {chats.map(chat => {
                const isActive = chat.id === activeChatId
                const date = new Date(chat.lastInteractionAt)
                const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

                return (
                  <div
                    key={chat.id}
                    style={{
                      display: 'flex', gap: '10px', alignItems: 'stretch',
                      padding: '12px 14px',
                      background: isActive
                        ? 'rgba(255,255,255,0.07)'
                        : 'rgba(255,255,255,0.02)',
                      border: isActive
                        ? '1px solid rgba(255,255,255,0.1)'
                        : '1px solid rgba(255,255,255,0.04)',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {isActive && (
                      <div style={{
                        width: '2px', borderRadius: '2px',
                        background: 'rgba(255,200,160,0.5)',
                        flexShrink: 0,
                      }} />
                    )}

                    <div
                      style={{ flex: 1, minWidth: 0 }}
                      onClick={() => { onSelectChat(chat.id); onClose() }}
                    >
                      <div style={{
                        fontSize: '13px', color: 'rgba(255,255,255,0.78)',
                        fontFamily: 'var(--font-vyan)', marginBottom: '4px',
                        overflow: 'hidden', textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {chat.title || 'Untitled'}
                      </div>
                      <div style={{
                        fontSize: '10px', color: 'rgba(255,255,255,0.25)',
                        fontFamily: 'var(--font-vyan)', display: 'flex', gap: '8px',
                      }}>
                        <span>{dateStr} · {timeStr}</span>
                        <span>·</span>
                        <span>{chat.messages.length} msg{chat.messages.length !== 1 ? 's' : ''}</span>
                      </div>
                      {chat.topic && (
                        <div style={{
                          fontSize: '10px', color: 'rgba(255,255,255,0.2)',
                          fontFamily: 'var(--font-vyan)', marginTop: '4px',
                          overflow: 'hidden', textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {chat.topic}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={e => { e.stopPropagation(); onDeleteChat(chat.id) }}
                      style={{
                        background: 'transparent', border: 'none',
                        color: 'rgba(255,255,255,0.15)', cursor: 'pointer',
                        fontSize: '13px', padding: '0 4px', flexShrink: 0,
                        alignSelf: 'center',
                        transition: 'color 0.2s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'rgba(220,80,80,0.6)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.15)')}
                    >
                      ✕
                    </button>
                  </div>
                )
              })}
            </div>

            <div style={{
              padding: '14px 16px',
              borderTop: '1px solid rgba(255,255,255,0.05)',
              flexShrink: 0,
            }}>
              <button
                onClick={() => { onNewChat(); onClose() }}
                style={{
                  width: '100%', padding: '11px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  borderRadius: '10px', color: 'rgba(255,255,255,0.6)',
                  fontSize: '10px', letterSpacing: '0.22em',
                  textTransform: 'uppercase', fontFamily: 'var(--font-vyan)',
                  cursor: 'pointer',
                }}
              >
                + New Conversation
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
