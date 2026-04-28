import L from 'leaflet'

// ── ZONING COLOR MAP ────────────────────────────────────────────────────────
// Maps zone-type prefixes to fill colors drawn from the noir CSS palette.
// Keyed by canonical zone prefix; caller can match with zoneType.startsWith(key).
export const ZONING_COLORS = {
  // Single-family residential
  RE:   { fill: '#4a7a42', stroke: '#2e4a2a' }, // estate / very low density
  RS:   { fill: '#4a7a42', stroke: '#2e4a2a' }, // single-family standard
  R1:   { fill: '#4a7a42', stroke: '#2e4a2a' },
  // Low-medium multi-family
  RD:   { fill: '#2e5e82', stroke: '#1e3a52' }, // duplex / low multi
  R2:   { fill: '#2e5e82', stroke: '#1e3a52' },
  // Medium-high multi-family
  RAS:  { fill: '#1a5a78', stroke: '#0e3248' },
  R3:   { fill: '#1a5a78', stroke: '#0e3248' },
  R4:   { fill: '#0e4a6a', stroke: '#063040' },
  R5:   { fill: '#083a58', stroke: '#04202e' },
  // Commercial
  C1:   { fill: '#8a5a28', stroke: '#4a3018' },
  C1_5: { fill: '#8a5a28', stroke: '#4a3018' },
  C2:   { fill: '#9a6a30', stroke: '#5a3a20' },
  C4:   { fill: '#aa7838', stroke: '#6a4820' },
  C5:   { fill: '#ba8840', stroke: '#7a5828' },
  CR:   { fill: '#7a4a18', stroke: '#3a2808' },
  // Mixed-use / commercial-residential
  CM:   { fill: '#6a3a8a', stroke: '#3a1e4a' },
  MR:   { fill: '#7a4a9a', stroke: '#4a2a5a' },
  // Industrial
  M1:   { fill: '#8a2e2e', stroke: '#4a1e1e' },
  M2:   { fill: '#9a3838', stroke: '#5a2828' },
  M3:   { fill: '#aa4040', stroke: '#6a3030' },
  MR1:  { fill: '#8a3a3a', stroke: '#4a2a2a' },
  // Open space / public facility
  OS:   { fill: '#1a4a32', stroke: '#0e2a1e' },
  PF:   { fill: '#1a3a42', stroke: '#0e2030' },
  GW:   { fill: '#0e3228', stroke: '#081c14' },
  // Fallback
  DEFAULT: { fill: '#252538', stroke: '#11111c' },
}

// ── INTERNAL HELPERS ────────────────────────────────────────────────────────

/**
 * Returns fill/stroke colors for a zone type, optionally adjusted by year.
 * Pre-1960 zones are slightly desaturated to reflect historical uncertainty.
 * @param {string} zoneType
 * @param {number} year
 * @returns {{ fill: string, stroke: string }}
 */
function getZoningColor(zoneType, year) {
  const type = (zoneType || '').toUpperCase().replace(/-/g, '_')
  let entry = null

  for (const key of Object.keys(ZONING_COLORS)) {
    if (key === 'DEFAULT') continue
    if (type === key || type.startsWith(key)) {
      entry = ZONING_COLORS[key]
      break
    }
  }

  if (!entry) entry = ZONING_COLORS.DEFAULT

  // Subtle visual indicator for pre-1960 historical data
  if (year && year < 1960) {
    return { fill: entry.fill + 'bb', stroke: entry.stroke }
  }
  return entry
}

/**
 * Builds a Leaflet GeoJSON style function for zoning polygons.
 */
function zoningStyleFn(year) {
  return function (feature) {
    const zoneType = feature.properties?.ZONE_CLASS
      || feature.properties?.zone_class
      || feature.properties?.ZONE
      || feature.properties?.zone
      || ''
    const { fill, stroke } = getZoningColor(zoneType, year)
    return {
      fillColor: fill,
      color: stroke,
      weight: 0.5,
      opacity: 0.7,
      fillOpacity: 0.55,
    }
  }
}

// ── MAP INIT ────────────────────────────────────────────────────────────────

/**
 * Initialises a Leaflet map inside `containerId`.
 * @param {string} containerId  — DOM element id (without '#')
 * @returns {L.Map}
 */
export function initMap(containerId) {
  const map = L.map(containerId, {
    center: [34.0522, -118.2437],
    zoom: 11,
    // Roughly LA County bounding box
    maxBounds: L.latLngBounds(
      L.latLng(32.8, -119.0),  // SW
      L.latLng(34.9, -117.0),  // NE
    ),
    maxBoundsViscosity: 0.85,
    zoomControl: true,
    attributionControl: true,
  })

  L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors ' +
        '&copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    },
  ).addTo(map)

  return map
}

// ── LAYER ADDERS ────────────────────────────────────────────────────────────

/**
 * Adds colored zoning polygons for the given year.
 * @param {L.Map} map
 * @param {object} geojsonData
 * @param {number} year
 * @returns {L.GeoJSON}
 */
export function addZoningLayer(map, geojsonData, year) {
  const layer = L.geoJSON(geojsonData, {
    style: zoningStyleFn(year),
    onEachFeature(feature, lyr) {
      const props = feature.properties || {}
      const zone = props.ZONE_CLASS || props.zone_class || props.ZONE || props.zone || 'Unknown'
      lyr.bindTooltip(
        `<span style="font-family:var(--mono);font-size:11px;color:var(--gold)">${zone}</span>`,
        { sticky: true, className: 'leaflet-tooltip-noir' },
      )
    },
  }).addTo(map)
  return layer
}

/**
 * Adds zip code boundary polygons. Transparent fill with gold border.
 * Highlights on hover; calls `onClickFn(feature, layer)` on click.
 * @param {L.Map} map
 * @param {object} geojsonData
 * @param {function} onClickFn
 * @returns {L.GeoJSON}
 */
export function addZipLayer(map, geojsonData, onClickFn) {
  const defaultStyle = {
    color: '#c8a84b',        // --gold
    weight: 1,
    opacity: 0.6,
    fillColor: '#c8a84b',
    fillOpacity: 0,
  }
  const hoverStyle = {
    color: '#c8a84b',
    weight: 1.5,
    opacity: 0.9,
    fillColor: '#c8a84b',
    fillOpacity: 0.08,
  }

  const layer = L.geoJSON(geojsonData, {
    style: () => ({ ...defaultStyle }),
    onEachFeature(feature, lyr) {
      lyr.on({
        mouseover() {
          lyr.setStyle(hoverStyle)
          lyr.bringToFront()
        },
        mouseout() {
          layer.resetStyle(lyr)
        },
        click() {
          if (typeof onClickFn === 'function') onClickFn(feature, lyr)
        },
      })
      const zip = feature.properties?.ZIPCODE || feature.properties?.zipcode || feature.properties?.zip || ''
      if (zip) {
        lyr.bindTooltip(
          `<span style="font-family:var(--mono);font-size:12px;color:var(--gold)">${zip}</span>`,
          { sticky: true, className: 'leaflet-tooltip-noir' },
        )
      }
    },
  }).addTo(map)

  return layer
}

/**
 * Adds HPOZ (Historic Preservation Overlay Zone) polygons in purple.
 * @param {L.Map} map
 * @param {object} geojsonData
 * @returns {L.GeoJSON}
 */
export function addHistoricLayer(map, geojsonData) {
  const layer = L.geoJSON(geojsonData, {
    style: {
      color: '#9b59b6',
      weight: 1.5,
      opacity: 0.85,
      fillColor: '#6a3a8a',
      fillOpacity: 0.3,
      dashArray: '4 3',
    },
    onEachFeature(feature, lyr) {
      const name = feature.properties?.NAME || feature.properties?.name || 'HPOZ'
      lyr.bindTooltip(
        `<span style="font-family:var(--mono);font-size:11px;color:#9b59b6">HPOZ: ${name}</span>`,
        { sticky: true, className: 'leaflet-tooltip-noir' },
      )
    },
  }).addTo(map)
  return layer
}

/**
 * Adds transit corridor lines/polygons in blue.
 * @param {L.Map} map
 * @param {object} geojsonData
 * @returns {L.GeoJSON}
 */
export function addTransitLayer(map, geojsonData) {
  const layer = L.geoJSON(geojsonData, {
    style: (feature) => {
      const geomType = feature.geometry?.type || ''
      const isLine = geomType.includes('Line')
      return {
        color: '#4b8ac8',
        weight: isLine ? 3 : 1,
        opacity: 0.85,
        fillColor: '#2e5e82',
        fillOpacity: isLine ? 0 : 0.25,
      }
    },
    onEachFeature(feature, lyr) {
      const name = feature.properties?.NAME || feature.properties?.name || 'Transit Corridor'
      lyr.bindTooltip(
        `<span style="font-family:var(--mono);font-size:11px;color:#4b8ac8">${name}</span>`,
        { sticky: true, className: 'leaflet-tooltip-noir' },
      )
    },
  }).addTo(map)
  return layer
}

/**
 * Adds fire hazard severity zone polygons. High = red, moderate = orange.
 * @param {L.Map} map
 * @param {object} geojsonData
 * @returns {L.GeoJSON}
 */
export function addFireLayer(map, geojsonData) {
  const layer = L.geoJSON(geojsonData, {
    style: (feature) => {
      const severity = (
        feature.properties?.HAZ_CLASS ||
        feature.properties?.haz_class ||
        feature.properties?.SEVERITY ||
        feature.properties?.severity ||
        ''
      ).toString().toUpperCase()

      let fill = '#c84b4b'   // default: high hazard red
      let stroke = '#8a2e2e'
      if (severity.includes('MOD') || severity === '2') {
        fill = '#c88a4b'     // moderate: orange
        stroke = '#8a5a28'
      } else if (severity.includes('LOW') || severity === '1') {
        fill = '#c8aa4b'     // low: amber
        stroke = '#8a7830'
      }
      return {
        color: stroke,
        weight: 1,
        opacity: 0.7,
        fillColor: fill,
        fillOpacity: 0.35,
      }
    },
    onEachFeature(feature, lyr) {
      const cls = feature.properties?.HAZ_CLASS || feature.properties?.SEVERITY || 'Fire Hazard Zone'
      lyr.bindTooltip(
        `<span style="font-family:var(--mono);font-size:11px;color:#c84b4b">FHSZ: ${cls}</span>`,
        { sticky: true, className: 'leaflet-tooltip-noir' },
      )
    },
  }).addTo(map)
  return layer
}

/**
 * Adds 1939 HOLC redlining zone polygons.
 * Grade colours: A (green) B (blue) C (yellow) D (red).
 * @param {L.Map} map
 * @param {object} geojsonData
 * @returns {L.GeoJSON}
 */
export function addRedlineLayer(map, geojsonData) {
  const HOLC_COLORS = {
    A: { fill: '#2e7d32', stroke: '#1b5e20' }, // green — "Best"
    B: { fill: '#1565c0', stroke: '#0d47a1' }, // blue  — "Still Desirable"
    C: { fill: '#f9a825', stroke: '#f57f17' }, // yellow — "Definitely Declining"
    D: { fill: '#b71c1c', stroke: '#7f0000' }, // red   — "Hazardous"
  }
  const HOLC_LABELS = {
    A: 'A — Best',
    B: 'B — Still Desirable',
    C: 'C — Definitely Declining',
    D: 'D — Hazardous',
  }

  const layer = L.geoJSON(geojsonData, {
    style: (feature) => {
      const grade = (
        feature.properties?.holc_grade ||
        feature.properties?.HOLC_GRADE ||
        feature.properties?.grade ||
        ''
      ).toString().toUpperCase().trim()

      const colors = HOLC_COLORS[grade] || { fill: '#555577', stroke: '#333355' }
      return {
        color: colors.stroke,
        weight: 1,
        opacity: 0.8,
        fillColor: colors.fill,
        fillOpacity: 0.4,
      }
    },
    onEachFeature(feature, lyr) {
      const grade = (feature.properties?.holc_grade || feature.properties?.HOLC_GRADE || '?').toUpperCase()
      const label = HOLC_LABELS[grade] || `Grade ${grade}`
      const area = feature.properties?.area_description || feature.properties?.neighborhood || ''
      const tip = area
        ? `<b style="color:var(--gold)">${label}</b><br><span style="font-size:10px;color:var(--text-dim)">${area}</span>`
        : `<b style="color:var(--gold)">${label}</b>`
      lyr.bindPopup(
        `<div style="font-family:var(--sans);min-width:140px">${tip}</div>`,
      )
    },
  }).addTo(map)
  return layer
}

// ── NAVIGATION HELPERS ──────────────────────────────────────────────────────

/**
 * Smoothly flies the map to a lat/lng.
 * @param {L.Map} map
 * @param {number} lat
 * @param {number} lng
 * @param {number} [zoom=13]
 */
export function flyToZip(map, lat, lng, zoom = 13) {
  map.flyTo([lat, lng], zoom, {
    animate: true,
    duration: 1.2,
    easeLinearity: 0.25,
  })
}

/**
 * Highlights a specific zip code within a GeoJSON zip layer.
 * Resets all other features to default style.
 * @param {L.Map} map
 * @param {L.GeoJSON} zipLayer
 * @param {string|number} zipCode
 */
export function highlightZip(map, zipLayer, zipCode) {
  if (!zipLayer) return
  const targetZip = String(zipCode)

  zipLayer.eachLayer((lyr) => {
    const props = lyr.feature?.properties || {}
    const featureZip = String(
      props.ZIPCODE || props.zipcode || props.zip || ''
    )

    if (featureZip === targetZip) {
      lyr.setStyle({
        color: '#c8a84b',
        weight: 2.5,
        opacity: 1,
        fillColor: '#c8a84b',
        fillOpacity: 0.15,
      })
      lyr.bringToFront()
    } else {
      zipLayer.resetStyle(lyr)
    }
  })
}

// ── DATA LOADING STUB ───────────────────────────────────────────────────────

/**
 * Fetches a GeoJSON file from the public data directory.
 * Returns null if the file is missing — layers degrade gracefully.
 * @param {string} layerName  — filename without extension, e.g. 'zoning_2020'
 * @returns {Promise<object|null>}
 */
export async function loadLayerData(layerName) {
  // Returns null if file not found — layers degrade gracefully
  try {
    const res = await fetch(`./data/${layerName}.geojson`)
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}
