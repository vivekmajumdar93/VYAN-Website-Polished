'use client'
import React, { useState, useRef, useCallback } from 'react'
import { SITE_VERSIONS, CURRENT_VERSION } from '@/lib/versions'

export default function VersionPanel() {
  const [open, setOpen]         = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([CURRENT_VERSION]))
  const scrollRef    = useRef<HTMLDivElement>(null)
  const touchStartY  = useRef(0)
  const listTouchY   = useRef(0)

  const close = useCallback(() => setOpen(false), [])

  const toggle = useCallback((version: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(version)) next.delete(version)
      else next.add(version)
      return next
    })
  }, [])

  // JS touch scroll on the list (touch-action:none is global — CSS overflow alone won't scroll)
  const onListTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation()
    listTouchY.current = e.touches[0].clientY
  }
  const onListTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation()
    const el = scrollRef.current; if (!el) return
    const delta = listTouchY.current - e.touches[0].clientY
    listTouchY.current = e.touches[0].clientY
    el.scrollTop += delta
  }

  // Backdrop: swipe-down > 72 px closes the panel
  const onBackdropTouchStart = (e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY }
  const onBackdropTouchEnd   = (e: React.TouchEvent) => {
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
          color:'rgba(130,180,255,0.80)',
          backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)',
          transition:'color 0.25s, border-color 0.25s, background 0.25s',
          lineHeight:1,
        }}
        onMouseEnter={e => { const b=e.currentTarget as HTMLButtonElement; b.style.color='rgba(190,220,255,1)'; b.style.borderColor='rgba(100,160,255,0.70)'; b.style.background='rgba(10,18,50,0.95)' }}
        onMouseLeave={e => { const b=e.currentTarget as HTMLButtonElement; b.style.color='rgba(130,180,255,0.80)'; b.style.borderColor='rgba(80,130,255,0.35)'; b.style.background='rgba(6,10,28,0.80)' }}
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
            background:'rgba(3,5,18,0.88)',
            backdropFilter:'blur(18px)', WebkitBackdropFilter:'blur(18px)',
            display:'flex', alignItems:'center', justifyContent:'center',
            padding:'20px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            onTouchStart={e => e.stopPropagation()}
            onTouchEnd={e => e.stopPropagation()}
            style={{
              background:'rgba(8,13,36,0.98)',
              border:'1px solid rgba(80,120,255,0.28)',
              borderRadius:'18px',
              width:'100%', maxWidth:'660px', maxHeight:'82vh',
              overflow:'hidden',
              display:'flex', flexDirection:'column',
              boxShadow:'0 0 60px rgba(40,90,220,0.22), 0 0 120px rgba(10,30,100,0.28)',
            }}
          >
            {/* Drag handle */}
            <div style={{ display:'flex', justifyContent:'center', padding:'10px 0 4px', flexShrink:0 }}>
              <div style={{ width:'36px', height:'3px', borderRadius:'2px', background:'rgba(100,150,255,0.30)' }} />
            </div>

            {/* Header */}
            <div style={{
              padding:'14px 30px 16px', borderBottom:'1px solid rgba(80,120,255,0.18)',
              display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexShrink:0,
            }}>
              <div>
                <div style={{ fontFamily:'var(--font-vyan)', fontSize:'10px', letterSpacing:'0.26em', color:'rgba(110,165,255,0.80)', marginBottom:'6px', textTransform:'uppercase' }}>
                  VYAN · THE MANIFESTATIONS
                </div>
                <div style={{ fontFamily:'var(--font-vyan)', fontSize:'22px', letterSpacing:'0.14em', color:'rgba(220,235,255,0.98)', fontWeight:600 }}>
                  VERSION HISTORY
                </div>
                <div style={{ fontFamily:'var(--font-vyan)', fontSize:'11px', letterSpacing:'0.10em', color:'rgba(140,165,225,0.70)', marginTop:'4px' }}>
                  Tap version to expand · swipe down to close
                </div>
              </div>
              <button
                onClick={close}
                style={{
                  background:'none', border:'1px solid rgba(80,120,255,0.30)',
                  borderRadius:'8px', cursor:'pointer',
                  color:'rgba(130,175,255,0.80)', fontSize:'16px', lineHeight:1,
                  padding:'7px 10px', fontFamily:'var(--font-vyan)',
                  transition:'color 0.2s, border-color 0.2s',
                }}
                onMouseEnter={e => { const b=e.currentTarget as HTMLButtonElement; b.style.color='rgba(200,220,255,1)'; b.style.borderColor='rgba(120,170,255,0.65)' }}
                onMouseLeave={e => { const b=e.currentTarget as HTMLButtonElement; b.style.color='rgba(130,175,255,0.80)'; b.style.borderColor='rgba(80,120,255,0.30)' }}
              >✕</button>
            </div>

            {/* Version list — scroll container */}
            <div
              ref={scrollRef}
              onTouchStart={onListTouchStart}
              onTouchMove={onListTouchMove}
              style={{
                overflowY:'auto', flex:1,
                padding:'16px 30px 32px',
                userSelect:'text', WebkitUserSelect:'text',
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
                      borderBottom: isLast ? 'none' : '1px solid rgba(80,120,255,0.14)',
                    }}
                  >
                    {/* Clickable row */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => toggle(v.version)}
                      onKeyDown={e => e.key === 'Enter' && toggle(v.version)}
                      style={{
                        display:'flex', alignItems:'center', gap:'10px',
                        marginBottom:'5px', flexWrap:'wrap',
                        cursor:'pointer', borderRadius:'6px',
                        padding:'6px 8px', margin:'-6px -8px 5px',
                        transition:'background 0.15s',
                        userSelect:'none', WebkitUserSelect:'none',
                        WebkitTapHighlightColor:'transparent',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(80,130,255,0.10)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                    >
                      <span style={{
                        fontFamily:'var(--font-vyan)',
                        fontSize: isCurrent ? '20px' : '16px',
                        letterSpacing:'0.14em',
                        color: isCurrent ? '#7ab4ff' : 'rgba(130,170,255,0.82)',
                        fontWeight: isCurrent ? 700 : 500,
                      }}>v{v.version}</span>

                      {isCurrent && (
                        <span style={{
                          fontFamily:'var(--font-vyan)', fontSize:'9px', letterSpacing:'0.20em',
                          color:'rgba(80,220,130,0.95)', background:'rgba(30,110,55,0.22)',
                          border:'1px solid rgba(60,190,100,0.40)', borderRadius:'4px', padding:'2px 8px',
                        }}>CURRENT</span>
                      )}

                      <span style={{
                        fontFamily:'var(--font-vyan)', fontSize:'10px', letterSpacing:'0.12em',
                        color:'rgba(140,165,220,0.75)', marginLeft:'auto',
                      }}>{v.date}</span>

                      <span style={{
                        fontSize:'11px', color:'rgba(120,160,255,0.70)',
                        transition:'transform 0.25s',
                        display:'inline-block',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        lineHeight:1,
                      }}>▾</span>
                    </div>

                    {/* Title */}
                    <div style={{
                      fontFamily:'var(--font-vyan)', fontSize:'13px', letterSpacing:'0.09em',
                      color: isCurrent ? 'rgba(210,228,255,0.97)' : 'rgba(170,195,255,0.88)',
                      marginBottom:'4px', fontWeight: isCurrent ? 600 : 500,
                    }}>{v.title}</div>

                    {/* Summary */}
                    <div style={{
                      fontFamily:'var(--font-vyan)', fontSize:'11px', letterSpacing:'0.06em',
                      color: isCurrent ? 'rgba(160,185,235,0.82)' : 'rgba(140,165,215,0.72)',
                      lineHeight:1.60,
                      marginBottom: isExpanded ? '10px' : '8px',
                    }}>{v.summary}</div>

                    {/* Change list */}
                    <div style={{
                      maxHeight: isExpanded ? '1200px' : '0',
                      overflow:'hidden',
                      transition:'max-height 0.32s cubic-bezier(0.4,0,0.2,1)',
                    }}>
                      <ul style={{ margin:'0 0 10px', padding:0, listStyle:'none' }}>
                        {v.changes.map((c, ci) => (
                          <li key={ci} style={{
                            fontFamily:'var(--font-vyan)', fontSize:'11px', letterSpacing:'0.06em',
                            color: isCurrent ? 'rgba(190,210,255,0.90)' : 'rgba(165,188,240,0.80)',
                            lineHeight:'1.70', paddingLeft:'16px', position:'relative',
                          }}>
                            <span style={{
                              position:'absolute', left:0,
                              color: isCurrent ? 'rgba(110,165,255,0.90)' : 'rgba(100,145,230,0.72)',
                            }}>·</span>
                            {c}
                          </li>
                        ))}
                      </ul>

                      <div style={{ display:'flex', gap:'16px', alignItems:'center', flexWrap:'wrap' }}>
                        <span style={{
                          fontFamily:'monospace', fontSize:'10px',
                          color:'rgba(110,145,210,0.72)', letterSpacing:'0.06em',
                          userSelect:'text', WebkitUserSelect:'text',
                        }}>git: {v.gitHash}</span>
                        <span style={{
                          fontFamily:'var(--font-vyan)', fontSize:'10px', letterSpacing:'0.10em',
                          color:'rgba(110,145,210,0.68)',
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
