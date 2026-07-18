'use client'
import React, { useState } from 'react'
import { SITE_VERSIONS, CURRENT_VERSION } from '@/lib/versions'

export default function VersionPanel() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Version badge — bottom-left, site-wide */}
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          bottom: '18px',
          left: '18px',
          zIndex: 9000,
          background: 'rgba(6, 10, 28, 0.72)',
          border: '1px solid rgba(55, 90, 200, 0.28)',
          borderRadius: '6px',
          padding: '5px 11px',
          cursor: 'pointer',
          fontFamily: 'var(--font-vyan)',
          fontSize: '10px',
          letterSpacing: '0.20em',
          color: 'rgba(90, 150, 255, 0.55)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          transition: 'color 0.25s, border-color 0.25s, background 0.25s',
          lineHeight: 1,
        }}
        onMouseEnter={e => {
          const b = e.currentTarget as HTMLButtonElement
          b.style.color = 'rgba(150, 200, 255, 0.95)'
          b.style.borderColor = 'rgba(80, 140, 255, 0.55)'
          b.style.background = 'rgba(10, 18, 50, 0.90)'
        }}
        onMouseLeave={e => {
          const b = e.currentTarget as HTMLButtonElement
          b.style.color = 'rgba(90, 150, 255, 0.55)'
          b.style.borderColor = 'rgba(55, 90, 200, 0.28)'
          b.style.background = 'rgba(6, 10, 28, 0.72)'
        }}
        aria-label="Open version history"
      >
        v{CURRENT_VERSION}
      </button>

      {/* History panel overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(3, 5, 18, 0.85)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'rgba(7, 11, 32, 0.97)',
              border: '1px solid rgba(55, 90, 200, 0.22)',
              borderRadius: '18px',
              width: '100%',
              maxWidth: '660px',
              maxHeight: '82vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 0 60px rgba(30, 70, 200, 0.18), 0 0 120px rgba(10, 30, 100, 0.22)',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '26px 30px 18px',
              borderBottom: '1px solid rgba(55, 90, 200, 0.14)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{
                  fontFamily: 'var(--font-vyan)',
                  fontSize: '10px',
                  letterSpacing: '0.26em',
                  color: 'rgba(70, 130, 255, 0.65)',
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                }}>VYAN · THE MANIFESTATIONS</div>
                <div style={{
                  fontFamily: 'var(--font-vyan)',
                  fontSize: '22px',
                  letterSpacing: '0.14em',
                  color: 'rgba(210, 225, 255, 0.95)',
                  fontWeight: 600,
                }}>VERSION HISTORY</div>
                <div style={{
                  fontFamily: 'var(--font-vyan)',
                  fontSize: '11px',
                  letterSpacing: '0.10em',
                  color: 'rgba(90, 120, 200, 0.50)',
                  marginTop: '4px',
                }}>click any version · share git hash to restore</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: 'none',
                  border: '1px solid rgba(55, 90, 200, 0.22)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: 'rgba(90, 140, 255, 0.55)',
                  fontSize: '16px',
                  lineHeight: 1,
                  padding: '7px 10px',
                  fontFamily: 'var(--font-vyan)',
                  transition: 'color 0.2s, border-color 0.2s',
                }}
                onMouseEnter={e => {
                  const b = e.currentTarget as HTMLButtonElement
                  b.style.color = 'rgba(150, 190, 255, 0.90)'
                  b.style.borderColor = 'rgba(80, 140, 255, 0.50)'
                }}
                onMouseLeave={e => {
                  const b = e.currentTarget as HTMLButtonElement
                  b.style.color = 'rgba(90, 140, 255, 0.55)'
                  b.style.borderColor = 'rgba(55, 90, 200, 0.22)'
                }}
              >✕</button>
            </div>

            {/* Version list */}
            <div style={{ overflowY: 'auto', padding: '20px 30px 32px', flex: 1 }}>
              {SITE_VERSIONS.map((v, idx) => {
                const isCurrent = v.version === CURRENT_VERSION
                return (
                  <div
                    key={v.version}
                    style={{
                      marginBottom: idx < SITE_VERSIONS.length - 1 ? '24px' : 0,
                      paddingBottom: idx < SITE_VERSIONS.length - 1 ? '24px' : 0,
                      borderBottom: idx < SITE_VERSIONS.length - 1
                        ? '1px solid rgba(55, 90, 200, 0.10)'
                        : 'none',
                    }}
                  >
                    {/* Version number row */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      marginBottom: '6px',
                      flexWrap: 'wrap',
                    }}>
                      <span style={{
                        fontFamily: 'var(--font-vyan)',
                        fontSize: isCurrent ? '20px' : '15px',
                        letterSpacing: '0.14em',
                        color: isCurrent ? '#5599ff' : 'rgba(80, 120, 220, 0.55)',
                        fontWeight: isCurrent ? 700 : 400,
                      }}>v{v.version}</span>

                      {isCurrent && (
                        <span style={{
                          fontFamily: 'var(--font-vyan)',
                          fontSize: '9px',
                          letterSpacing: '0.20em',
                          color: 'rgba(60, 200, 110, 0.85)',
                          background: 'rgba(30, 110, 55, 0.18)',
                          border: '1px solid rgba(50, 170, 80, 0.30)',
                          borderRadius: '4px',
                          padding: '2px 8px',
                        }}>CURRENT</span>
                      )}

                      <span style={{
                        fontFamily: 'var(--font-vyan)',
                        fontSize: '10px',
                        letterSpacing: '0.12em',
                        color: 'rgba(80, 110, 180, 0.45)',
                        marginLeft: 'auto',
                      }}>{v.date}</span>
                    </div>

                    {/* Title */}
                    <div style={{
                      fontFamily: 'var(--font-vyan)',
                      fontSize: '13px',
                      letterSpacing: '0.09em',
                      color: isCurrent ? 'rgba(185, 210, 255, 0.92)' : 'rgba(120, 155, 220, 0.65)',
                      marginBottom: '5px',
                      fontWeight: isCurrent ? 600 : 400,
                    }}>{v.title}</div>

                    {/* Summary */}
                    <div style={{
                      fontFamily: 'var(--font-vyan)',
                      fontSize: '11px',
                      letterSpacing: '0.06em',
                      color: 'rgba(100, 130, 190, 0.50)',
                      marginBottom: '12px',
                      lineHeight: 1.55,
                    }}>{v.summary}</div>

                    {/* Change list */}
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                      {v.changes.map((c, ci) => (
                        <li key={ci} style={{
                          fontFamily: 'var(--font-vyan)',
                          fontSize: '11px',
                          letterSpacing: '0.06em',
                          color: isCurrent ? 'rgba(150, 180, 255, 0.72)' : 'rgba(100, 130, 195, 0.44)',
                          lineHeight: '1.65',
                          paddingLeft: '16px',
                          position: 'relative',
                        }}>
                          <span style={{
                            position: 'absolute',
                            left: 0,
                            color: isCurrent ? 'rgba(70, 130, 255, 0.75)' : 'rgba(50, 90, 180, 0.38)',
                          }}>·</span>
                          {c}
                        </li>
                      ))}
                    </ul>

                    {/* Footer meta */}
                    <div style={{
                      marginTop: '10px',
                      display: 'flex',
                      gap: '16px',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}>
                      <span style={{
                        fontFamily: 'monospace',
                        fontSize: '10px',
                        color: 'rgba(60, 90, 160, 0.40)',
                        letterSpacing: '0.06em',
                      }}>git: {v.gitHash}</span>
                      <span style={{
                        fontFamily: 'var(--font-vyan)',
                        fontSize: '10px',
                        letterSpacing: '0.10em',
                        color: 'rgba(60, 90, 160, 0.38)',
                      }}>{v.pages.join(' · ')}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
