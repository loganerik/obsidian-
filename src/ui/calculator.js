// ── REFORM CALCULATOR ────────────────────────────────────────────────────────
// Renders toggleable reform cards and computes estimated economic impact using
// BEA RIMS II multipliers and HCD housing supply studies.

// METHODOLOGY (BEA RIMS II + HCD studies):
// suppressed_units_citywide = 700,000  (HCD 2022 RHNA gap estimate for LA City)
// per_reform_units = suppressed_units_citywide × reform.unit_multiplier × reform.feasibility_rate
// avg_unit_construction_value = $450,000 (LA median new construction 2023)
// construction_gdp_multiplier = 1.6 (BEA RIMS II regional multiplier)
// annual_rent_savings_per_unit = $12,000 (median LA rent differential with supply-adequate cities)
// household_spending_multiplier = 1.3
// total_gdp = (units × avg_unit_construction_value × construction_gdp_multiplier)
//           + (units × annual_rent_savings_per_unit × household_spending_multiplier)
// jobs = units × 6.7  (construction + induced, per BLS construction employment ratios)

const SUPPRESSED_UNITS_CITYWIDE    = 700_000;
const AVG_UNIT_CONSTRUCTION_VALUE  = 450_000;
const CONSTRUCTION_GDP_MULTIPLIER  = 1.6;
const ANNUAL_RENT_SAVINGS_PER_UNIT = 12_000;
const HOUSEHOLD_SPENDING_MULT      = 1.3;
const JOBS_PER_UNIT                = 6.7;

const METHODOLOGY_HTML = `
  <div class="modal-title">Reform Impact Methodology</div>
  <div class="modal-year">Sources: BEA RIMS II, HCD 2022 RHNA, BLS Construction Employment</div>
  <div class="modal-section">
    <div class="modal-section-title">SUPPRESSED UNIT BASELINE</div>
    <p>The citywide suppressed-unit baseline is <strong>700,000 units</strong>, drawn from the
    California HCD 2022 RHNA gap estimate for the City of Los Angeles. This represents the
    difference between projected household formation demand and currently zoned/permitted
    housing capacity through 2030.</p>
  </div>
  <div class="modal-section">
    <div class="modal-section-title">PER-REFORM UNIT UNLOCK</div>
    <p>Each reform releases a fraction of those suppressed units:</p>
    <pre style="font-family:var(--mono);font-size:11px;color:var(--text-dim);background:var(--surface2);padding:10px;border-radius:3px;margin-top:6px;line-height:1.6">
units = 700,000 × reform.unit_multiplier × reform.feasibility_rate</pre>
    <p style="margin-top:8px"><code>unit_multiplier</code> reflects the share of suppressed units
    each reform type could theoretically unlock. <code>feasibility_rate</code> discounts for
    political, financial, and land-use implementation barriers (0–1 scale).</p>
  </div>
  <div class="modal-section">
    <div class="modal-section-title">GDP IMPACT</div>
    <p>Two components are summed:</p>
    <pre style="font-family:var(--mono);font-size:11px;color:var(--text-dim);background:var(--surface2);padding:10px;border-radius:3px;margin-top:6px;line-height:1.6">
construction_gdp = units × $450,000 × 1.6  (BEA RIMS II regional multiplier)
rent_savings_gdp = units × $12,000  × 1.3  (household spending multiplier)
total_gdp        = construction_gdp + rent_savings_gdp</pre>
    <p style="margin-top:8px">The <strong>$450,000</strong> average construction value reflects LA County
    median new-build cost per unit (2023, RSMeans). The <strong>1.6×</strong> BEA RIMS II Type II
    multiplier captures induced and indirect regional economic activity. The <strong>$12,000</strong>
    annual rent saving per unit is the differential between LA median rent and rents in
    supply-adequate West Coast metros (Zillow, 2023). The <strong>1.3×</strong> household spending
    multiplier captures local recirculation of freed household income.</p>
  </div>
  <div class="modal-section">
    <div class="modal-section-title">JOBS CREATED</div>
    <p>Direct, indirect, and induced employment:</p>
    <pre style="font-family:var(--mono);font-size:11px;color:var(--text-dim);background:var(--surface2);padding:10px;border-radius:3px;margin-top:6px;line-height:1.6">
jobs = units × 6.7</pre>
    <p style="margin-top:8px">The <strong>6.7 jobs per unit</strong> ratio is derived from BLS
    Quarterly Census of Employment & Wages construction sector data for the Los Angeles–Long
    Beach MSA, combining on-site construction employment (≈4.2) with induced downstream jobs
    in materials, design, and services (≈2.5).</p>
  </div>
  <div class="modal-section">
    <div class="modal-section-title">STACKING &amp; OVERLAP</div>
    <p>When multiple reforms are selected, units are summed independently. This overstates
    impact if reforms target the same land parcels. A future version will apply a diminishing-
    returns overlap discount. Use combined totals as an upper-bound illustration.</p>
  </div>
  <div class="modal-section">
    <div class="modal-section-title">SOURCES</div>
    <ul>
      <li>U.S. Bureau of Economic Analysis — RIMS II Regional Multipliers (2023)</li>
      <li>California HCD — 6th Cycle RHNA Determination, City of LA (2022)</li>
      <li>U.S. Bureau of Labor Statistics — QCEW, Construction Sector, LA MSA (2023)</li>
      <li>Zillow Research — Rent Index, Metro Comparison (2023)</li>
      <li>RSMeans — Construction Cost Data, Los Angeles Region (2023)</li>
    </ul>
  </div>
`;

// ── Internal state ────────────────────────────────────────────────────────────

let _activeIds    = new Set();
let _reforms      = [];
let _onReformChange = null;
let _showModalFn  = null;  // injected from main.js via initCalculator

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcImpact(reforms) {
  let totalUnits = 0;
  for (const r of reforms) {
    totalUnits += SUPPRESSED_UNITS_CITYWIDE * (r.unit_multiplier || 0) * (r.feasibility_rate || 0);
  }
  totalUnits = Math.round(totalUnits);

  const constructionGDP = totalUnits * AVG_UNIT_CONSTRUCTION_VALUE * CONSTRUCTION_GDP_MULTIPLIER;
  const rentSavingsGDP  = totalUnits * ANNUAL_RENT_SAVINGS_PER_UNIT * HOUSEHOLD_SPENDING_MULT;
  const totalGDP        = constructionGDP + rentSavingsGDP;
  const jobs            = Math.round(totalUnits * JOBS_PER_UNIT);

  return { units: totalUnits, gdp: totalGDP, jobs };
}

function formatGDP(value) {
  if (value >= 1e9) {
    return '$' + (value / 1e9).toFixed(1) + 'B';
  }
  if (value >= 1e6) {
    return '$' + (value / 1e6).toFixed(1) + 'M';
  }
  return '$' + value.toLocaleString();
}

function formatNumber(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderReforms(listEl) {
  listEl.innerHTML = '';

  _reforms.forEach(reform => {
    const isActive = _activeIds.has(reform.id);

    const item = document.createElement('div');
    item.className = 'reform-item' + (isActive ? ' active' : '');
    item.dataset.id = reform.id;

    // Estimate impact for this single reform for the label
    const preview = calcImpact([reform]);

    item.innerHTML = `
      <div class="reform-top">
        <span class="reform-name">${reform.name}</span>
        <span class="reform-toggle" aria-label="Toggle reform"></span>
      </div>
      <div class="reform-impact">
        unlocks <span>~${formatNumber(preview.units)} units</span>
        &middot; ${(reform.feasibility_rate * 100).toFixed(0)}% feasibility
      </div>
    `;

    item.addEventListener('click', () => {
      if (_activeIds.has(reform.id)) {
        _activeIds.delete(reform.id);
      } else {
        _activeIds.add(reform.id);
      }
      item.classList.toggle('active', _activeIds.has(reform.id));
      recalcAndUpdate();
    });

    listEl.appendChild(item);
  });
}

function recalcAndUpdate() {
  const activeReforms = _reforms.filter(r => _activeIds.has(r.id));
  const { units, gdp, jobs } = calcImpact(activeReforms);

  const unitsEl = document.getElementById('reform-units');
  const gdpEl   = document.getElementById('reform-gdp');
  const jobsEl  = document.getElementById('reform-jobs');

  if (unitsEl) unitsEl.textContent = formatNumber(units);
  if (gdpEl)   gdpEl.textContent   = formatGDP(gdp);
  if (jobsEl)  jobsEl.textContent  = formatNumber(jobs);

  if (typeof _onReformChange === 'function') {
    _onReformChange(activeReforms, { units, gdp, jobs });
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function initCalculator({
  reformListEl,
  unitsEl,   // kept for backwards-compat but we look up by id internally
  gdpEl,
  jobsEl,
  resetBtn,
  reforms,
  onReformChange,
  showModal,   // optional: injected modal helper from main.js
}) {
  _reforms        = reforms || [];
  _activeIds      = new Set();
  _onReformChange = onReformChange || null;
  _showModalFn    = showModal || null;

  if (!reformListEl) {
    console.warn('[calculator] reformListEl not provided');
    return;
  }

  renderReforms(reformListEl);
  recalcAndUpdate();

  // Reset button
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetReforms();
    });
  }

  // Show-formula link — delegate to main.js modal if available
  const showFormulaLink = document.getElementById('show-formula');
  if (showFormulaLink) {
    showFormulaLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof _showModalFn === 'function') {
        _showModalFn(METHODOLOGY_HTML);
      } else {
        // Fallback: surface a basic alert if no modal wired yet
        const overlay = document.getElementById('modal-overlay');
        const content = document.getElementById('modal-content');
        if (overlay && content) {
          content.innerHTML = METHODOLOGY_HTML;
          overlay.classList.remove('hidden');
        }
      }
    });
  }
}

export function getActiveReforms() {
  return _reforms.filter(r => _activeIds.has(r.id));
}

export function resetReforms() {
  _activeIds.clear();
  // Update all card DOM states
  document.querySelectorAll('.reform-item').forEach(el => {
    el.classList.remove('active');
  });
  recalcAndUpdate();
}
