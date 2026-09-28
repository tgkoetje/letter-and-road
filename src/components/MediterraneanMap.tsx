import { useEffect, useMemo, useRef } from 'react'
import {
  Map as MapLibreMap,
  type GeoJSONSource,
  type MapLayerMouseEvent,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { CITIES, CITY_BY_ID } from '../data/cities'
import { CITY_CONTEXT_BY_ID } from '../data/city-contexts'
import { IMPRISONMENTS, JOURNEYS } from '../data/journeys'
import { LETTERS } from '../data/letters'
import { AUDIENCE_META } from '../data/periods'
import { START_LABEL_IDS, STORY, type StoryEvent } from '../data/story'
import { useMediaQuery, useReducedMotion } from '../hooks'
import { arcState, datingOf, matchesFilters, type ArcState } from '../lib/chronology'
import {
  MAP_BOUNDS,
  offsetToLonLat,
  sampleLetterArc,
  arcTipBearing,
} from '../lib/geo'
import { useApp } from '../state/AppState'
import type { Letter } from '../types'
import { MediterraneanMapSvg } from './MediterraneanMapSvg'

/** Feature flag: set VITE_USE_MAPLIBRE=false to restore the SVG atlas. Default true. */
const USE_MAPLIBRE = import.meta.env.VITE_USE_MAPLIBRE !== 'false'

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

const SRC = {
  journeys: 'lr-journeys',
  storyTravels: 'lr-story-travels',
  letters: 'lr-letters',
  letterAlts: 'lr-letter-alts',
  letterTips: 'lr-letter-tips',
  prisons: 'lr-prisons',
  cities: 'lr-cities',
} as const

type LonLat = [number, number]

type FeatureProps = Record<string, string | number | boolean | null | undefined>

type Feature = {
  type: 'Feature'
  properties: FeatureProps
  geometry:
    | { type: 'Point'; coordinates: LonLat }
    | { type: 'LineString'; coordinates: LonLat[] }
}

type FC = {
  type: 'FeatureCollection'
  features: Feature[]
}

const EMPTY: FC = { type: 'FeatureCollection', features: [] }

export function MediterraneanMap() {
  if (!USE_MAPLIBRE) return <MediterraneanMapSvg />
  return <MediterraneanMapLibre />
}

function MediterraneanMapLibre() {
  const app = useApp()
  const compact = useMediaQuery('(max-width: 720px)')
  const reduced = useReducedMotion()
  const wrapRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const readyRef = useRef(false)
  const pendingPushRef = useRef<(() => void) | null>(null)
  const appRef = useRef(app)
  appRef.current = app

  const visibleLetters = useMemo(
    () => LETTERS.filter((l) => matchesFilters(l, app.filters)),
    [app.filters],
  )

  const storyEvents = app.phase === 'playing' ? STORY.slice(0, app.storyIndex + 1) : []
  const pastTravels = storyEvents.filter(
    (e): e is Extract<StoryEvent, { type: 'travel' }> => e.type === 'travel',
  )
  const current = app.currentStoryEvent
  const revealedLetterIds = new Set(
    storyEvents.filter((e) => e.type === 'letter').map((e) => e.letterId),
  )
  const liveLetterId = current?.type === 'letter' ? current.letterId : null

  const showLetters = app.phase === 'explore' && app.layers.letters && !app.layers.citiesOnly
  const showJourneys = app.phase === 'explore' && app.layers.journeys && !app.layers.citiesOnly
  const showPrisons = app.phase === 'explore' && app.layers.imprisonments && !app.layers.citiesOnly
  const showStoryTravels = app.phase === 'playing'
  const showStoryLetters = app.phase === 'playing'

  // --- Map init ---
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return

    const map = new MapLibreMap({
      container: el,
      style: STYLE_URL,
      bounds: MAP_BOUNDS,
      fitBoundsOptions: { padding: 24, animate: false },
      attributionControl: { compact: true },
      cooperativeGestures: false,
      fadeDuration: reduced ? 0 : 300,
      minZoom: 3.5,
      maxZoom: 10,
      maxBounds: [
        [MAP_BOUNDS[0][0] - 8, MAP_BOUNDS[0][1] - 6],
        [MAP_BOUNDS[1][0] + 8, MAP_BOUNDS[1][1] + 6],
      ],
    })
    mapRef.current = map

    map.dragRotate.disable()
    map.touchZoomRotate.disableRotation()

    const onLoad = () => {
      addOverlayImages(map)
      ensureSources(map)
      ensureLayers(map)
      readyRef.current = true
      pendingPushRef.current?.()
    }
    map.on('load', onLoad)

    const onCityClick = (e: MapLayerMouseEvent) => {
      const f = e.features?.[0]
      const id = f?.properties?.id as string | undefined
      if (id) appRef.current.setCity(id)
    }
    const onLetterClick = (e: MapLayerMouseEvent) => {
      const f = e.features?.[0]
      const id = f?.properties?.id as string | undefined
      const interactive = f?.properties?.interactive
      if (id && interactive) appRef.current.selectLetter(id)
    }

    const setPointer = () => {
      map.getCanvas().style.cursor = 'pointer'
    }
    const clearPointer = () => {
      map.getCanvas().style.cursor = ''
    }

    map.on('click', 'cities-circle', onCityClick)
    map.on('click', 'cities-diamond', onCityClick)
    map.on('click', 'letters-hit', onLetterClick)
    map.on('mouseenter', 'cities-circle', setPointer)
    map.on('mouseleave', 'cities-circle', clearPointer)
    map.on('mouseenter', 'cities-diamond', setPointer)
    map.on('mouseleave', 'cities-diamond', clearPointer)
    map.on('mouseenter', 'letters-hit', setPointer)
    map.on('mouseleave', 'letters-hit', clearPointer)

    const ro = new ResizeObserver(() => {
      map.resize()
    })
    ro.observe(el)

    return () => {
      readyRef.current = false
      ro.disconnect()
      map.remove()
      mapRef.current = null
    }
    // Intentionally once: map lifecycle. Click handlers close over stable app setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- GeoJSON updates ---
  const journeyData = useMemo((): FC => {
    if (!showJourneys) return EMPTY
    return {
      type: 'FeatureCollection',
      features: JOURNEYS.map((j) => {
        const coords = j.waypoints
          .map((id) => CITY_BY_ID[id])
          .filter(Boolean)
          .map((c) => [c.lon, c.lat] as [number, number])
        return {
          type: 'Feature' as const,
          properties: { id: j.id, label: `${j.label} · ${j.years}` },
          geometry: { type: 'LineString' as const, coordinates: coords },
        }
      }).filter((f) => f.geometry.coordinates.length >= 2),
    }
  }, [showJourneys])

  const storyTravelData = useMemo((): FC => {
    if (!showStoryTravels) return EMPTY
    return {
      type: 'FeatureCollection',
      features: pastTravels
        .map((ev) => {
          const coords = ev.waypoints
            .map((id) => CITY_BY_ID[id])
            .filter(Boolean)
            .map((c) => [c.lon, c.lat] as [number, number])
          const live = current?.type === 'travel' && current.id === ev.id
          return {
            type: 'Feature' as const,
            properties: {
              id: ev.id,
              mode: ev.mode,
              live: live ? 1 : 0,
              caption: ev.caption,
            },
            geometry: { type: 'LineString' as const, coordinates: coords },
          }
        })
        .filter((f) => f.geometry.coordinates.length >= 2),
    }
  }, [showStoryTravels, pastTravels, current])

  const letterBundle = useMemo(() => {
    const letters: Letter[] = showLetters
      ? visibleLetters
      : showStoryLetters
        ? LETTERS.filter((l) => revealedLetterIds.has(l.id))
        : []

    const mainFeatures: Feature[] = []
    const altFeatures: Feature[] = []
    const tipFeatures: Feature[] = []

    for (const letter of letters) {
      const d = datingOf(letter, app.filters.datingScheme)
      const from = CITY_BY_ID[d.originId]
      const to = CITY_BY_ID[letter.destinationId]
      if (!from || !to) continue

      const bulge = compact ? letter.arcBulge * 0.72 : letter.arcBulge
      const forceState: ArcState | undefined = showStoryLetters
        ? liveLetterId === letter.id
          ? 'current'
          : 'past'
        : undefined
      const state = forceState ?? arcState(letter, app.year, app.filters.datingScheme)
      if (state === 'future' && !showStoryLetters) {
        // Keep invisible in explore (matches SVG opacity 0)
        // Still skip geometry to reduce clutter
        continue
      }

      const color = AUDIENCE_META[letter.audienceType].color
      const selected = app.selectedLetterId === letter.id
      const dim = Boolean(app.selectedLetterId && !selected)
      const opacity =
        state === 'past' ? (dim ? 0.12 : 0.3) : dim ? 0.16 : 1
      const coords = sampleLetterArc(from.lon, from.lat, to.lon, to.lat, bulge)
      const label = `${letter.shortTitle}, ${d.originLabel} to ${letter.destinationLabel}, ${d.yearDisplay}`
      const mid = coords[Math.floor(coords.length / 2)] ?? coords[0]

      mainFeatures.push({
        type: 'Feature',
        properties: {
          id: letter.id,
          color,
          state,
          selected: selected ? 1 : 0,
          opacity,
          lineWidth: selected ? 3.2 : state === 'current' ? 2.6 : 2.1,
          interactive: 1,
          label,
          shortTitle: letter.shortTitle,
          showLabel: state === 'current' || selected ? 1 : 0,
          midLon: mid[0],
          midLat: mid[1],
        },
        geometry: { type: 'LineString', coordinates: coords },
      })

      tipFeatures.push({
        type: 'Feature',
        properties: {
          id: letter.id,
          color,
          opacity,
          bearing: arcTipBearing(from.lon, from.lat, to.lon, to.lat, bulge),
        },
        geometry: {
          type: 'Point',
          coordinates: coords[coords.length - 1] ?? [to.lon, to.lat],
        },
      })

      if (d.altOriginId && state !== 'future') {
        const alt = CITY_BY_ID[d.altOriginId]
        if (alt) {
          const altCoords = sampleLetterArc(alt.lon, alt.lat, to.lon, to.lat, bulge * -0.6)
          altFeatures.push({
            type: 'Feature',
            properties: {
              id: `${letter.id}-alt`,
              color,
              label: `Alternate origin debated: ${d.altOriginLabel}`,
            },
            geometry: { type: 'LineString', coordinates: altCoords },
          })
        }
      }
    }

    // Letter mid labels as separate points
    const labelFeatures: Feature[] = mainFeatures
      .filter((f) => f.properties?.showLabel === 1 && !compact)
      .map((f) => ({
        type: 'Feature' as const,
        properties: {
          shortTitle: f.properties?.shortTitle,
          opacity: f.properties?.opacity,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [f.properties?.midLon as number, f.properties?.midLat as number],
        },
      }))

    return {
      letters: { type: 'FeatureCollection' as const, features: mainFeatures },
      alts: { type: 'FeatureCollection' as const, features: altFeatures },
      tips: { type: 'FeatureCollection' as const, features: tipFeatures },
      labels: { type: 'FeatureCollection' as const, features: labelFeatures },
    }
  }, [
    showLetters,
    showStoryLetters,
    visibleLetters,
    revealedLetterIds,
    liveLetterId,
    app.filters.datingScheme,
    app.year,
    app.selectedLetterId,
    compact,
  ])

  const prisonData = useMemo((): FC => {
    if (!showPrisons) return EMPTY
    return {
      type: 'FeatureCollection',
      features: IMPRISONMENTS.map((imp) => {
        const city = CITY_BY_ID[imp.cityId]
        if (!city) return null
        const coordinates = offsetToLonLat(city.lon, city.lat, imp.offset[0], imp.offset[1])
        return {
          type: 'Feature' as const,
          properties: { id: imp.id, label: `${imp.label} · ${imp.years}` },
          geometry: { type: 'Point' as const, coordinates },
        }
      }).filter((f): f is NonNullable<typeof f> => f !== null),
    }
  }, [showPrisons])

  const cityData = useMemo((): FC => {
    const cities = CITIES.filter((c) => {
      if (START_LABEL_IDS.has(c.id)) return true
      if (app.phase !== 'explore') return false
      if (showJourneys) return true
      return c.letterRelevant || Boolean(CITY_CONTEXT_BY_ID[c.id])
    })

    return {
      type: 'FeatureCollection',
      features: cities
        .filter((city) => {
          const named = START_LABEL_IDS.has(city.id)
          const selected = app.cityId === city.id
          if (compact && !named && !selected) return false
          return true
        })
        .map((city) => {
          const named = START_LABEL_IDS.has(city.id)
          const selected = app.cityId === city.id
          return {
            type: 'Feature' as const,
            properties: {
              id: city.id,
              name: city.name,
              shortLabel: city.shortLabel,
              description: city.description,
              named: named ? 1 : 0,
              selected: selected ? 1 : 0,
              planted: city.planted ? 1 : 0,
              diamond: city.id === 'damascus_road' ? 1 : 0,
              radius: selected ? (named ? 8 : 6.5) : named ? 5.5 : 3.5,
            },
            geometry: { type: 'Point' as const, coordinates: [city.lon, city.lat] },
          }
        }),
    }
  }, [app.phase, app.cityId, showJourneys, compact])

  useEffect(() => {
    const map = mapRef.current
    const push = () => {
      if (!map || !readyRef.current || !map.isStyleLoaded()) return
      setSourceData(map, SRC.journeys, journeyData)
      setSourceData(map, SRC.storyTravels, storyTravelData)
      setSourceData(map, SRC.letters, letterBundle.letters)
      setSourceData(map, SRC.letterAlts, letterBundle.alts)
      setSourceData(map, SRC.letterTips, letterBundle.tips)
      setSourceData(map, 'lr-letter-labels', letterBundle.labels)
      setSourceData(map, SRC.prisons, prisonData)
      setSourceData(map, SRC.cities, cityData)
    }

    pendingPushRef.current = push
    push()
  }, [journeyData, storyTravelData, letterBundle, prisonData, cityData])

  function zoomIn() {
    mapRef.current?.zoomIn({ animate: !reduced })
  }
  function zoomOut() {
    mapRef.current?.zoomOut({ animate: !reduced })
  }
  function resetView() {
    mapRef.current?.fitBounds(MAP_BOUNDS, {
      padding: 24,
      animate: !reduced,
      duration: reduced ? 0 : 600,
    })
  }

  return (
    <div className="atlas">
      <div
        ref={wrapRef}
        className="map-wrap map-wrap--maplibre"
        role="img"
        aria-label="Eastern Mediterranean map with Paul’s letters drawn as directed arcs from origin to destination"
      />

      <aside className="legend-card" aria-label="Map legend">
        <div className="legend-row">
          <span className="swatch is-solid" />
          Overland — solid
        </div>
        <div className="legend-row">
          <span className="swatch is-dotted" />
          Ocean — dotted
        </div>
        <div className="legend-row">
          <span className="swatch is-dashed" />
          Letter — dashed
        </div>
      </aside>

      <div className="map-controls">
        <button className="icon-btn" type="button" onClick={zoomIn} aria-label="Zoom in">
          +
        </button>
        <button className="icon-btn" type="button" onClick={zoomOut} aria-label="Zoom out">
          −
        </button>
        <button className="icon-btn" type="button" onClick={resetView} aria-label="Reset map view">
          ⌖
        </button>
      </div>

      {app.phase === 'explore' && visibleLetters.length === 0 && app.layers.letters && (
        <div className="caption-card" role="status" style={{ whiteSpace: 'normal' }}>
          No letters match these filters.{' '}
          <button
            type="button"
            className="linkish"
            onClick={app.clearFilters}
            style={{ display: 'inline', width: 'auto' }}
          >
            Clear filters
          </button>
        </div>
      )}

      {app.phase === 'playing' && current && (
        <div className="play-caption play-caption--overlay">
          <div className="play-caption-dates">{current.dates}</div>
          <div className="play-caption-text">{current.caption}</div>
        </div>
      )}
    </div>
  )
}

function setSourceData(map: MapLibreMap, id: string, data: FC) {
  const src = map.getSource(id) as GeoJSONSource | undefined
  // MapLibre's GeoJSON typings expect the DOM GeoJSON namespace; our FC is structurally compatible.
  if (src) src.setData(data as Parameters<GeoJSONSource['setData']>[0])
}

function ensureSources(map: MapLibreMap) {
  const ids = [
    SRC.journeys,
    SRC.storyTravels,
    SRC.letters,
    SRC.letterAlts,
    SRC.letterTips,
    'lr-letter-labels',
    SRC.prisons,
    SRC.cities,
  ]
  for (const id of ids) {
    if (!map.getSource(id)) {
      map.addSource(id, { type: 'geojson', data: EMPTY })
    }
  }
}

function ensureLayers(map: MapLibreMap) {
  if (!map.getLayer('journeys-line')) {
    map.addLayer({
      id: 'journeys-line',
      type: 'line',
      source: SRC.journeys,
      paint: {
        'line-color': '#5c4a38',
        'line-width': 2.4,
        'line-opacity': 0.45,
      },
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
    })
  }

  if (!map.getLayer('story-travels-land')) {
    map.addLayer({
      id: 'story-travels-land',
      type: 'line',
      source: SRC.storyTravels,
      filter: ['==', ['get', 'mode'], 'land'],
      paint: {
        'line-color': '#5c4a38',
        'line-width': 2.4,
        'line-opacity': ['case', ['==', ['get', 'live'], 1], 1, 0.45],
      },
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
    })
  }

  if (!map.getLayer('story-travels-sea')) {
    map.addLayer({
      id: 'story-travels-sea',
      type: 'line',
      source: SRC.storyTravels,
      filter: ['==', ['get', 'mode'], 'sea'],
      paint: {
        'line-color': '#2f5d6e',
        'line-width': 2.6,
        'line-opacity': ['case', ['==', ['get', 'live'], 1], 1, 0.45],
        'line-dasharray': [0.5, 2],
      },
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
    })
  }

  if (!map.getLayer('letter-alts-line')) {
    map.addLayer({
      id: 'letter-alts-line',
      type: 'line',
      source: SRC.letterAlts,
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 1.4,
        'line-opacity': 0.45,
        'line-dasharray': [2, 1.4],
      },
      layout: { 'line-cap': 'round' },
    })
  }

  if (!map.getLayer('letters-hit')) {
    map.addLayer({
      id: 'letters-hit',
      type: 'line',
      source: SRC.letters,
      paint: {
        'line-color': '#000000',
        'line-width': 16,
        'line-opacity': 0.01,
      },
    })
  }

  if (!map.getLayer('letters-line')) {
    map.addLayer({
      id: 'letters-line',
      type: 'line',
      source: SRC.letters,
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['get', 'lineWidth'],
        'line-opacity': ['get', 'opacity'],
        'line-dasharray': [2, 1.4],
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    })
  }

  if (!map.getLayer('letter-tips')) {
    map.addLayer({
      id: 'letter-tips',
      type: 'symbol',
      source: SRC.letterTips,
      layout: {
        'icon-image': 'lr-arrow',
        'icon-size': 0.55,
        'icon-rotate': ['get', 'bearing'],
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
      paint: {
        'icon-color': ['get', 'color'],
        'icon-opacity': ['get', 'opacity'],
      },
    })
  }

  if (!map.getLayer('letter-labels')) {
    map.addLayer({
      id: 'letter-labels',
      type: 'symbol',
      source: 'lr-letter-labels',
      layout: {
        'text-field': ['get', 'shortTitle'],
        'text-size': 12,
        'text-font': ['Noto Sans Bold'],
        'text-offset': [0, -0.8],
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'text-color': '#1a3344',
        'text-halo-color': 'rgba(255, 248, 238, 0.92)',
        'text-halo-width': 1.6,
        'text-opacity': ['get', 'opacity'],
      },
    })
  }

  if (!map.getLayer('prisons-square')) {
    map.addLayer({
      id: 'prisons-square',
      type: 'symbol',
      source: SRC.prisons,
      layout: {
        'icon-image': 'lr-prison',
        'icon-size': 0.7,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    })
  }

  if (!map.getLayer('cities-circle')) {
    map.addLayer({
      id: 'cities-circle',
      type: 'circle',
      source: SRC.cities,
      filter: ['!=', ['get', 'diamond'], 1],
      paint: {
        'circle-radius': ['get', 'radius'],
        'circle-color': [
          'case',
          ['==', ['get', 'planted'], 1],
          '#9a7b3c',
          '#f7f4ee',
        ],
        'circle-stroke-color': [
          'case',
          ['==', ['get', 'selected'], 1],
          '#e8c97a',
          '#2a3338',
        ],
        'circle-stroke-width': [
          'case',
          ['==', ['get', 'selected'], 1],
          2.4,
          1.3,
        ],
      },
    })
  }

  if (!map.getLayer('cities-diamond')) {
    map.addLayer({
      id: 'cities-diamond',
      type: 'symbol',
      source: SRC.cities,
      filter: ['==', ['get', 'diamond'], 1],
      layout: {
        'icon-image': 'lr-diamond',
        'icon-size': [
          'case',
          ['==', ['get', 'selected'], 1],
          0.85,
          0.7,
        ],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    })
  }

  if (!map.getLayer('cities-label')) {
    map.addLayer({
      id: 'cities-label',
      type: 'symbol',
      source: SRC.cities,
      filter: [
        'any',
        ['==', ['get', 'named'], 1],
        ['==', ['get', 'selected'], 1],
      ],
      layout: {
        'text-field': ['get', 'shortLabel'],
        'text-size': 12,
        'text-font': ['Noto Sans Bold'],
        'text-offset': [1.1, -0.7],
        'text-anchor': 'left',
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'text-color': [
          'case',
          ['==', ['get', 'selected'], 1],
          '#f7f4ee',
          '#1a3344',
        ],
        'text-halo-color': [
          'case',
          ['==', ['get', 'selected'], 1],
          'rgba(36, 63, 92, 0.85)',
          'rgba(255, 248, 238, 0.92)',
        ],
        'text-halo-width': 1.6,
      },
    })
  }
}

function addOverlayImages(map: MapLibreMap) {
  if (!map.hasImage('lr-diamond')) {
    map.addImage('lr-diamond', drawDiamond(28), { pixelRatio: 2 })
  }
  if (!map.hasImage('lr-arrow')) {
    map.addImage('lr-arrow', drawArrow(24), { pixelRatio: 2, sdf: true })
  }
  if (!map.hasImage('lr-prison')) {
    map.addImage('lr-prison', drawPrison(22), { pixelRatio: 2 })
  }
}

function drawDiamond(size: number): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const cx = size / 2
  const cy = size / 2
  const r = size * 0.38
  ctx.beginPath()
  ctx.moveTo(cx, cy - r)
  ctx.lineTo(cx + r * 0.78, cy)
  ctx.lineTo(cx, cy + r)
  ctx.lineTo(cx - r * 0.78, cy)
  ctx.closePath()
  ctx.fillStyle = '#243f5c'
  ctx.fill()
  ctx.strokeStyle = '#f7f4ee'
  ctx.lineWidth = 1.6
  ctx.stroke()
  return ctx.getImageData(0, 0, size, size)
}

function drawArrow(size: number): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  // Pointing up (north); MapLibre rotates via icon-rotate / bearing
  ctx.beginPath()
  ctx.moveTo(size / 2, 2)
  ctx.lineTo(size - 3, size - 3)
  ctx.lineTo(size / 2, size - 7)
  ctx.lineTo(3, size - 3)
  ctx.closePath()
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  return ctx.getImageData(0, 0, size, size)
}

function drawPrison(size: number): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const pad = 4
  ctx.strokeStyle = '#7a2e2e'
  ctx.lineWidth = 2
  ctx.strokeRect(pad, pad, size - pad * 2, size - pad * 2)
  return ctx.getImageData(0, 0, size, size)
}
