/**
 * Everything drawn over the canvas: brand pill, scene picker, hotspot dots and
 * card, the first time hint, and the dock with actions and product chips.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { COPY, HOTSPOTS, PRODUCTS, SCENES } from '../config'
import { useStore } from '../store'
import { hotspotEls } from './hotspotEls'
import { arSupported } from './ar'

const Icon = {
  range: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 20V10.2c0-1 .5-1.8 1.2-2.4V5.5h2.6v2.3c.7.6 1.2 1.400 1.200 2.400V20zM10.5 20V8.200c0-1 .5-1.8 1.200-2.400V3.500h2.600v2.300c.7.6 1.200 1.400 1.200 2.400V20zM14.500 20V10.200c0-1 .5-1.800 1.200-2.400V5.500h2.600v2.300c.7.6 1.200 1.400 1.200 2.400V20z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>,
  flat: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6.5" width="18" height="11" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M8 6.500v11M11.500 6.500v11M17 6.500v11" stroke="currentColor" strokeWidth="1.200" /></svg>,
  ar: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 4v10l-7 4-7-4V7zM12 12l7-4M12 12L5 8M12 12v9" fill="none" stroke="currentColor" strokeWidth="1.500" strokeLinejoin="round" /></svg>,
  scene: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.500" y="5" width="17" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.500" /><path d="M4 16l4.500-4.500 3.500 3.500 2.500-2.500L20 17" fill="none" stroke="currentColor" strokeWidth="1.500" strokeLinejoin="round" /><circle cx="15.500" cy="9.500" r="1.400" fill="currentColor" /></svg>,
  close: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.800" strokeLinecap="round" /></svg>,
  next: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="1.800" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  finger: <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M13 17V8.500a2 2 0 014 0V15l5.400 1.100a2.500 2.500 0 012 2.800l-.8 5.600a3 3 0 01-3 2.500h-5.300a3 3 0 01-2.500-1.300L8.500 19.500a1.700 1.700 0 012.700-2z" fill="none" stroke="currentColor" strokeWidth="1.600" strokeLinejoin="round" /><path d="M6 8.500C7.500 5.500 10 4 13 3.700M26 8.500C24.500 5.500 22 4 19 3.700" fill="none" stroke="currentColor" strokeWidth="1.600" strokeLinecap="round" /></svg>,
}
export { Icon }

/* ---------- top ---------- */
function TopBar() {
  const scene = useStore((s) => s.scene)
  const setScene = useStore((s) => s.setScene)
  const webgl = useStore((s) => s.webgl)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const t = setTimeout(() => window.addEventListener('pointerdown', close, { once: true }), 0)
    return () => { clearTimeout(t); window.removeEventListener('pointerdown', close) }
  }, [open])
  return (
    <header className="top" data-inset="top">
      <div className="brand glass">
        <img src="/brand/mark_green.webp" alt="" width="447" height="556" />
        <div>
          <strong>SUSTHIRA</strong>
          <em>{COPY.dedication}</em>
        </div>
      </div>
      {webgl === 'ok' && (
        <div className="scenes" onPointerDown={(e) => e.stopPropagation()}>
          <button className="glass pill" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {Icon.scene}<span>Scene</span>
          </button>
          {open && (
            <div className="menu glass" role="menu">
              {SCENES.map((sc) => (
                <button key={sc.key} role="menuitemradio" aria-checked={scene === sc.key} onClick={() => { setScene(sc.key); setOpen(false) }}>
                  <i style={{ background: sc.swatch }} />{sc.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </header>
  )
}

/* ---------- hotspots ---------- */
function Hotspots() {
  const active = useStore((s) => s.hotspot)
  const open = useStore((s) => s.openHotspot)
  return (
    <div className="dots" aria-hidden={false}>
      {HOTSPOTS.map((h) => (
        <button
          key={h.key}
          ref={(el) => { hotspotEls[h.key] = el }}
          className={`dot${active === h.key ? ' on' : ''}`}
          style={{ opacity: 0, pointerEvents: 'none' }}
          aria-label={h.title}
          onClick={() => open(h.key)}
        ><span /></button>
      ))}
    </div>
  )
}

function HotspotCard() {
  const key = useStore((s) => s.hotspot)
  const open = useStore((s) => s.openHotspot)
  const [shown, setShown] = useState(key)
  useEffect(() => { if (key) setShown(key) }, [key])
  const h = HOTSPOTS.find((x) => x.key === shown)
  if (!h) return null
  return (
    <aside className={`card${key ? ' in' : ''}`} aria-live="polite" aria-hidden={!key} onTransitionEnd={() => { if (!key) setShown(null) }}>
      <button className="x" aria-label="Close" onClick={() => open(null)}>{Icon.close}</button>
      <h2>{h.title}</h2>
      <p>{h.line}</p>
      <p className="kn" lang="kn">{h.kannada}</p>
    </aside>
  )
}

/* ---------- first time hint ---------- */
function Hint() {
  const phase = useStore((s) => s.phase)
  const seen = useStore((s) => s.hintSeen)
  const busy = useStore((s) => !!s.hotspot || !!s.overlay || s.view !== 'single')
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (phase !== 'hero' || seen) { setOn(false); return }
    const a = setTimeout(() => setOn(true), 700)
    const b = setTimeout(() => useStore.getState().markHintSeen(), 9000)
    return () => { clearTimeout(a); clearTimeout(b) }
  }, [phase, seen])
  if (seen && !on) return null
  return (
    <div className={`hint${on && !busy && !seen ? ' in' : ''}`} role="status">
      <span className="hand">{Icon.finger}</span>
      <span><b>{COPY.hint}</b><i lang="kn">{COPY.hintKn}</i></span>
    </div>
  )
}

/* ---------- dock ---------- */
export function Chips({ compact = false }: { compact?: boolean }) {
  const product = useStore((s) => s.product)
  const view = useStore((s) => s.view)
  const setProduct = useStore((s) => s.setProduct)
  return (
    <div className={`chips${compact ? ' compact' : ''}`} role="group" aria-label="Products">
      {PRODUCTS.map((p) => (
        <button
          key={p.key}
          className="chip"
          style={{ background: p.color, color: p.ink }}
          aria-pressed={product === p.key && view === 'single'}
          data-current={product === p.key}
          onClick={() => setProduct(p.key)}
        >
          <b>{p.name}</b>
          {!compact && <small>{p.range}</small>}
        </button>
      ))}
    </div>
  )
}

function Dock() {
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const set = useStore((s) => s.set)
  const webgl = useStore((s) => s.webgl)
  const [ar] = useState(arSupported)
  return (
    <footer className="dock" data-inset="dock">
      <div className="actions">
        <button className="glass pill" aria-pressed={view === 'range'} onClick={() => setView(view === 'range' ? 'single' : 'range')}>{Icon.range}<span>Whole range</span></button>
        <button className="glass pill" onClick={() => set({ overlay: 'flat', hotspot: null })}>{Icon.flat}<span>Flat artwork</span></button>
        {ar && webgl !== 'none' && <button className="glass pill" aria-label={COPY.ar} onClick={() => set({ overlay: 'ar', hotspot: null })}>{Icon.ar}<span>On your table</span></button>}
      </div>
      <Chips />
      <button className={`next${view === 'range' ? ' strong' : ''}`} onClick={() => set({ overlay: 'closing', hotspot: null })}>
        <span>{view === 'range' ? 'Next, all 83 products' : 'What comes next'}</span>{Icon.next}
      </button>
    </footer>
  )
}

/** Reports how much of the screen the interface covers, so the camera can centre the bottle in what is left. */
function useInsets(root: React.RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const measure = () => {
      const top = el.querySelector<HTMLElement>('[data-inset=top]')
      const dock = el.querySelector<HTMLElement>('[data-inset=dock]')
      const W = window.innerWidth, H = window.innerHeight
      const dr = dock?.getBoundingClientRect()
      const d = dr && dr.height > 0 ? dr : undefined // hidden interface: no insets
      const side = !!d && d.height > H * 0.7 // landscape phone: the dock is a column on the right
      const next = {
        top: side ? 30 : Math.round(top?.getBoundingClientRect().bottom ?? 0),
        right: side && d ? Math.round(W - d.left) : 0,
        bottom: side ? 30 : !d ? 0 : Math.round(H - d.top) + 46, // leave floor for the shadow and the hint
        left: 0,
      }
      el.style.setProperty('--dock-h', `${side || !d ? 0 : Math.round(H - d.top)}px`)
      const cur = useStore.getState().insets
      if (cur.top !== next.top || cur.right !== next.right || cur.bottom !== next.bottom) useStore.setState({ insets: next })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    el.querySelectorAll('[data-inset]').forEach((n) => ro.observe(n))
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [root])
}

export function Interface() {
  const phase = useStore((s) => s.phase)
  const webgl = useStore((s) => s.webgl)
  const overlay = useStore((s) => s.overlay)
  const root = useRef<HTMLDivElement>(null)
  useInsets(root)
  const visible = phase === 'hero' || webgl !== 'ok'
  return (
    <div ref={root} className={`ui${visible ? ' in' : ''}${overlay ? ' under' : ''}`} inert={overlay ? true : undefined}>
      <TopBar />
      {webgl === 'ok' && <Hotspots />}
      {webgl === 'ok' && <Hint />}
      <HotspotCard />
      <Dock />
    </div>
  )
}
