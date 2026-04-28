/**
 * timeline.js — Year-slider driven timeline UI
 *
 * Manages the range slider, year display, and scrolling event feed.
 * Calls `onYearChange(year, activeLaws)` whenever the slider moves.
 */

// ── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Returns all laws that were in effect for the given year:
 *   enacted <= year  AND  (repealed === null OR repealed === undefined OR repealed > year)
 *
 * @param {Array<object>} laws
 * @param {number} year
 * @returns {Array<object>}
 */
export function getActiveLaws(laws, year) {
  if (!Array.isArray(laws)) return []
  return laws.filter((law) => {
    const enacted = Number(law.year ?? law.enacted)
    if (isNaN(enacted) || enacted > year) return false
    const repealed = law.repealed
    if (repealed === null || repealed === undefined) return true
    return Number(repealed) > year
  })
}

// ── RENDER HELPERS ───────────────────────────────────────────────────────────

/**
 * Builds a single `.event-item` div element.
 * @param {object} law
 * @returns {HTMLElement}
 */
function buildEventItem(law) {
  const div = document.createElement('div')
  div.className = `event-item ${law.level || 'local'}`
  div.dataset.lawId = law.id || law.name || ''

  const yearSpan = document.createElement('span')
  yearSpan.className = 'event-year'
  yearSpan.textContent = law.year ?? law.enacted ?? '—'

  const nameSpan = document.createElement('span')
  nameSpan.className = 'event-name'
  nameSpan.textContent = law.short || law.name || 'Unknown law'

  div.appendChild(yearSpan)
  div.appendChild(nameSpan)
  return div
}

/**
 * Renders up to `MAX_ITEMS` most-recent active laws into `eventsContainer`.
 * Items are sorted newest-first.
 * @param {HTMLElement} eventsContainer
 * @param {Array<object>} activeLaws
 */
function renderEvents(eventsContainer, activeLaws) {
  const MAX_ITEMS = 8

  // Sort newest first, then cap
  const sorted = [...activeLaws]
    .sort((a, b) => (b.year ?? b.enacted ?? 0) - (a.year ?? a.enacted ?? 0))
    .slice(0, MAX_ITEMS)

  // Diff-free re-render: clear then rebuild
  eventsContainer.innerHTML = ''
  for (const law of sorted) {
    eventsContainer.appendChild(buildEventItem(law))
  }

  if (sorted.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'event-item'
    empty.style.color = 'var(--text-faint)'
    empty.style.fontSize = '10px'
    empty.style.fontFamily = 'var(--mono)'
    empty.textContent = 'No active regulations'
    eventsContainer.appendChild(empty)
  }
}

// ── INIT ─────────────────────────────────────────────────────────────────────

/**
 * Initialises the timeline slider and event feed.
 *
 * @param {object} opts
 * @param {HTMLInputElement}  opts.slider          — <input type="range">
 * @param {HTMLElement}       opts.yearDisplay      — element to show current year text
 * @param {HTMLElement}       opts.eventsContainer  — container for .event-item nodes
 * @param {Array<object>}     opts.laws             — full laws dataset
 * @param {function}          opts.onYearChange     — (year: number, activeLaws: Array) => void
 */
export function initTimeline({ slider, yearDisplay, eventsContainer, laws, onYearChange }) {
  if (!slider) {
    console.warn('[timeline] slider element not provided')
    return
  }

  function handleChange() {
    const year = Number(slider.value)

    // Update year label
    if (yearDisplay) {
      yearDisplay.textContent = year
    }

    // Filter to laws active in this year
    const activeLaws = getActiveLaws(laws, year)

    // Update event feed
    if (eventsContainer) {
      renderEvents(eventsContainer, activeLaws)
    }

    // Notify parent
    if (typeof onYearChange === 'function') {
      onYearChange(year, activeLaws)
    }
  }

  // Wire up the slider
  slider.addEventListener('input', handleChange)

  // Run once on init so the display matches the slider's initial value
  handleChange()
}
