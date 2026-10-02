import { useEffect, useRef } from 'react'
import { getModuleEssay, type ModuleEssayId } from '../data/module-essays'
import { useApp } from '../state/AppState'

function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n\n+/).map((block, i) => (
        <p key={i}>{block}</p>
      ))}
    </>
  )
}

export function ModuleEssayPanel() {
  const app = useApp()
  const essayId = app.moduleEssayId as ModuleEssayId | null
  const essay = getModuleEssay(essayId)
  const panelRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!essay) return
    const previously = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const panel = panelRef.current
    if (!panel) return

    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !panel) return
      const items = [
        ...panel.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),select,textarea,input,summary,[tabindex]:not([tabindex="-1"])',
        ),
      ]
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    panel.addEventListener('keydown', onKey)
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      panel.removeEventListener('keydown', onKey)
      document.body.style.overflow = original
      previously?.focus()
    }
  }, [essay])

  if (!essay) return null

  return (
    <>
      <button
        type="button"
        className="backdrop"
        aria-label="Close essay"
        onClick={() => app.clearModuleEssay()}
      />
      <aside
        ref={panelRef}
        className="drawer is-open module-essay-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="module-essay-title"
      >
        <div className="sheet-handle" aria-hidden="true" />
        <button
          ref={closeRef}
          type="button"
          className="close-drawer"
          aria-label="Close"
          onClick={() => app.clearModuleEssay()}
        >
          ×
        </button>
        <p className="drawer-kicker">Module essay</p>
        <h2 id="module-essay-title">{essay.title}</h2>
        <div className="module-essay-lead">
          <Paragraphs text={essay.lead} />
        </div>
        <div className="module-essay-sections">
          {essay.sections.map((section) => (
            <details key={section.id} className="module-essay-section">
              <summary>
                <strong>{section.label}</strong>
                {section.confidence ? (
                  <span className="module-essay-confidence">{section.confidence}</span>
                ) : null}
              </summary>
              <div className="module-essay-body">
                {section.chips && section.chips.length > 0 ? (
                  <div className="module-essay-chips" aria-label="Source chips">
                    {section.chips.map((chip) => (
                      <span key={chip} className="pill">
                        {chip}
                      </span>
                    ))}
                  </div>
                ) : null}
                {section.paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
                {section.labels?.map((lab) => (
                  <p key={lab.kind} className="module-essay-label">
                    <strong>{lab.kind}:</strong> {lab.text}
                  </p>
                ))}
                {section.letterAnchors && section.letterAnchors.length > 0 ? (
                  <ul className="module-essay-anchors">
                    {section.letterAnchors.map((a) => (
                      <li key={a.passage}>
                        <span className="pill">{a.chip}</span>{' '}
                        <strong>{a.passage}</strong> — {a.note}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </details>
          ))}
        </div>
      </aside>
    </>
  )
}
