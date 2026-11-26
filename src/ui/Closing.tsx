/** The closing card: one calm message and one easy next step. */
import { COPY } from '../config'
import { useStore } from '../store'

export function Closing() {
  const open = useStore((s) => s.overlay === 'closing')
  const set = useStore((s) => s.set)
  return (
    <section className={`closing${open ? ' in' : ''}`} aria-hidden={!open} inert={open ? undefined : true} role="dialog" aria-label="What comes next">
      <button className="back" onClick={() => set({ overlay: null })}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <span>Back to the bottles</span>
      </button>
      <div className="closing-body">
        <img src="/brand/mark_white.webp" alt="" width="447" height="556" />
        <h2>{COPY.closingTitle}<br /><span>{COPY.closingLine}</span></h2>
        <p className="kn" lang="kn">{COPY.closingKn}</p>
        <a className="wa" href={COPY.whatsappUrl} target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.2a9.7 9.7 0 00-8.300 14.800L2.300 21.800l4.900-1.300A9.700 9.700 0 1012 2.200zm0 1.800a7.900 7.900 0 11-4 14.700l-.3-.2-2.900.8.800-2.800-.2-.3A7.900 7.900 0 0112 4zm-3.300 3.700c-.2 0-.5 0-.7.300-.3.300-1 1-1 2.300s1 2.700 1.100 2.900c.1.200 1.900 3 4.700 4.100 2.300.9 2.800.7 3.300.7.500 0 1.600-.700 1.800-1.300.2-.6.200-1.200.200-1.300-.1-.1-.3-.2-.6-.3l-1.900-.9c-.3-.1-.5-.2-.6.100l-.9 1.100c-.200.200-.300.200-.600.100-.3-.2-1.200-.4-2.200-1.400-.8-.700-1.400-1.600-1.500-1.900-.200-.3 0-.4.100-.6l.400-.5.300-.500v-.5l-.9-2c-.2-.4-.4-.4-.6-.4z" /></svg>
          <span>{COPY.whatsapp}</span>
        </a>
      </div>
      <p className="credit">{COPY.credit}</p>
    </section>
  )
}
