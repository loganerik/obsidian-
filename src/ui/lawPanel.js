/**
 * lawPanel.js — Law Browser and Law Detail Modal
 *
 * Renders law cards with search + level filtering, and generates full
 * detail modal HTML for any law object from the LAWS dataset.
 */

// ── HELPERS ───────────────────────────────────────────────────────────────────

/**
 * Safely coerces a value to a string for case-insensitive search.
 * @param {*} v
 * @returns {string}
 */
function str(v) {
  return v == null ? '' : String(v).toLowerCase()
}

/**
 * Returns true if `law` matches the search term across name, short, and mechanism.
 * @param {object} law
 * @param {string} term  — already lower-cased
 * @returns {boolean}
 */
function matchesSearch(law, term) {
  if (!term) return true
  return (
    str(law.name).includes(term) ||
    str(law.short).includes(term) ||
    str(law.mechanism).includes(term)
  )
}

/**
 * Returns true if `law` matches the level filter.
 * 'all' passes every law through.
 * @param {object} law
 * @param {string} level
 * @returns {boolean}
 */
function matchesLevel(law, level) {
  if (!level || level === 'all') return true
  return str(law.level) === level.toLowerCase()
}

// ── CARD RENDERER ─────────────────────────────────────────────────────────────

/**
 * Builds a single `.law-card` element for a law object.
 * @param {object} law
 * @param {function} onLawClick
 * @returns {HTMLElement}
 */
function buildLawCard(law, onLawClick) {
  const card = document.createElement('div')
  card.className = `law-card ${law.level || ''}`
  card.dataset.lawId = law.id || ''

  // Build type tags from mechanism and any other type hints
  const tags = []
  if (law.level)     tags.push(law.level.toUpperCase())
  if (law.type)      tags.push(String(law.type).toUpperCase())
  if (law.mechanism) {
    // Abbreviate long mechanism strings to a short tag
    const mech = String(law.mechanism)
    if (mech.length <= 30) {
      tags.push(mech.toUpperCase())
    } else {
      tags.push(mech.slice(0, 28).toUpperCase() + '…')
    }
  }
  // Dedupe tags
  const uniqueTags = [...new Set(tags)]

  const tagsHtml = uniqueTags
    .map(t => `<span class="law-tag">${t}</span>`)
    .join('')

  const year = law.year ?? law.enacted ?? '—'
  const name = law.name || 'Untitled Law'
  const sub  = law.short || ''

  card.innerHTML = `
    <div class="law-card-top">
      <span class="law-card-name">${name}</span>
      <span class="law-card-year">${year}</span>
    </div>
    ${sub ? `<div class="law-card-sub">${sub}</div>` : ''}
    ${tagsHtml ? `<div class="law-card-tags">${tagsHtml}</div>` : ''}
  `

  card.addEventListener('click', () => {
    if (typeof onLawClick === 'function') onLawClick(law)
  })

  return card
}

// ── FILTER + RENDER LIST ──────────────────────────────────────────────────────

/**
 * Filters `laws` by search term and level, then renders cards into `listEl`.
 * @param {HTMLElement} listEl
 * @param {Array<object>} laws
 * @param {string} searchTerm
 * @param {string} levelFilter
 * @param {function} onLawClick
 */
function renderList(listEl, laws, searchTerm, levelFilter, onLawClick) {
  listEl.innerHTML = ''
  const term = (searchTerm || '').toLowerCase().trim()

  const filtered = (laws || []).filter(
    (law) => matchesSearch(law, term) && matchesLevel(law, levelFilter)
  )

  if (filtered.length === 0) {
    const empty = document.createElement('div')
    empty.style.cssText =
      'font-family:var(--mono);font-size:10px;color:var(--text-faint);padding:12px 4px;text-align:center'
    empty.textContent = 'No laws match this filter.'
    listEl.appendChild(empty)
    return
  }

  for (const law of filtered) {
    listEl.appendChild(buildLawCard(law, onLawClick))
  }
}

// ── PUBLIC: INIT LAW PANEL ────────────────────────────────────────────────────

/**
 * Initialises the law browser panel — search, level filter, and card list.
 *
 * @param {object} opts
 * @param {HTMLElement}     opts.listEl      — #law-list container
 * @param {HTMLInputElement} opts.searchEl   — search input
 * @param {HTMLSelectElement} opts.filterEl  — level filter <select>
 * @param {Array<object>}   opts.laws        — full LAWS dataset
 * @param {function}        opts.onLawClick  — (law: object) => void
 */
export function initLawPanel({ listEl, searchEl, filterEl, laws, onLawClick }) {
  if (!listEl) {
    console.warn('[lawPanel] listEl not provided')
    return
  }

  let currentSearch = ''
  let currentLevel  = 'all'

  function refresh() {
    renderList(listEl, laws, currentSearch, currentLevel, onLawClick)
  }

  // Wire search input
  if (searchEl) {
    searchEl.addEventListener('input', () => {
      currentSearch = searchEl.value
      refresh()
    })
  }

  // Wire level filter
  if (filterEl) {
    filterEl.addEventListener('change', () => {
      currentLevel = filterEl.value || 'all'
      refresh()
    })
  }

  // Initial render
  refresh()
}

// ── PUBLIC: RENDER LAW MODAL ──────────────────────────────────────────────────

/**
 * Returns an HTML string for the full law detail modal.
 * Designed to be injected into #modal-content.
 *
 * Sections rendered (when data is present):
 *   - Name, year, level badge
 *   - Mechanism description
 *   - Tradeoffs list (caution-bordered)
 *   - Genuine harms prevented list (ok-bordered)
 *   - Metrics: delay_months, cost_per_unit, restriction_score
 *   - Sources list
 *
 * @param {object} law
 * @returns {string}
 */
export function renderLawModal(law) {
  if (!law) return '<p style="color:var(--text-dim)">No law data.</p>'

  const year    = law.year ?? law.enacted ?? '—'
  const level   = (law.level || 'local').toLowerCase()
  const name    = law.name || 'Untitled Law'
  const short   = law.short || ''

  // ── Level badge ───────────────────────────────────────────────────────────
  const levelLabel = level.toUpperCase()
  const levelBadge = `<span class="modal-level-badge ${level}">${levelLabel}</span>`

  // ── Mechanism section ─────────────────────────────────────────────────────
  const mechanismSection = law.mechanism
    ? `<div class="modal-section">
         <div class="modal-section-title">MECHANISM</div>
         <p>${law.mechanism}</p>
       </div>`
    : ''

  // ── Short summary ─────────────────────────────────────────────────────────
  const shortSection = short
    ? `<div class="modal-section">
         <div class="modal-section-title">SUMMARY</div>
         <p>${short}</p>
       </div>`
    : ''

  // ── Tradeoffs ─────────────────────────────────────────────────────────────
  let tradeoffsSection = ''
  const tradeoffs = Array.isArray(law.tradeoffs) ? law.tradeoffs : []
  if (tradeoffs.length > 0) {
    const items = tradeoffs
      .map(t => `<li>${t}</li>`)
      .join('')
    tradeoffsSection = `
      <div class="modal-section">
        <div class="modal-section-title">TRADEOFFS / COSTS</div>
        <div class="modal-tradeoff">
          <ul>${items}</ul>
        </div>
      </div>`
  }

  // ── Genuine harms prevented ───────────────────────────────────────────────
  let harmsSection = ''
  const harms = Array.isArray(law.genuine_harms_prevented)
    ? law.genuine_harms_prevented
    : (Array.isArray(law.harms_prevented) ? law.harms_prevented : [])
  if (harms.length > 0) {
    const items = harms
      .map(h => `<li>${h}</li>`)
      .join('')
    harmsSection = `
      <div class="modal-section">
        <div class="modal-section-title">GENUINE HARMS PREVENTED</div>
        <div class="modal-harm">
          <ul>${items}</ul>
        </div>
      </div>`
  }

  // ── Metrics ───────────────────────────────────────────────────────────────
  const metricRows = []

  if (law.delay_months != null) {
    metricRows.push(`
      <div class="modal-metric-row">
        <span class="modal-metric-key">Avg. Approval Delay</span>
        <span class="modal-metric-val">${law.delay_months} months</span>
      </div>`)
  }
  if (law.cost_per_unit != null) {
    const costFmt = Number(law.cost_per_unit) >= 1000
      ? '$' + (Number(law.cost_per_unit) / 1000).toFixed(1) + 'K'
      : '$' + Number(law.cost_per_unit).toLocaleString()
    metricRows.push(`
      <div class="modal-metric-row">
        <span class="modal-metric-key">Est. Cost per Unit Added</span>
        <span class="modal-metric-val">${costFmt}</span>
      </div>`)
  }
  if (law.restriction_score != null) {
    metricRows.push(`
      <div class="modal-metric-row">
        <span class="modal-metric-key">Restriction Score</span>
        <span class="modal-metric-val">${law.restriction_score} / 10</span>
      </div>`)
  }
  if (law.repealed != null) {
    metricRows.push(`
      <div class="modal-metric-row">
        <span class="modal-metric-key">Repealed / Superseded</span>
        <span class="modal-metric-val">${law.repealed}</span>
      </div>`)
  }

  const metricsSection = metricRows.length > 0
    ? `<div class="modal-section">
         <div class="modal-section-title">METRICS</div>
         ${metricRows.join('')}
       </div>`
    : ''

  // ── Sources ───────────────────────────────────────────────────────────────
  let sourcesSection = ''
  const sources = Array.isArray(law.sources) ? law.sources : []
  if (sources.length > 0) {
    const items = sources.map(s => {
      // If source looks like a URL, wrap in anchor
      const isUrl = /^https?:\/\//.test(s)
      return isUrl
        ? `<li><a href="${s}" target="_blank" rel="noopener" style="color:var(--gold-dim)">${s}</a></li>`
        : `<li>${s}</li>`
    }).join('')
    sourcesSection = `
      <div class="modal-section">
        <div class="modal-section-title">SOURCES</div>
        <ul>${items}</ul>
      </div>`
  }

  // ── Assemble ──────────────────────────────────────────────────────────────
  return `
    <div class="modal-title">${name}</div>
    <div class="modal-year">Enacted: ${year}</div>
    ${levelBadge}
    ${shortSection}
    ${mechanismSection}
    ${tradeoffsSection}
    ${harmsSection}
    ${metricsSection}
    ${sourcesSection}
  `.trim()
}
