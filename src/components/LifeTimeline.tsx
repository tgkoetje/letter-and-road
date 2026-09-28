import { useEffect, useRef } from 'react'
import { BIOGRAPHICAL_EVENTS } from '../data/biographical'
import { CITY_BY_ID } from '../data/cities'
import { useApp } from '../state/AppState'

export function LifeTimeline() {
  const app = useApp()
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!scroller.current) return
    const near = BIOGRAPHICAL_EVENTS.find(
      (e) => app.year >= e.yearStart && app.year <= (e.yearEnd ?? e.yearStart),
    )
    if (!near) return
    const el = scroller.current.querySelector(`[data-life="${near.id}"]`)
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
    }
  }, [app.year])

  return (
    <div className="story-rail life-rail" aria-label="Paul’s life timeline">
      <div className="story-rail-head">
        <strong>Paul’s life</strong>
        <span>Tap an event to focus its city and year. Letter timeline stays available separately.</span>
      </div>
      <div className="story-cards" ref={scroller}>
        {BIOGRAPHICAL_EVENTS.map((ev) => {
          const place = ev.placeId ? CITY_BY_ID[ev.placeId] : null
          const active =
            app.year >= ev.yearStart && app.year <= (ev.yearEnd ?? ev.yearStart)
          const selected = app.cityId && ev.placeId === app.cityId && active
          return (
            <button
              key={ev.id}
              type="button"
              data-life={ev.id}
              className={`story-card life-card${active ? ' is-current' : ''}${selected ? ' is-selected' : ''}`}
              onClick={() => {
                app.setYear(ev.yearStart)
                if (ev.placeId) app.setCity(ev.placeId)
                app.setMenuOpen(false)
              }}
            >
              <span className="story-card-year">{ev.yearDisplay}</span>
              <strong>{ev.title}</strong>
              <span className="story-card-route">
                {place ? place.shortLabel : '—'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
