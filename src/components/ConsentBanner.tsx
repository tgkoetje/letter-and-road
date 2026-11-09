import { useEffect, useState } from 'react'
import {
  analyticsEnabled,
  getConsentChoice,
  isUsRegion,
  setConsentChoice,
  subscribeRegionReady,
  type ConsentChoice,
} from '../lib/analytics'

const CONSENT_PENDING_CLASS = 'consent-pending'

export function ConsentBanner() {
  const [choice, setChoice] = useState<ConsentChoice>(null)
  const [regionReady, setRegionReady] = useState(false)
  const [isUs, setIsUs] = useState(false)

  useEffect(() => {
    setChoice(getConsentChoice())
    return subscribeRegionReady(() => {
      setIsUs(isUsRegion())
      setRegionReady(true)
    })
  }, [])

  const visible = regionReady && analyticsEnabled() && choice === null

  useEffect(() => {
    const root = document.documentElement
    if (visible) root.classList.add(CONSENT_PENDING_CLASS)
    else root.classList.remove(CONSENT_PENDING_CLASS)
    return () => root.classList.remove(CONSENT_PENDING_CLASS)
  }, [visible])

  if (!visible) return null

  if (isUs) {
    return (
      <div className="consent-banner" role="dialog" aria-label="Analytics notice">
        <p>
          We use Google Analytics for aggregate visits (pages opened, not profiles). Analytics is on
          for visitors in the United States; you can decline anytime. See{' '}
          <a href="#/about">About — Privacy</a>.
        </p>
        <div className="consent-actions">
          <button
            type="button"
            className="primary-btn"
            onClick={() => {
              setConsentChoice('accepted')
              setChoice('accepted')
            }}
          >
            Got it
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              setConsentChoice('declined')
              setChoice('declined')
            }}
          >
            Decline
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="consent-banner" role="dialog" aria-label="Analytics cookies">
      <p>
        We use Google Analytics to understand aggregate visits (pages opened, not profiles). Choose
        whether to allow analytics cookies. See <a href="#/about">About — Privacy</a>.
      </p>
      <div className="consent-actions">
        <button
          type="button"
          className="primary-btn"
          onClick={() => {
            setConsentChoice('accepted')
            setChoice('accepted')
          }}
        >
          Accept analytics
        </button>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => {
            setConsentChoice('declined')
            setChoice('declined')
          }}
        >
          Decline
        </button>
      </div>
    </div>
  )
}
