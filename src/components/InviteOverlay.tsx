import { useReducedMotion } from '../hooks'
import { useApp } from '../state/AppState'

const STARTER_A = 'romans'
const STARTER_B = 'galatians'

/**
 * First-visit invite adapted from docs/landing-page-concept.md,
 * Secondary entries: Before Paul / After Acts essays + Voices module.
 */
export function InviteOverlay() {
  const app = useApp()
  const reduced = useReducedMotion()

  if (app.phase !== 'invite') return null

  return (
    <div
      className={`invite-overlay${reduced ? ' is-static' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-headline"
    >
      <button type="button" className="invite-skip" onClick={app.dismissInvite}>
        Skip
      </button>

      <div className="invite-panel">
        <div className="invite-hero" aria-hidden={reduced}>
          <div className="invite-compare-motion">
            <div className="invite-col invite-col--a">
              <span className="invite-col-title">Romans</span>
              <span className="invite-col-meta">Unvisited · Rome</span>
              <ul className="invite-themes">
                <li className="is-lit">Justification</li>
                <li className="is-lit">Jew &amp; Gentile</li>
                <li>Gospel</li>
              </ul>
            </div>
            <div className="invite-col invite-col--b">
              <span className="invite-col-title">Galatians</span>
              <span className="invite-col-meta">Planted · Galatia</span>
              <ul className="invite-themes">
                <li className="is-lit">Freedom</li>
                <li className="is-lit">Justification</li>
                <li>Grace</li>
              </ul>
            </div>
            <div className="invite-anchor">
              <span className="invite-anchor-ref">Gal 2:16 · Rom 3:28</span>
              <span className="invite-anchor-label">Same gospel, different heat</span>
            </div>
          </div>
        </div>

        <h1 id="invite-headline" className="invite-headline">
          Thirteen letters. Thirty-six cities. Paul’s mission on the map.
        </h1>
        <p className="invite-sub">
          Start inside the atlas — compare two letters, open a city, scrub the life of Paul, or step
          into the story before and after Acts.
        </p>

        <div className="invite-cards" role="list">
          <button
            type="button"
            className="invite-card invite-card--primary"
            role="listitem"
            onClick={app.beginStory}
          >
            <strong>Play Paul’s journey</strong>
            <span>About two minutes · Damascus road to Rome</span>
          </button>
          <button
            type="button"
            className="invite-card"
            role="listitem"
            onClick={() => app.enterComparePair(STARTER_A, STARTER_B)}
          >
            <strong>Start with a comparison</strong>
            <span>Romans and Galatians, side by side</span>
          </button>
          <button
            type="button"
            className="invite-card"
            role="listitem"
            onClick={app.enterExploreCities}
          >
            <strong>Explore the cities</strong>
            <span>Map, places, and city notes</span>
          </button>
          <button
            type="button"
            className="invite-card"
            role="listitem"
            onClick={app.enterExploreTimeline}
          >
            <strong>Follow the timeline</strong>
            <span>Life, letters, and year scrubber</span>
          </button>
          <button
            type="button"
            className="invite-card"
            role="listitem"
            onClick={() => app.enterExploreThemes('Justification')}
          >
            <strong>Browse themes</strong>
            <span>Filter letters by interpretive pressure</span>
          </button>
        </div>

        <h2 className="invite-section-label">Also in this atlas</h2>
        <div className="invite-cards invite-cards--secondary" role="list">
          <button
            type="button"
            className="invite-card"
            role="listitem"
            onClick={app.enterBeforePaul}
          >
            <strong>Jump to Damascus (Acts 7–9)</strong>
            <span>Why Saul of Tarsus opposed “the Way”—Pharisee zeal, Stephen’s blood, and the road that reversed him. Jump to the Damascus hinge (~AD 34).</span>
          </button>
          <button
            type="button"
            className="invite-card"
            role="listitem"
            onClick={app.enterAfterPaul}
          >
            <strong>Jump to Rome, end of Acts</strong>
            <span>Acts ends in Rome with Paul still proclaiming—no martyrdom scene on the page. What Scripture says, what tradition remembers, and how to keep them apart. Jump to Rome (~AD 62).</span>
          </button>
          <button
            type="button"
            className="invite-card"
            role="listitem"
            onClick={app.enterVoices}
          >
            <strong>What Others Say About Paul</strong>
            <span>Peter, James, Luke, opponents — passage cards</span>
          </button>
        </div>

        <button
          type="button"
          className="invite-nudge"
          onClick={() => app.enterComparePair(STARTER_A, STARTER_B)}
        >
          Try Romans and Galatians →
        </button>
      </div>
    </div>
  )
}
