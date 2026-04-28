// ── ZIP PANEL ─────────────────────────────────────────────────────────────────
// Renders the right-sidebar detail view for a selected ZIP code, including
// stats, narrative, restrictions mapped to laws, and suppressed potential.

import { LAWS } from '../data/laws.js';

// Build a quick lookup map from law id → law object
function buildLawMap(lawsList) {
  const map = {};
  (lawsList || []).forEach(l => { map[l.id] = l; });
  return map;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n, fallback = '—') {
  if (n == null || n === undefined) return fallback;
  if (typeof n === 'number') return n.toLocaleString();
  return n;
}

function fmtDollar(n, fallback = '—') {
  if (n == null) return fallback;
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000)     return '$' + (n / 1_000).toFixed(1) + 'K';
  return '$' + n.toLocaleString();
}

function levelDotClass(level) {
  if (!level) return '';
  return level.toLowerCase();
}

// Simple proportional bar — returns an HTML string
function miniBar(actual, potential, label, unit = '') {
  const pct = potential > 0 ? Math.min(100, (actual / potential) * 100) : 0;
  const remainder = 100 - pct;
  return `
    <div style="margin-bottom:6px">
      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-dim);margin-bottom:4px">
        <span>${label}</span>
        <span style="font-family:var(--mono)">${actual}${unit} / ${potential}${unit}</span>
      </div>
      <div style="height:6px;background:var(--border2);border-radius:3px;overflow:hidden">
        <div style="width:${pct.toFixed(1)}%;height:100%;background:linear-gradient(90deg,var(--gold-dim),var(--gold));border-radius:3px;transition:width 0.5s ease"></div>
      </div>
      <div style="font-size:9px;color:var(--text-faint);margin-top:3px;text-align:right">
        ${remainder.toFixed(0)}% suppressed
      </div>
    </div>`;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function initZipPanel() {
  // Nothing to set up — panel lives in HTML.
  // Show the hint text initially (already in HTML). Nothing to do here unless
  // we want to pre-populate in the future.
}

export function showZipDetail(zipData, activeLaws) {
  if (!zipData) return;

  const lawMap = buildLawMap(LAWS);

  // ── Title ─────────────────────────────────────────────────────────────────
  const titleEl = document.getElementById('zip-panel-title');
  if (titleEl) {
    const label = zipData.name
      ? `${zipData.zip || ''} — ${zipData.name}`
      : (zipData.zip || 'ZIP DETAIL');
    titleEl.textContent = label.toUpperCase();
  }

  // ── Badge (map overlay) ───────────────────────────────────────────────────
  const badge      = document.getElementById('zip-badge');
  const badgeNum   = document.getElementById('badge-zip-num');
  const badgeName  = document.getElementById('badge-zip-name');
  const badgeDens  = document.getElementById('badge-zip-density');

  if (badgeNum)  badgeNum.textContent  = zipData.zip   || '—';
  if (badgeName) badgeName.textContent = zipData.name  || '—';
  if (badgeDens) {
    const density = zipData.avg_units_per_acre != null
      ? `${zipData.avg_units_per_acre} units/acre (current)`
      : '—';
    badgeDens.textContent = density;
  }
  if (badge) badge.classList.remove('hidden');

  // ── Detail content ────────────────────────────────────────────────────────
  const contentEl = document.getElementById('zip-detail-content');
  if (!contentEl) return;

  const sections = [];

  // 1. Stats grid
  const population    = zipData.population    != null ? fmt(zipData.population)    : '—';
  const housingUnits  = zipData.housing_units != null ? fmt(zipData.housing_units) : '—';
  const medianRent    = zipData.median_rent    != null ? fmtDollar(zipData.median_rent) : '—';
  const suppressedU   = zipData.suppressed_units != null ? fmt(zipData.suppressed_units) : '—';

  sections.push(`
    <div class="stat-grid">
      <div class="stat-cell">
        <div class="stat-num">${population}</div>
        <div class="stat-label">Population</div>
      </div>
      <div class="stat-cell">
        <div class="stat-num">${housingUnits}</div>
        <div class="stat-label">Housing Units</div>
      </div>
      <div class="stat-cell">
        <div class="stat-num">${medianRent}</div>
        <div class="stat-label">Median Rent/Mo</div>
      </div>
      <div class="stat-cell">
        <div class="stat-num" style="color:var(--danger)">${suppressedU}</div>
        <div class="stat-label">Suppressed Units</div>
      </div>
    </div>
  `);

  // 2. Narrative paragraph
  if (zipData.narrative) {
    sections.push(`<p class="zip-narrative">${zipData.narrative}</p>`);
  }

  // 3. Historical notes (gold left border)
  if (zipData.historical_notes) {
    sections.push(`
      <div style="border-left:3px solid var(--gold);padding-left:10px;margin:4px 0">
        <div style="font-family:var(--mono);font-size:9px;letter-spacing:0.15em;color:var(--gold-dim);margin-bottom:5px">HISTORICAL NOTES</div>
        <p style="font-size:11px;color:var(--text-dim);line-height:1.6">${zipData.historical_notes}</p>
      </div>
    `);
  }

  // 4. Built era badge
  if (zipData.built_era) {
    sections.push(`
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-family:var(--mono);font-size:9px;letter-spacing:0.12em;color:var(--text-dim)">BUILT ERA</span>
        <span style="font-family:var(--mono);font-size:11px;color:var(--gold);background:var(--gold-glow);border:1px solid var(--gold-dim);border-radius:2px;padding:2px 8px">${zipData.built_era}</span>
      </div>
    `);
  }

  // 5. Active restrictions — map key_restrictions → law names
  const keyRestrictions = zipData.key_restrictions || [];
  if (keyRestrictions.length > 0) {
    // Build a lookup from the currently active laws passed in (supplemented by LAWS)
    const activeLawMap = buildLawMap(activeLaws || []);

    const chips = keyRestrictions.map(id => {
      const law = activeLawMap[id] || lawMap[id];
      if (!law) {
        // Unknown id — show raw
        return `
          <div class="restriction-chip">
            <span class="chip-level"></span>
            <span>${id}</span>
          </div>`;
      }
      const levelClass = levelDotClass(law.level);
      return `
        <div class="restriction-chip">
          <span class="chip-level ${levelClass}"></span>
          <span>${law.name}${law.enacted ? ` (${law.enacted})` : ''}</span>
        </div>`;
    }).join('');

    sections.push(`
      <div>
        <div style="font-family:var(--mono);font-size:9px;letter-spacing:0.15em;color:var(--text-dim);margin-bottom:5px">ACTIVE RESTRICTIONS</div>
        <div class="restriction-list">${chips}</div>
      </div>
    `);
  }

  // 6. "What Would Be Built Here" — bar comparison of current vs organic potential
  const currentDensity   = zipData.avg_units_per_acre          || 0;
  const potentialDensity = zipData.organic_potential_units_per_acre || 0;
  if (potentialDensity > 0) {
    sections.push(`
      <div>
        <div style="font-family:var(--mono);font-size:9px;letter-spacing:0.15em;color:var(--text-dim);margin-bottom:8px">WHAT WOULD BE BUILT HERE</div>
        ${miniBar(currentDensity, potentialDensity, 'Current vs Potential Density', ' u/ac')}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px">
          <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:8px;text-align:center">
            <div style="font-family:var(--mono);font-size:16px;color:var(--text)">${currentDensity}</div>
            <div style="font-size:10px;color:var(--text-dim);margin-top:2px">units/acre today</div>
          </div>
          <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:8px;text-align:center">
            <div style="font-family:var(--mono);font-size:16px;color:var(--gold)">${potentialDensity}</div>
            <div style="font-size:10px;color:var(--text-dim);margin-top:2px">units/acre potential</div>
          </div>
        </div>
      </div>
    `);
  }

  // 7. Suppressed potential metric
  if (zipData.suppressed_units != null) {
    const orgUnits    = zipData.organic_potential_units || 0;
    const actualUnits = zipData.housing_units            || 0;
    const suppressed  = zipData.suppressed_units;
    const pct = orgUnits > 0
      ? Math.min(100, (suppressed / orgUnits) * 100).toFixed(0)
      : null;

    sections.push(`
      <div>
        <div style="font-family:var(--mono);font-size:9px;letter-spacing:0.15em;color:var(--text-dim);margin-bottom:6px">SUPPRESSED POTENTIAL</div>
        <div style="background:var(--surface2);border:1px solid var(--border);border-left:3px solid var(--danger);border-radius:var(--radius);padding:10px 12px">
          <div style="font-family:var(--mono);font-size:22px;color:var(--danger);line-height:1;margin-bottom:4px">
            ${fmt(suppressed)} units
          </div>
          <div style="font-size:11px;color:var(--text-dim);line-height:1.5">
            ${pct != null ? `≈ ${pct}% of organic development potential blocked by current regulation.` : ''}
            ${actualUnits > 0 ? `Current stock: ${fmt(actualUnits)} units.` : ''}
            ${orgUnits > 0 ? ` Unrestricted market could support ${fmt(orgUnits)} units.` : ''}
          </div>
        </div>
      </div>
    `);
  }

  contentEl.innerHTML = sections.join('');
}
