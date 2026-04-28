// ── MAIN ENTRY POINT ─────────────────────────────────────────────────────────
// Los Angeles: The Locked City — wires all modules together.
// Vite + vanilla JS, Leaflet maps, D3 charts, noir dark aesthetic.

import 'leaflet/dist/leaflet.css'
import './styles/noir.css'
import { LAWS } from './data/laws.js'
import { REFORMS } from './data/reforms.js'
import { ZIP_DATA } from './data/zipData.js'
import {
  initMap,
  addZipLayer,
  addZoningLayer,
  addHistoricLayer,
  addTransitLayer,
  addFireLayer,
  addRedlineLayer,
  flyToZip,
  loadLayerData,
} from './map/map.js'
import { initTimeline, getActiveLaws } from './ui/timeline.js'
import { initLawPanel, renderLawModal } from './ui/lawPanel.js'
import { initSidebar, updateSidebar } from './ui/sidebar.js'
import { initCalculator, getActiveReforms, resetReforms } from './ui/calculator.js'
import { initZipPanel, showZipDetail } from './ui/zipPanel.js'

// ── MODAL HELPER ──────────────────────────────────────────────────────────────

/**
 * Renders `htmlContent` inside #modal-box and makes #modal-overlay visible.
 * @param {string} htmlContent
 */
function showModal(htmlContent) {
  const overlay = document.getElementById('modal-overlay')
  const content = document.getElementById('modal-content')
  if (!overlay || !content) return
  content.innerHTML = htmlContent
  overlay.classList.remove('hidden')
}

// ── ZIP SEARCH HELPERS ────────────────────────────────────────────────────────

/**
 * Builds a reverse lookup: normalised neighborhood name → zip string.
 * Allows the search bar to accept neighborhood names as well as zip codes.
 */
function buildNameToZipMap() {
  const map = {}
  for (const [zip, data] of Object.entries(ZIP_DATA)) {
    if (data.name) {
      map[data.name.toLowerCase().trim()] = zip
    }
  }
  return map
}

/**
 * Resolves a raw query (zip number or neighborhood name fragment) to a zip
 * string present in ZIP_DATA, or null if nothing matches.
 * @param {string} query
 * @param {Object} nameToZip — pre-built name→zip map
 * @returns {string|null}
 */
function resolveZipQuery(query, nameToZip) {
  const q = query.trim()
  if (!q) return null

  // Exact zip match
  if (ZIP_DATA[q]) return q

  // Case-insensitive exact name match
  const lower = q.toLowerCase()
  if (nameToZip[lower]) return nameToZip[lower]

  // Partial name match — find first zip whose name includes the query
  for (const [normName, zip] of Object.entries(nameToZip)) {
    if (normName.includes(lower)) return zip
  }

  return null
}

// ── APP STATE ─────────────────────────────────────────────────────────────────

const state = {
  map: null,
  zipLayer: null,
  zoningLayer: null,
  historicLayer: null,
  transitLayer: null,
  fireLayer: null,
  redlineLayer: null,
  currentYear: 2024,
  activeLaws: [],
}

// ── BOOTSTRAP ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {

  // ── 1. Initialise map ──────────────────────────────────────────────────────
  state.map = initMap('map')

  // ── 2. Load ZIP layer ──────────────────────────────────────────────────────
  const zipGeoJSON = await loadLayerData('la-zipcodes')
  if (zipGeoJSON) {
    state.zipLayer = addZipLayer(state.map, zipGeoJSON, onZipClick)
  } else {
    console.warn('[main] la-zipcodes.geojson not found — zip layer disabled')
  }

  // ── 3. Load zoning layer (initially hidden until toggle is on) ─────────────
  const zoningGeoJSON = await loadLayerData('la-zoning')
  if (zoningGeoJSON) {
    state.zoningLayer = addZoningLayer(state.map, zoningGeoJSON, state.currentYear)
    // Zoning checkbox starts checked; respect initial state
    const zoningCheck = document.getElementById('layer-zoning')
    if (zoningCheck && !zoningCheck.checked) {
      state.map.removeLayer(state.zoningLayer)
    }
  } else {
    console.warn('[main] la-zoning.geojson not found — zoning layer disabled')
    // Uncheck the toggle since the layer is unavailable
    const zoningCheck = document.getElementById('layer-zoning')
    if (zoningCheck) zoningCheck.checked = false
  }

  // ── 4. Init timeline ───────────────────────────────────────────────────────
  const slider          = document.getElementById('timeline-slider')
  const yearDisplay     = document.getElementById('timeline-year-display')
  const eventsContainer = document.getElementById('timeline-events')

  initTimeline({
    slider,
    yearDisplay,
    eventsContainer,
    laws: LAWS,
    onYearChange(year, activeLaws) {
      state.currentYear = year
      state.activeLaws  = activeLaws
      updateSidebar({
        laws: LAWS,
        year,
        activeReforms: getActiveReforms(),
      })
    },
  })

  // ── 5. Init law panel ──────────────────────────────────────────────────────
  initLawPanel({
    listEl:      document.getElementById('law-list'),
    searchEl:    document.getElementById('law-search'),
    filterEl:    document.getElementById('law-filter-level'),
    laws:        LAWS,
    onLawClick(law) {
      showModal(renderLawModal(law))
    },
  })

  // ── 6. Init sidebar ────────────────────────────────────────────────────────
  initSidebar({ laws: LAWS, year: state.currentYear })

  // ── 7. Init calculator ────────────────────────────────────────────────────
  initCalculator({
    reformListEl:  document.getElementById('reform-list'),
    unitsEl:       document.getElementById('reform-units'),
    gdpEl:         document.getElementById('reform-gdp'),
    jobsEl:        document.getElementById('reform-jobs'),
    resetBtn:      document.getElementById('reform-reset'),
    reforms:       REFORMS,
    showModal,
    onReformChange(_activeReforms, _impact) {
      updateSidebar({
        laws:         LAWS,
        year:         state.currentYear,
        activeReforms: getActiveReforms(),
      })
    },
  })

  // ── 8. Init zip panel ─────────────────────────────────────────────────────
  initZipPanel()

  // ── INITIAL STATE ──────────────────────────────────────────────────────────
  // Trigger timeline at year 2024 so sidebar counts are populated from load.
  if (slider) {
    slider.value = '2024'
    slider.dispatchEvent(new Event('input'))
  }

  // Show a subtle hint in the zip badge area on first load.
  const badge     = document.getElementById('zip-badge')
  const badgeNum  = document.getElementById('badge-zip-num')
  const badgeName = document.getElementById('badge-zip-name')
  const badgeDens = document.getElementById('badge-zip-density')
  if (badge && badgeNum && badgeName && badgeDens) {
    badgeNum.textContent  = '—'
    badgeName.textContent = 'Click any ZIP code to explore'
    badgeDens.textContent = ''
    badge.classList.remove('hidden')
  }

  // ── WIRE UP EVENT LISTENERS ───────────────────────────────────────────────

  wireLayerToggles()
  wireZipSearch()
  wireNavPills()
  wireModalClose()
})

// ── ZIP CLICK HANDLER ────────────────────────────────────────────────────────

/**
 * Called when a zip boundary polygon is clicked on the map.
 * @param {object} feature — GeoJSON feature
 * @param {L.Layer} _layer
 */
function onZipClick(feature, _layer) {
  const props = feature.properties || {}
  const zip   = String(
    props.ZIPCODE || props.zipcode || props.zip || ''
  ).trim()

  if (!zip) return

  const zipData = ZIP_DATA[zip]
  if (zipData) {
    showZipDetail(zipData, state.activeLaws)
  } else {
    // Generic fallback for zips not in our dataset
    showZipDetail(
      {
        zip,
        name: 'Unknown Neighborhood',
        narrative: 'Detailed data for this ZIP code is not yet available in the dataset.',
      },
      state.activeLaws,
    )
  }
}

// ── LAYER TOGGLES ─────────────────────────────────────────────────────────────

function wireLayerToggles() {
  // Helper: bind a checkbox to show/hide a layer, loading it on first enable.
  function bindToggle(checkboxId, layerKey, loaderFn) {
    const checkbox = document.getElementById(checkboxId)
    if (!checkbox) return

    checkbox.addEventListener('change', async () => {
      if (checkbox.checked) {
        // Lazy-load the layer data the first time it is enabled
        if (!state[layerKey]) {
          const data = await loaderFn()
          if (!data) {
            console.warn(`[main] ${checkboxId}: GeoJSON not found — layer unavailable`)
            checkbox.checked = false
            return
          }
          // Store on state and add to map
          state[layerKey] = addLayerByKey(layerKey, data)
        } else {
          state[layerKey].addTo(state.map)
        }
      } else {
        if (state[layerKey]) {
          state.map.removeLayer(state[layerKey])
        }
      }
    })
  }

  // Zoning layer is special — already loaded in bootstrap, just toggle.
  const zoningCheck = document.getElementById('layer-zoning')
  if (zoningCheck) {
    zoningCheck.addEventListener('change', () => {
      if (!state.zoningLayer) return
      if (zoningCheck.checked) {
        state.zoningLayer.addTo(state.map)
      } else {
        state.map.removeLayer(state.zoningLayer)
      }
    })
  }

  bindToggle('layer-historic', 'historicLayer', () => loadLayerData('la-historic'))
  bindToggle('layer-transit',  'transitLayer',  () => loadLayerData('la-transit'))
  bindToggle('layer-fire',     'fireLayer',     () => loadLayerData('la-fire'))
  bindToggle('layer-redline',  'redlineLayer',  () => loadLayerData('la-redline'))
}

/**
 * Constructs the appropriate layer based on the state key name.
 * @param {string} key — state property name
 * @param {object} data — GeoJSON
 * @returns {L.GeoJSON}
 */
function addLayerByKey(key, data) {
  switch (key) {
    case 'historicLayer': return addHistoricLayer(state.map, data)
    case 'transitLayer':  return addTransitLayer(state.map, data)
    case 'fireLayer':     return addFireLayer(state.map, data)
    case 'redlineLayer':  return addRedlineLayer(state.map, data)
    default:
      console.warn('[main] addLayerByKey: unknown key', key)
      return null
  }
}

// ── ZIP SEARCH BAR ────────────────────────────────────────────────────────────

function wireZipSearch() {
  const nameToZip = buildNameToZipMap()

  function doSearch() {
    const input = document.getElementById('zip-input')
    if (!input) return
    const query = input.value.trim()
    if (!query) return

    const zip = resolveZipQuery(query, nameToZip)
    if (!zip) {
      // Visual feedback: briefly flash the input red
      input.style.color = 'var(--danger)'
      setTimeout(() => { input.style.color = '' }, 800)
      return
    }

    const zipData = ZIP_DATA[zip]
    if (!zipData) return

    // Fly map to the zip centroid if available
    if (zipData.lat != null && zipData.lng != null) {
      flyToZip(state.map, zipData.lat, zipData.lng, 13)
    }

    showZipDetail(zipData, state.activeLaws)
    input.value = ''
  }

  const goBtn  = document.getElementById('zip-go')
  const zipIn  = document.getElementById('zip-input')

  if (goBtn) goBtn.addEventListener('click', doSearch)

  if (zipIn) {
    zipIn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doSearch()
    })
  }
}

// ── NAV PILLS (visual only) ──────────────────────────────────────────────────

function wireNavPills() {
  document.querySelectorAll('.pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
    })
  })
}

// ── MODAL CLOSE ──────────────────────────────────────────────────────────────

function wireModalClose() {
  const closeBtn = document.getElementById('modal-close')
  const overlay  = document.getElementById('modal-overlay')

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      overlay?.classList.add('hidden')
    })
  }

  // Also close on overlay background click
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.add('hidden')
      }
    })
  }

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay && !overlay.classList.contains('hidden')) {
      overlay.classList.add('hidden')
    }
  })
}
