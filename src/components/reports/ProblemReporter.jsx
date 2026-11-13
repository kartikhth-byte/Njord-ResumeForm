import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { reportPage, submitProblem } from '../../lib/problemReports'

const ProblemReportList = lazy(() => import('./ProblemReportList'))
const VERSION = import.meta.env.VITE_APP_VERSION || 'local'
const clamp = (p) => ({ x: Math.max(8, Math.min(window.innerWidth - 52, p.x)), y: Math.max(8, Math.min(window.innerHeight - 52, p.y)) })

function Reporter({ userId }) {
  const location = useLocation()
  const key = `holmes-report-position:${userId}`
  const [position, setPosition] = useState(() => {
    try { const p = JSON.parse(localStorage.getItem(key)); if (Number.isFinite(p?.x) && Number.isFinite(p?.y)) return clamp(p) } catch { /* default position */ }
    return clamp({ x: window.innerWidth - 64, y: window.innerHeight - 64 })
  })
  const [mode, setMode] = useState(null)
  const [preview, setPreview] = useState(null)
  const [description, setDescription] = useState('')
  const [warnings, setWarnings] = useState([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [sending, setSending] = useState(false)
  const [normalizing, setNormalizing] = useState(false)
  const [modalHost, setModalHost] = useState(null)
  const decoding = useRef(false)
  const dialog = useRef(null), trigger = useRef(null), drag = useRef(null), suppressClick = useRef(false)
  const generation = useRef(0), report = useRef(null), busy = useRef(false)
  useEffect(() => {
    const controller = generation
    const resize = () => setPosition(p => clamp(p))
    window.addEventListener('resize', resize)
    return () => { window.removeEventListener('resize', resize); controller.current++ }
  }, [])
  useEffect(() => {
    // A native modal makes the rest of the document inert. Keep reporting
    // available inside the active app dialog, without closing that screen.
    const sync = () => setModalHost([...document.querySelectorAll('dialog:modal')].filter(node => !node.closest('[data-report-ui]')).at(-1) || null)
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] })
    sync()
    return () => observer.disconnect()
  }, [])
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(position)) } catch { /* optional preference */ } }, [position, key])
  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url) }, [preview])
  useEffect(() => {
    if (mode && !dialog.current.open) dialog.current.showModal()
    else if (!mode && dialog.current.open) { dialog.current.close(); trigger.current?.focus() }
  }, [mode])
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(timer) }, [notice])
  function close() { if (busy.current) return; generation.current++; decoding.current = false; setNormalizing(false); setMode(null); setPreview(null); setError('') }
  async function capture() {
    if (suppressClick.current) { suppressClick.current = false; return }
    if (mode) return
    const token = ++generation.current
    report.current = { id: crypto.randomUUID(), page: reportPage(location.pathname), appVersion: VERSION }
    setMode('capturing'); setDescription(''); setPreview(null); setWarnings([]); setError(''); setNotice('')
    try {
      const { captureProblem } = await import('../../lib/captureProblem')
      const result = await captureProblem()
      if (generation.current !== token) return
      setPreview({ blob: result.blob, url: URL.createObjectURL(result.blob) }); setWarnings(result.warnings)
    } catch { if (generation.current === token) setError('Could not capture this screen. Upload a screenshot below.') }
    finally { if (generation.current === token) setMode('preview') }
  }
  async function upload(file) {
    if (!file || busy.current) return
    decoding.current = true; setNormalizing(true)
    const token = ++generation.current
    setError('')
    try {
      const { normalizeScreenshot } = await import('../../lib/captureProblem')
      const blob = await normalizeScreenshot(file)
      if (generation.current !== token) return
      // Replacing the screenshot after a failed upload requires a new immutable report.
      report.current = { ...report.current, id: crypto.randomUUID() }
      setPreview({ blob, url: URL.createObjectURL(blob) }); setWarnings([])
    } catch (e) { if (generation.current === token) setError(e.message) }
    finally { if (generation.current === token) { decoding.current = false; setNormalizing(false) } }
  }
  async function send() {
    if (busy.current || decoding.current || !preview) return
    busy.current = true; setSending(true); setError('')
    const token = generation.current
    try {
      const result = await submitProblem({ ...report.current, blob: preview.blob, description })
      if (generation.current === token) { setMode(null); setPreview(null); setNotice(`Report #${result.report_number} sent`) }
    } catch (e) { if (generation.current === token) setError(e.message) }
    finally { busy.current = false; setSending(false) }
  }
  const launcher = <button data-report-ui data-html2canvas-ignore ref={trigger} type="button" aria-label="Report a problem" title="Report a problem · drag to move" style={{position:'fixed',left:position.x,top:position.y,zIndex:2147483000,touchAction:'none'}} className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-fg opacity-60 shadow-md hover:opacity-100 focus:opacity-100 focus:outline focus:outline-2 focus:outline-accent text-3xl select-none"
      onPointerDown={e => { if (e.button !== 0) return; suppressClick.current = false; drag.current = { x:e.clientX, y:e.clientY, start:position }; e.currentTarget.setPointerCapture(e.pointerId) }}
      onPointerMove={e => { if (!drag.current) return; const dx=e.clientX-drag.current.x, dy=e.clientY-drag.current.y; if (Math.hypot(dx,dy)>6) suppressClick.current=true; if(suppressClick.current) setPosition(clamp({x:drag.current.start.x+dx,y:drag.current.start.y+dy})) }}
      onPointerUp={() => { drag.current=null }} onPointerCancel={() => { drag.current=null; suppressClick.current=false }}
      onKeyDown={e => { const steps={ArrowLeft:[-16,0],ArrowRight:[16,0],ArrowUp:[0,-16],ArrowDown:[0,16]}; if (steps[e.key]) { e.preventDefault(); const [dx,dy]=steps[e.key]; setPosition(p=>clamp({x:p.x+dx,y:p.y+dy})) } else suppressClick.current=false }}
      onClick={capture}>＋</button>
  return <div data-report-ui data-html2canvas-ignore>
    {modalHost ? createPortal(launcher, modalHost) : launcher}
    {notice && (modalHost ? createPortal(<div data-report-ui role="status" className="fixed bottom-20 right-4 z-[2147483001] rounded-lg bg-surface border border-line px-4 py-3 text-fg shadow-lg">{notice}</div>, modalHost) : <div role="status" className="fixed bottom-20 right-4 z-[2147483001] rounded-lg bg-surface border border-line px-4 py-3 text-fg shadow-lg">{notice}</div>)}
    <dialog ref={dialog} aria-labelledby="problem-report-title" onCancel={e=>{e.preventDefault();close()}} className="m-auto w-[min(560px,calc(100vw-24px))] max-h-[90dvh] overflow-y-auto rounded-xl border border-line bg-surface p-5 text-fg shadow-2xl backdrop:bg-black/40">
      <div className="flex items-center justify-between gap-3 mb-3"><h2 id="problem-report-title" className="font-semibold text-lg">{mode==='history'?'My reports':'Report a problem'}</h2><button aria-label="Close report" onClick={close} disabled={sending} className="p-2">✕</button></div>
      {mode==='history' ? <Suspense fallback={<p>Loading reports…</p>}><ProblemReportList userId={userId} /></Suspense> : <>
        {mode==='capturing' && <p role="status">Capturing screen…</p>}
        {preview && <img alt="Screenshot preview" src={preview.url} className="max-h-[40dvh] w-full object-contain rounded border border-line" />}
        {warnings.map(w=><p key={w} className="text-sm mt-2 text-amber-600">{w}</p>)}
        {error && <p role="alert" className="text-red-600 mt-2">{error}</p>}
        {mode==='preview' && <><label className="block mt-3 text-sm">What went wrong? <span className="text-fg-muted">(optional)</span><textarea disabled={sending} maxLength={2000} value={description} onChange={e=>setDescription(e.target.value)} rows={2} className="block mt-1 w-full rounded border border-line bg-surface p-2" /></label>
          <p className="text-xs text-fg-muted mt-2">Shared privately with support. Screenshot expires in seven days.</p>
          <div className="mt-4 flex flex-wrap items-center gap-3"><label className="text-sm underline cursor-pointer">Upload screenshot<input aria-label="Upload screenshot" type="file" accept="image/png,image/jpeg,image/webp" disabled={sending || normalizing} className="sr-only" onChange={e=>{upload(e.target.files[0]);e.target.value=''}} /></label><button className="text-sm underline" disabled={sending || normalizing} onClick={()=>{generation.current++;setPreview(null);setMode('history')}}>My reports</button><button autoFocus disabled={!preview || sending || normalizing} onClick={send} className="ml-auto rounded-lg bg-accent px-6 py-2 font-semibold text-white disabled:opacity-50">{normalizing?'Loading image…':sending?'Sending…':'Send'}</button></div>
        </>}
      </>}
    </dialog>
  </div>
}

export default function ProblemReporter() {
  const { user, loading } = useAuth()
  const { pathname } = useLocation()
  if (!user || loading || /\/(login|callback|reset-password|setup)(\/|$)/.test(pathname)) return null
  return <Reporter key={user.id} userId={user.id} />
}
