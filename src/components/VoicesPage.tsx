import { useState } from 'react'
import { VOICES_ESSAYS, VOICES_LEDE } from '../data/voices-essays'
import { ScriptureLink } from './ScriptureLink'

/**
 * Voices on Paul — passage cards + expandable short essays.
 * Critic must-fixes (2026-10-01): shorter lede; Peter authorship chip;
 * paul-self visible Consensus chips. Independent human review still required.
 */
const VOICES: {
  id: string
  title: string
  summary: string
  passages: { label: string; search: string }[]
  note?: string
}[] = [
  {
    id: 'peter',
    title: 'Peter',
    summary:
      'Calls Paul’s letters “scripture,” yet flags them as hard to understand and open to distortion by the unstable.',
    passages: [{ label: '2 Peter 3:15–16', search: '2 Peter 3:15-16' }],
  },
  {
    id: 'james',
    title: 'James and the Jerusalem circle',
    summary:
      'Recognition and negotiation — fellowship for the Gentile mission alongside concern for Jewish believers and practice.',
    passages: [
      { label: 'Acts 15', search: 'Acts 15:1-21' },
      { label: 'Acts 21:17–26', search: 'Acts 21:17-26' },
      { label: 'Galatians 2:9–10', search: 'Galatians 2:9-10' },
    ],
  },
  {
    id: 'luke',
    title: 'Luke / Acts',
    summary:
      'Sympathetic companion narrative — not hagiography; conflict, arrest, and defense scenes stay in view.',
    passages: [
      { label: 'Acts 9', search: 'Acts 9:1-22' },
      { label: 'Acts 15', search: 'Acts 15:1-21' },
      { label: 'Acts 28', search: 'Acts 28:16-31' },
    ],
  },
  {
    id: 'jude',
    title: 'Jude',
    summary:
      'Shared early-church warning language; any direct “about Paul” link stays labeled as debated, not settled.',
    passages: [{ label: 'Jude 17–18', search: 'Jude 17-18' }],
    note: 'Debated link to Pauline tradition',
  },
  {
    id: 'opponents',
    title: 'Opponents',
    summary:
      'Rivals cast Paul as crafty, bold on paper, weak in person — while some preach Christ from envy; Paul answers without erasing the conflict.',
    passages: [
      { label: '2 Corinthians 10–13', search: '2 Corinthians 10:1-13:14' },
      { label: 'Galatians 1:6–9', search: 'Galatians 1:6-9' },
      { label: 'Philippians 1:15–18', search: 'Philippians 1:15-18' },
    ],
  },
  {
    id: 'paul-self',
    title: 'Paul on himself',
    summary:
      'Least of the apostles / least of all saints / foremost of sinners — self-assessment set beside external praise, caution, and attack.',
    passages: [
      { label: '1 Corinthians 15:9', search: '1 Corinthians 15:9' },
      { label: 'Ephesians 3:8', search: 'Ephesians 3:8' },
      { label: '1 Timothy 1:15', search: '1 Timothy 1:15' },
    ],
  },
]

export function VoicesPage() {
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <article className="page voices-page">
      <h1>What others say about Paul</h1>
      <p className="voices-lede">{VOICES_LEDE}</p>
      <div className="voices-grid">
        {VOICES.map((v) => {
          const essay = VOICES_ESSAYS[v.id]
          const expanded = openId === v.id
          return (
            <section key={v.id} className={`voice-card${expanded ? ' is-expanded' : ''}`}>
              <h2>{v.title}</h2>
              {v.note ? <p className="voice-note">{v.note}</p> : null}
              {essay?.authorshipChip ? (
                <p className="voice-authorship-chip">{essay.authorshipChip}</p>
              ) : null}
              {essay?.chips && essay.chips.length > 0 ? (
                <div className="voice-consensus-chips" aria-label="Consensus chips">
                  {essay.chips.map((c) => (
                    <span key={c.passage} className="pill">
                      <strong>{c.chip}</strong> · {c.passage}
                    </span>
                  ))}
                </div>
              ) : null}
              <p>{v.summary}</p>
              <p className="voice-passages">
                {v.passages.map((r, i) => (
                  <span key={r.search}>
                    {i > 0 ? ' · ' : null}
                    <ScriptureLink search={r.search}>{r.label}</ScriptureLink>
                  </span>
                ))}
              </p>
              {essay ? (
                <>
                  <button
                    type="button"
                    className="voice-expand-btn"
                    aria-expanded={expanded}
                    onClick={() => setOpenId(expanded ? null : v.id)}
                  >
                    {expanded ? 'Hide essay' : 'Read short essay'}
                  </button>
                  {expanded ? (
                    <div className="voice-essay">
                      {essay.paragraphs.map((p, i) => (
                        <p key={i}>{p}</p>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : null}
            </section>
          )
        })}
      </div>
      <p className="voices-foot">
        See also{' '}
        <a href="#/about" className="voices-about-link">
          About &amp; method
        </a>{' '}
        for how this atlas weighs Acts, the letters, and tradition.
      </p>
    </article>
  )
}
