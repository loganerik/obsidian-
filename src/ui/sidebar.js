/**
 * sidebar.js — Left sidebar stats: active restriction counts and suppression bar.
 *
 * DOM targets (must exist in index.html):
 *   #stat-federal   #stat-state   #stat-local   #stat-private
 *   #suppression-bar   — .suppression-bar-inner width (%)
 *   #suppression-pct   — text showing percentage
 *
 * Suppression formula:
 *   base_suppression  = min(active_laws.length / 120, 1) * 85
 *   reform_reduction  = activeReforms.reduce((sum, r) => sum + r.unit_multiplier, 0) * 100
 *   suppression_pct   = max(0, base_suppression - reform_reduction)
 *
 * The 120-law denominator calibrates so a "fully restricted" regime (~120 active
 * laws) reaches the 85% ceiling. The reform_reduction subtracts the aggregate
 * unit_multiplier contribution of all active reform toggles × 100, meaning a
 * reform with unit_multiplier 0.05 reduces suppression by 5 percentage points.
 */

import { getActiveLaws } from './timeline.js'

// ── SUPPRESSION MATH ──────────────────────────────────────────────────────────

/**
 * Computes the estimated suppression percentage.
 *
 * Formula (see file header):
 *   base_suppression = min(active_laws.length / 120, 1) * 85
 *   reform_reduction = activeReforms.reduce((sum, r) => sum + r.unit_multiplier, 0) * 100
 *   suppression_pct  = max(0, base_suppression - reform_reduction)
 *
 * @param {Array<object>} activeLaws    — laws active for current year
 * @param {Array<object>} activeReforms — currently enabled reform toggles
 * @returns {number}  — percentage value 0–85
 */
function calcSuppressionPct(activeLaws, activeReforms) {
  const BASE_DENOMINATOR = 120   // law count at which suppression peaks
  const BASE_CEILING     = 85    // maximum base suppression %

  const base_suppression = Math.min(activeLaws.length / BASE_DENOMINATOR, 1) * BASE_CEILING

  const reform_reduction = (activeReforms || []).reduce(
    (sum, r) => sum + (r.unit_multiplier || 0),
    0
  ) * 100

  return Math.max(0, base_suppression - reform_reduction)
}

// ── DOM HELPERS ───────────────────────────────────────────────────────────────

function setTextById(id, value) {
  const el = document.getElementById(id)
  if (el) el.textContent = value
}

function setWidthById(id, pct) {
  const el = document.getElementById(id)
  if (el) el.style.width = pct.toFixed(1) + '%'
}

// ── PUBLIC: DIRECT COUNT UPDATE ───────────────────────────────────────────────

/**
 * Directly sets the four stat counters. Useful for testing or when the
 * caller has pre-computed the breakdown.
 *
 * @param {number} federal
 * @param {number} state
 * @param {number} local
 * @param {number} priv     — named `priv` to avoid `private` reserved word
 */
export function updateLawCounts(federal, state, local, priv) {
  setTextById('stat-federal',  federal ?? 0)
  setTextById('stat-state',    state   ?? 0)
  setTextById('stat-local',    local   ?? 0)
  setTextById('stat-private',  priv    ?? 0)
}

// ── PUBLIC: FULL SIDEBAR UPDATE ───────────────────────────────────────────────

/**
 * Recomputes active law counts per level for the given year, updates the
 * four stat cells, and recalculates the suppression bar.
 *
 * @param {object} opts
 * @param {Array<object>}  opts.laws          — full LAWS dataset
 * @param {number}         opts.year          — current slider year
 * @param {Array<object>}  [opts.activeReforms] — enabled reform objects (default [])
 */
export function updateSidebar({ laws, year, activeReforms = [] }) {
  if (!Array.isArray(laws) || year == null) return

  const activeLaws = getActiveLaws(laws, year)

  // Bucket by level
  let federal = 0
  let state   = 0
  let local   = 0
  let priv    = 0

  for (const law of activeLaws) {
    switch ((law.level || '').toLowerCase()) {
      case 'federal':  federal++; break
      case 'state':    state++;   break
      case 'local':    local++;   break
      case 'private':  priv++;    break
      default:         local++;   break   // unknown → count as local
    }
  }

  updateLawCounts(federal, state, local, priv)

  // Suppression bar
  const pct = calcSuppressionPct(activeLaws, activeReforms)
  setWidthById('suppression-bar', pct)
  setTextById('suppression-pct', pct.toFixed(1) + '%')
}

// ── PUBLIC: INIT ──────────────────────────────────────────────────────────────

/**
 * Performs an initial render of the sidebar stats for the provided year.
 * Typically called once on app startup with the default slider year.
 *
 * @param {object} opts
 * @param {Array<object>} opts.laws  — full LAWS dataset
 * @param {number}        opts.year  — initial year
 */
export function initSidebar({ laws, year }) {
  updateSidebar({ laws, year, activeReforms: [] })
}
