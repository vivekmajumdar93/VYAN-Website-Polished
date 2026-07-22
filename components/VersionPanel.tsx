'use client'
import React, { useState, useRef, useCallback } from 'react'
import { SITE_VERSIONS, CURRENT_VERSION } from '@/lib/versions'

export default function VersionPanel() {
  const [open, setOpen]         = useState(false)
  // Which version rows have their change-list expanded; current starts open
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([CURRENT_VERSION]))
  const touchStartY    = useRef(0)
  const scrollRef      = useRef<HTMLDivElement>(null)
  const scrollTouchY   = useRef(0)
  const scrollTouchTop = useRef(0)

  const close = useCallback(() => setOpen(false), [])

  const toggle = useCallback((version: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(version)) next.delete(version)
      else next.add(version)
      return next
    })
  }, [])

  // Backdrop swipe-down-to-close (only fires on the backdrop, not inside the panel)
  const onBackdropTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }
  const onBackdropTouchEnd = (e: React.TouchEvent) => {
    if (e.changedTouches[0].clientY - touchStartY.current > 72) close()
  }

  return (
    <>
      {/* Version badge */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open version history"
        style={{
          position:'fixed', bottom:'18px', left:'18px', zIndex:9200,
          background:'rgba(6,10,28,0.72)', border:'1px solid rgba(55,90,200,0.28)',
          borderRadius:'6px', padding:'5px 11px', cursor:'pointer',
          fontFamily:'var(--font-vyan)', fontSize:'10px', letterSpacing:'0.20em',
          color:'rgba(90,150,255,0.55)',
          backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)',
          transition:'color 0.25s, border-color 0.25s, background 0.25s',
          lineHeight:1,
        }}
        onMouseEnter={e => { const b=e.currentTarget as HTMLButtonElement; b.style.color='rgba(150,200,255,0.95)'; b.style.borderColor='rgba(80,140,255,0.55)'; b.style.background='rgba(10,18,50,0.90)' }}
        onMouseLeave={e => { const b=e.currentTarget as HTMLButtonElement; b.style.color='rgba(90,150,255,0.55)'; b.style.borderColor='rgba(55,90,200,0.28)'; b.style.background='rgba(6,10,28,0.72)' }}
      >
        v{CURRENT_VERSION}
      </button>

      {/* History panel overlay */}
      {open && (
        <div
          onClick={close}
          onTouchStart={onBackdropTouchStart}
          onTouchEnd={onBackdropTouchEnd}
          style={{
            position:'fixed', inset:0, zIndex:10000,
            background:'rgba(3,5,18,0.85)',
            backdropFilter:'blur(18px)', WebkitBackdropFilter:'blur(18px)',
            display:'flex', alignItems:'center', justifyContent:'center',
            padding:'20px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            // Stop backdrop swipe handler from firing on panel touches
            onTouchStart={e => e.stopPropagation()}
            onTouchEnd={e => e.stopPropagation()}
            style={{
              background:'rgba(7,11,32,0.97)',
              border:'1px solid rgba(55,90,200,0.22)',
              borderRadius:'18px',
              width:'100%', maxWidth:'660px', maxHeight:'82vh',
              overflow:'hidden',
              display:'flex', flexDirection:'column',
              boxShadow:'0 0 60px rgba(30,70,200,0.18), 0 0 120px rgba(10,30,100,0.22)',
            }}
          >
            {/* Drag handle — visual cue for mobile swipe-to-close */}
            <div style={{ display:'flex', justifyContent:'center', padding:'10px 0 4px', flexShrink:0 }}>
              <div style={{ width:'36px', height:'3px', borderRadius:'2px', background:'rgba(80,120,255,0.22)' }} />
            </div>

            {/* Header */}
            <div style={{
              padding:'14px 30px 16px', borderBottom:'1px solid rgba(55,90,200,0.14)',
              display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexShrink:0,
            }}>
              <div>
                <div style={{ fontFamily:'var(--font-vyan)', fontSize:'10px', letterSpacing:'0.26em', color:'rgba(70,130,255,0.65)', marginBottom:'6px', textTransform:'uppercase' }}>
                  VYAN · THE MANIFESTATIONS
                </div>
                <div style={{ fontFamily:'var(--font-vyan)', fontSize:'22px', letterSpacing:'0.14em', color:'rgba(210,225,255,0.95)', fontWeight:600 }}>
                  VERSION HISTORY
                </div>
                <div style={{ fontFamily:'var(--font-vyan)', fontSize:'11px', letterSpacing:'0.10em', color:'rgba(90,120,200,0.50)', marginTop:'4px' }}>
                  tap version to expand · swipe down to close
                </div>
              </div>
              <button
                onClick={close}
                style={{
                  background:'none', border:'1px solid rgba(55,90,200,0.22)',
                  borderRadius:'8px', cursor:'pointer',
                  color:'rgba(90,140,255,0.55)', fontSize:'16px', lineHeight:1,
                  padding:'7px 10px', fontFamily:'var(--font-vyan)',
                  transition:'color 0.2s, border-color 0.2s',
                }}
                onMouseEnter={e => { const b=e.currentTarget as HTMLButtonElement; b.style.color='rgba(150,190,255,0.90)'; b.style.borderColor='rgba(80,140,255,0.50)' }}
                onMouseLeave={e => { const b=e.currentTarget as HTMLButtonElement; b.style.color='rgba(90,140,255,0.55)'; b.style.borderColor='rgba(55,90,200,0.22)' }}
              >✕</button>
            </div>

            {/* Version list — JS touch scroll because global touch-action:none prevents CSS override */}
            <div
              ref={scrollRef}
              style={{
                overflowY:'auto', flex:1,
                padding:'16px 30px 32px',
                userSelect:'text', WebkitUserSelect:'text',
              }}
              onTouchStart={e => {
                e.stopPropagation()
                scrollTouchY.current   = e.touches[0].clientY
                scrollTouchTop.current = scrollRef.current?.scrollTop ?? 0
              }}
              onTouchMove={e => {
                e.stopPropagation()
                if (!scrollRef.current) return
                scrollRef.current.scrollTop = scrollTouchTop.current + (scrollTouchY.current - e.touches[0].clientY)
              }}
            >
              {SITE_VERSIONS.map((v, idx) => {
                const isCurrent  = v.version === CURRENT_VERSION
                const isExpanded = expanded.has(v.version)
                const isLast     = idx === SITE_VERSIONS.length - 1

                return (
                  <div
                    key={v.version}
                    style={{
                      marginBottom: isLast ? 0 : '20px',
                      paddingBottom: isLast ? 0 : '20px',
                      borderBottom: isLast ? 'none' : '1px solid rgba(55,90,200,0.10)',
                    }}
                  >
                    {/* Clickable row — toggles change list */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => toggle(v.version)}
                      onKeyDown={e => e.key === 'Enter' && toggle(v.version)}
                      style={{
                        display:'flex', alignItems:'center', gap:'10px',
                        marginBottom:'5px', flexWrap:'wrap',
                        cursor:'pointer', borderRadius:'6px',
                        padding:'4px 6px', margin:'-4px -6px 5px',
                        transition:'background 0.15s',
                        userSelect:'none', WebkitUserSelect:'none',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(60,100,220,0.08)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                    >
                      <span style={{
                        fontFamily:'var(--font-vyan)',
                        fontSize: isCurrent ? '20px' : '15px',
                        letterSpacing:'0.14em',
                        color: isCurrent ? '#5599ff' : 'rgba(80,120,220,0.55)',
                        fontWeight: isCurrent ? 700 : 400,
                      }}>v{v.version}</span>

                      {isCurrent && (
                        <span style={{
                          fontFamily:'var(--font-vyan)', fontSize:'9px', letterSpacing:'0.20em',
                          color:'rgba(60,200,110,0.85)', background:'rgba(30,110,55,0.18)',
                          border:'1px solid rgba(50,170,80,0.30)', borderRadius:'4px', padding:'2px 8px',
                        }}>CURRENT</span>
                      )}

                      <span style={{
                        fontFamily:'var(--font-vyan)', fontSize:'10px', letterSpacing:'0.12em',
                        color:'rgba(80,110,180,0.45)', marginLeft:'auto',
                      }}>{v.date}</span>

                      {/* Expand/collapse chevron */}
                      <span style={{
                        fontSize:'10px', color:'rgba(70,110,220,0.40)',
                        transition:'transform 0.25s',
                        display:'inline-block',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        lineHeight:1,
                      }}>▾</span>
                    </div>

                    {/* Title */}
                    <div style={{
                      fontFamily:'var(--font-vyan)', fontSize:'13px', letterSpacing:'0.09em',
                      color: isCurrent ? 'rgba(185,210,255,0.92)' : 'rgba(120,155,220,0.65)',
                      marginBottom:'4px', fontWeight: isCurrent ? 600 : 400,
                    }}>{v.title}</div>

                    {/* Summary — always visible */}
                    <div style={{
                      fontFamily:'var(--font-vyan)', fontSize:'11px', letterSpacing:'0.06em',
                      color:'rgba(100,130,190,0.50)', lineHeight:1.55,
                      marginBottom: isExpanded ? '10px' : '8px',
                    }}>{v.summary}</div>

                    {/* Change list — collapsible via max-height */}
                    <div style={{
                      maxHeight: isExpanded ? '1200px' : '0',
                      overflow:'hidden',
                      transition:'max-height 0.32s cubic-bezier(0.4,0,0.2,1)',
                    }}>
                      <ul style={{ margin:'0 0 10px', padding:0, listStyle:'none' }}>
                        {v.changes.map((c, ci) => (
                          <li key={ci} style={{
                            fontFamily:'var(--font-vyan)', fontSize:'11px', letterSpacing:'0.06em',
                            color: isCurrent ? 'rgba(150,180,255,0.72)' : 'rgba(100,130,195,0.44)',
                            lineHeight:'1.65', paddingLeft:'16px', position:'relative',
                          }}>
                            <span style={{
                              position:'absolute', left:0,
                              color: isCurrent ? 'rgba(70,130,255,0.75)' : 'rgba(50,90,180,0.38)',
                            }}>·</span>
                            {c}
                          </li>
                        ))}
                      </ul>

                      {/* Footer meta — only in expanded state */}
                      <div style={{ display:'flex', gap:'16px', alignItems:'center', flexWrap:'wrap' }}>
                        <span style={{
                          fontFamily:'monospace', fontSize:'10px',
                          color:'rgba(60,90,160,0.40)', letterSpacing:'0.06em',
                          userSelect:'text', WebkitUserSelect:'text',
                        }}>git: {v.gitHash}</span>
                        <span style={{
                          fontFamily:'var(--font-vyan)', fontSize:'10px', letterSpacing:'0.10em',
                          color:'rgba(60,90,160,0.38)',
                        }}>{v.pages.join(' · ')}</span>
                      </div>
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
