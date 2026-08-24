'use client'
import { useEffect, useRef, useState } from 'react'

const DESIGN_H = 900

export function ScaledIframe({ src, title }: { src: string; title?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [frame, setFrame] = useState({ scale: 1, iframeW: 480 })

  useEffect(() => {
    const measure = () => {
      const el = containerRef.current
      if (!el) return
      const { width, height } = el.getBoundingClientRect()
      const scale = Math.min(height / DESIGN_H, width / 480, 1)
      setFrame({ scale, iframeW: scale < 1 ? width / scale : width })
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: frame.iframeW,
        height: DESIGN_H,
        transform: `scale(${frame.scale})`,
        transformOrigin: 'top left',
      }}>
        <iframe
          src={src}
          title={title}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          allow="fullscreen"
        />
      </div>
    </div>
  )
}
