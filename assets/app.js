const DATA = {};
const files = {
  soil: "data/kyle_etj_soil_summary.json",
  lab: "data/lab_pedon_summary.json",
  habitat: "data/microbial_habitat_rulebook.json",
  taxa: "data/microbial_taxa_summary_v05.json",
  functions: "data/microbial_function_summary_v06.json",
  evidence: "data/evidence_grade_lookup.json",
  sources: "data/source_notes.json",
  teaching: "data/soil_food_web_teaching.json"
};

async function loadJSON(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load ${path}`);
  try { return await response.json(); }
  catch (err) { throw new Error(`${path} is not valid JSON: ${err.message}`); }
}

function fmt(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return value.toLocaleString();
  const parsed = Number(value);
  if (!Number.isNaN(parsed) && String(value).trim() !== "") return parsed.toLocaleString();
  return value;
}

function cell(value) {
  if (value === null || value === undefined || value === "") return "—";
  const text = String(value);
  return text.length > 140 ? `${text.slice(0, 140)}…` : text;
}

function renderTable(id, records, columns, limit = 50) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!records || !records.length) {
    el.innerHTML = `<p class="small">No records found in this package.</p>`;
    return;
  }
  const rows = records.slice(0, limit);
  const cols = columns && columns.length ? columns : Object.keys(rows[0]).slice(0, 8);
  el.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr>${cols.map(c => `<th>${c}</th>`).join("")}</tr></thead>
        <tbody>${rows.map(r => `<tr>${cols.map(c => `<td>${cell(r[c])}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
    </div>
    <p class="small">Showing ${Math.min(limit, records.length).toLocaleString()} of ${records.length.toLocaleString()} records.</p>`;
}

function renderStats() {
  const soilCount = DATA.soil?.summary?.record_count_in_public_subset || 0;
  const build = DATA.functions?.build_summary || {};
  document.getElementById("statCards").innerHTML = `
    <div class="stat"><div class="num">${fmt(soilCount)}</div><div class="label">soil records in public subset</div></div>
    <div class="stat"><div class="num">${fmt((DATA.taxa?.top_taxa || []).length)}</div><div class="label">top regional taxon rows</div></div>
    <div class="stat"><div class="num">${fmt(build.unique_ko_ids || 0)}</div><div class="label">unique KO IDs</div></div>
    <div class="stat"><div class="num">${fmt(build.unique_ec_ids || 0)}</div><div class="label">unique EC IDs</div></div>
    <div class="stat"><div class="num">${fmt(build.unique_product_names || 0)}</div><div class="label">unique product names</div></div>
    <div class="stat"><div class="num">${fmt(build.biosamples_with_function_data || 0)}</div><div class="label">biosamples with function data</div></div>`;
}

function renderFunctionCards() {
  const cats = DATA.functions?.function_categories || [];
  const translations = DATA.teaching?.function_translations || {};
  const el = document.getElementById("functionCards");
  if (!cats.length) {
    el.innerHTML = `<p class="small">No function category summary found.</p>`;
    return;
  }
  el.innerHTML = cats.map(c => {
    const raw = String(c.function_category || "function");
    const t = translations[raw] || {};
    const title = t.friendly_title || raw.replaceAll("_", " ");
    const meaning = t.plain_meaning || "Regional functional-potential signal.";
    return `
      <div class="meaning-card">
        <h3>${title}</h3>
        <p>${meaning}</p>
        <p class="small"><strong>Technical category:</strong> ${raw}</p>
        <div class="why"><strong>Regional gene/function hits:</strong> ${fmt(c.gene_hits)} · <strong>Biosamples:</strong> ${fmt(c.biosamples)}</div>
      </div>`;
  }).join("");
}

function renderEvidence() {
  renderTable("evidenceTable", DATA.evidence?.evidence_grades || [], ["grade", "label", "meaning", "dashboard_use"], 10);
  const src = DATA.sources || {};
  document.getElementById("sourceNotes").innerHTML = `
    <p><strong>Version:</strong> ${cell(src.version)}</p>
    <p><strong>Created:</strong> ${cell(src.created_utc)}</p>
    <div class="notice"><strong>Public warning:</strong> ${cell(src.public_warning)}</div>
    <h3>Dashboard rules</h3>
    <ul class="list-clean">${(src.dashboard_rules || []).map(x => `<li>${x}</li>`).join("")}</ul>`;
}

function filterSoils() {
  const q = document.getElementById("soilSearch").value.toLowerCase();
  const records = DATA.soil?.records || [];
  renderTable("soilTable", records.filter(r => JSON.stringify(r).toLowerCase().includes(q)), null, 75);
}

function switchTab(tab) {
  document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
  document.querySelector(`[data-tab="${tab}"]`).classList.add("active");
  document.querySelectorAll(".tab-panel").forEach(p => p.style.display = "none");
  document.getElementById(`panel-${tab}`).style.display = "block";
}

async function init() {
  try {
    const entries = await Promise.all(Object.entries(files).map(async ([k, p]) => [k, await loadJSON(p)]));
    entries.forEach(([k, v]) => DATA[k] = v);
    renderStats();
    renderFunctionCards();
    renderEvidence();
    renderTable("soilTable", DATA.soil?.records || [], null, 75);
    renderTable("labTable", DATA.lab?.records || [], null, 50);
    renderTable("taxaTable", DATA.taxa?.top_taxa || DATA.taxa?.consensus_taxa || [], null, 75);
    renderTable("koTable", DATA.functions?.top_ko || [], ["ko_id", "hits", "unique_genes", "mean_percent_identity", "max_bitscore"], 50);
    renderTable("ecTable", DATA.functions?.top_ec || [], ["ec_id", "hits", "unique_genes", "mean_percent_identity", "max_bitscore"], 50);
    renderTable("productTable", DATA.functions?.top_products || [], ["product_name", "gene_hits"], 75);
    document.getElementById("soilSearch").addEventListener("input", filterSoils);
    document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));
    switchTab("overview");
  } catch (err) {
    document.getElementById("appError").innerHTML = `<div class="notice"><strong>Load error:</strong> ${err.message}. If opening locally, run <span class="codeish">python -m http.server 8000</span> and open localhost.</div>`;
  }
}

init();
