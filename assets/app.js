const DATA = {};
const files = {
  soil: "data/kyle_etj_soil_summary.json",
  lab: "data/lab_pedon_summary.json",
  habitat: "data/microbial_habitat_rulebook.json",
  taxa: "data/microbial_taxa_summary_v05.json",
  functions: "data/microbial_function_summary_v06.json",
  evidence: "data/evidence_grade_lookup.json",
  sources: "data/source_notes.json",
  teaching: "data/soil_food_web_teaching.json",
  storyRules: "data/public_soil_story_rules.json"
};

function esc(value) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value).replace(/[&<>'"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[ch]));
}

async function loadJSON(key, path) {
  const fallback = window.HAYS_RESEARCH_DATA?.[key];
  if (fallback !== undefined && location.protocol === "file:") return fallback;
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Could not load ${path}`);
    return await response.json();
  } catch (err) {
    if (fallback !== undefined) return fallback;
    throw err;
  }
}

function fmt(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "number") return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 3 });
  const parsed = Number(value);
  if (!Number.isNaN(parsed) && String(value).trim() !== "") return parsed.toLocaleString(undefined, { maximumFractionDigits: 3 });
  return String(value);
}

function cell(value, limit = 140) {
  if (value === null || value === undefined || value === "") return "-";
  const text = String(value);
  return esc(text.length > limit ? `${text.slice(0, limit)}...` : text);
}

function numberValue(record, key) {
  const value = record?.[key];
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function plainSoilType(record) {
  const parts = [];
  const clay = numberValue(record, "claytotal_r_surface_0_30cm");
  const ph = numberValue(record, "ph1to1h2o_r_surface_0_30cm");
  const caco3 = numberValue(record, "caco3_r_surface_0_30cm");
  const restriction = numberValue(record, "restriction_depth_cm");
  const text = JSON.stringify(record || {}).toLowerCase();
  if ((ph !== null && ph >= 7.4) || (caco3 !== null && caco3 >= 5) || /limestone|calcareous|carbonate/.test(text)) parts.push("limestone/alkaline");
  if ((clay !== null && clay >= 50)) parts.push("heavy clay");
  else if ((clay !== null && clay >= 35) || text.includes("clay")) parts.push("clayey");
  else if (/loam|loamy/.test(text)) parts.push("loamy");
  if ((restriction !== null && restriction <= 50) || /shallow|rock outcrop|lithic/.test(text)) parts.push("shallow/rocky");
  if (record?.true_wet_flood_flag === true) parts.push("true wet/flood-pulse");
  else if (record?.clay_redox_microsites_flag === true) parts.push("clay wet-dry pockets");
  return parts.length ? parts.join(" ") : "mapped soil";
}

function evidencePlain(text) {
  const value = String(text || "");
  if (/no confirmed taxa/i.test(value)) return "Prediction only; no local microbe test.";
  if (/inferred/i.test(value)) return "Inferred from mapped soil properties.";
  if (/regional/i.test(value)) return "Regional evidence, not site confirmation.";
  return value || "Evidence level not listed.";
}

function columnHeader(c) {
  return typeof c === "string" ? c : c.label;
}

function columnValue(c, row) {
  if (typeof c === "string") return row[c];
  if (typeof c.value === "function") return c.value(row);
  return row[c.key];
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
        <thead><tr>${cols.map(c => `<th>${esc(columnHeader(c))}</th>`).join("")}</tr></thead>
        <tbody>${rows.map(r => `<tr>${cols.map(c => `<td>${cell(columnValue(c, r), 170)}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
    </div>
    <p class="small">Showing ${Math.min(limit, records.length).toLocaleString()} of ${records.length.toLocaleString()} records.</p>`;
}

function renderStats() {
  const soilCount = DATA.soil?.summary?.record_count_in_public_subset || (DATA.soil?.records || []).length || 0;
  const build = DATA.functions?.build_summary || {};
  const functionCats = (DATA.functions?.function_categories || []).length;
  const taxaRows = (DATA.taxa?.top_taxa || []).length;
  const evidenceGrades = (DATA.evidence?.evidence_grades || []).length;
  document.getElementById("statCards").innerHTML = `
    <div class="stat"><div class="num">${fmt(soilCount)}</div><div class="label">local soil records in public subset</div></div>
    <div class="stat"><div class="num">${fmt(functionCats)}</div><div class="label">plain microbe-job groups</div></div>
    <div class="stat"><div class="num">${fmt(taxaRows)}</div><div class="label">regional microbe-name rows</div></div>
    <div class="stat"><div class="num">${fmt(build.biosamples_with_function_data || 0)}</div><div class="label">regional biosamples with function data</div></div>
    <div class="stat"><div class="num">${fmt(evidenceGrades)}</div><div class="label">evidence levels</div></div>`;
}

function functionTranslation(raw) {
  const translations = DATA.teaching?.function_translations || {};
  const t = translations[raw] || {};
  const fallbackTitles = {
    transport_secretion: "Cell exchange",
    phosphorus_cycle: "Nutrient unlockers",
    metal_iron: "Mineral workers",
    stress_drought_heat: "Drought survivors",
    motility_biofilm: "Root-zone settlers",
    sulfur_cycle: "Nutrient movers",
    nitrogen_cycle: "Nitrogen changers",
    carbon_decomposition: "Recyclers",
    carbon_fixation: "Carbon capturers"
  };
  const fallbackMeanings = {
    transport_secretion: "Microbes move food, minerals, and signals in and out of cells.",
    phosphorus_cycle: "Microbes may help make phosphorus easier for roots to use, especially in limestone soils.",
    metal_iron: "Microbes interact with iron and other minerals in the soil.",
    stress_drought_heat: "Some microbes are built to survive heat, drying, and wet-dry swings.",
    motility_biofilm: "Microbes can move, stick to surfaces, and form slimy communities near roots or soil particles.",
    sulfur_cycle: "Microbes help move sulfur through different chemical forms.",
    nitrogen_cycle: "Microbes change nitrogen from one form to another.",
    carbon_decomposition: "Microbes break down dead roots, leaves, mulch, and compost.",
    carbon_fixation: "Some microbes may capture carbon, but this should be interpreted cautiously."
  };
  return {
    title: t.friendly_title || fallbackTitles[raw] || raw.replaceAll("_", " "),
    meaning: t.plain_meaning || fallbackMeanings[raw] || "Regional functional-potential signal.",
    caution: "This means possible genetic capacity in regional data. It does not prove local activity at one exact site."
  };
}

function renderFunctionCards(targetId = "functionCards") {
  const cats = DATA.functions?.function_categories || [];
  const el = document.getElementById(targetId);
  if (!el) return;
  if (!cats.length) {
    el.innerHTML = `<p class="small">No function category summary found.</p>`;
    return;
  }
  el.innerHTML = cats.map(c => {
    const raw = String(c.function_category || "function");
    const t = functionTranslation(raw);
    return `
      <div class="meaning-card">
        <h3>${esc(t.title)}</h3>
        <p>${esc(t.meaning)}</p>
        <p class="small"><strong>Careful wording:</strong> ${esc(t.caution)}</p>
        <details class="details-lite mini-details">
          <summary>Technical count</summary>
          <div class="details-body">
            <p><strong>Technical category:</strong> <span class="codeish">${esc(raw)}</span></p>
            <p><strong>Regional gene/function hits:</strong> ${fmt(c.gene_hits)}<br/><strong>Biosamples:</strong> ${fmt(c.biosamples)}</p>
          </div>
        </details>
      </div>`;
  }).join("");
}

function renderJobCards() {
  renderFunctionCards("jobCards");
}

function renderClaimChecker() {
  const can = DATA.teaching?.what_the_dashboard_can_say || [
    "This soil setting may support certain soil-life functions.",
    "Mapped soil conditions may favor some microbial job groups.",
    "Regional data support cautious interpretation."
  ];
  const cannot = DATA.teaching?.what_the_dashboard_should_not_say || [
    "This exact yard has these microbes.",
    "This exact plant root has this exact partner.",
    "Gene potential proves activity."
  ];
  const canEl = document.getElementById("canSayList");
  const notEl = document.getElementById("shouldNotSayList");
  if (canEl) canEl.innerHTML = can.map(x => `<li>${esc(x)}</li>`).join("");
  if (notEl) notEl.innerHTML = cannot.map(x => `<li>${esc(x)}</li>`).join("");
}

function renderEvidence() {
  const grades = DATA.evidence?.evidence_grades || [];
  const cards = document.getElementById("evidenceCards");
  if (cards) {
    cards.innerHTML = grades.map(g => `
      <div class="meaning-card">
        <h3>${esc(g.grade)}: ${esc(g.label)}</h3>
        <p>${esc(g.meaning)}</p>
        <p class="small"><strong>Use:</strong> ${esc(g.dashboard_use)}</p>
      </div>`).join("");
  }
  renderTable("evidenceTable", grades, ["grade", "label", "meaning", "dashboard_use"], 10);
  const src = DATA.sources || {};
  const sourceNotes = document.getElementById("sourceNotes");
  if (sourceNotes) {
    sourceNotes.innerHTML = `
      <p><strong>Project:</strong> ${cell(src.project)}</p>
      <p><strong>Version:</strong> ${cell(src.version)}</p>
      <p><strong>Created:</strong> ${cell(src.created_utc)}</p>
      <div class="notice"><strong>Public warning:</strong> ${cell(src.public_warning, 500)}</div>
      <h3>Dashboard rules</h3>
      <ul class="list-clean">${(src.dashboard_rules || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      <p class="small"><strong>Source manifest:</strong> ${cell(src.source_manifest || "data/source_manifest.json")}</p>`;
  }
}

function renderTaxaSummary() {
  const el = document.getElementById("taxaSummary");
  if (!el) return;
  const consensus = DATA.taxa?.consensus_taxa || [];
  const top = DATA.taxa?.top_taxa || [];
  const ranks = [...new Set(top.map(x => x.taxon_rank_normalized).filter(Boolean))].slice(0, 8);
  const examples = top.slice(0, 6).map(x => x.taxon_name).filter(Boolean);
  el.innerHTML = `
    <div class="meaning-card">
      <h3>What names can tell us</h3>
      <p>They show which broad microbe groups appeared in regional datasets.</p>
    </div>
    <div class="meaning-card">
      <h3>What names cannot prove</h3>
      <p>They do not prove that the same microbe is living at one exact Hays/Kyle location.</p>
    </div>
    <div class="meaning-card">
      <h3>Taxonomic levels included</h3>
      <p>${ranks.length ? esc(ranks.join(", ")) : "Ranks not listed."}</p>
    </div>
    <div class="meaning-card">
      <h3>Example regional names</h3>
      <p>${examples.length ? esc(examples.join(", ")) : "Examples not listed."}</p>
      <p class="small">Consensus rows: ${fmt(consensus.length)}. Top taxa rows: ${fmt(top.length)}.</p>
    </div>`;
}

function filterSoils() {
  const q = (document.getElementById("soilSearch")?.value || "").toLowerCase();
  const records = DATA.soil?.records || [];
  const filtered = records.filter(r => JSON.stringify(r).toLowerCase().includes(q));
  renderSoilTables(filtered);
}

function renderSoilTables(records = DATA.soil?.records || []) {
  const simpleCols = [
    { label: "Soil name", key: "muname" },
    { label: "Component", key: "compname" },
    { label: "Soil habitat", value: r => r.simple_soil_habitat_type || plainSoilType(r) },
    { label: "Texture", key: "surface_texture_description" },
    { label: "Drainage", key: "drainagecl" },
    { label: "Runoff", key: "runoff" },
    { label: "pH", key: "ph1to1h2o_r_surface_0_30cm" },
    { label: "CaCO3 %", key: "caco3_r_surface_0_30cm" },
    { label: "Organic matter %", key: "om_r_surface_0_30cm" },
    { label: "Plant clue", key: "existing_plant_indicators_top10" },
    { label: "Root meaning", key: "plain_root_meaning" },
    { label: "Microbe jobs", key: "plain_microbe_jobs" },
    { label: "Evidence", value: r => evidencePlain(r.microbe_confidence_grade || r.confirmed_taxa_status) }
  ];
  renderTable("soilSimpleTable", records, simpleCols, 75);
  renderTable("soilTable", records, null, 75);
}

function switchTab(tab) {
  document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
  const active = document.querySelector(`[data-tab="${tab}"]`);
  if (active) active.classList.add("active");
  document.querySelectorAll(".tab-panel").forEach(p => p.style.display = "none");
  const panel = document.getElementById(`panel-${tab}`);
  if (panel) panel.style.display = "block";
}

async function init() {
  try {
    const entries = await Promise.all(Object.entries(files).map(async ([k, p]) => [k, await loadJSON(k, p)]));
    entries.forEach(([k, v]) => DATA[k] = v);
    renderStats();
    renderClaimChecker();
    renderFunctionCards();
    renderJobCards();
    renderEvidence();
    renderTaxaSummary();
    renderSoilTables();
    renderTable("labTable", DATA.lab?.records || [], null, 50);
    renderTable("habitatTable", DATA.habitat?.rules || [], ["rule_id", "trigger", "likely_guild", "functions", "confidence_basis"], 50);
    renderTable("taxaTable", DATA.taxa?.top_taxa || DATA.taxa?.consensus_taxa || [], ["taxon_rank_normalized", "taxon_name", "detections", "unique_biosamples", "evidence_scope"], 75);
    renderTable("koTable", DATA.functions?.top_ko || [], ["ko_id", "hits", "unique_genes", "mean_percent_identity", "max_bitscore"], 50);
    renderTable("ecTable", DATA.functions?.top_ec || [], ["ec_id", "hits", "unique_genes", "mean_percent_identity", "max_bitscore"], 50);
    renderTable("productTable", DATA.functions?.top_products || [], ["product_name", "gene_hits"], 75);
    const soilSearch = document.getElementById("soilSearch");
    if (soilSearch) soilSearch.addEventListener("input", filterSoils);
    const clear = document.getElementById("soilClear");
    if (clear) clear.addEventListener("click", () => { soilSearch.value = ""; filterSoils(); });
    document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));
    switchTab("summary");
  } catch (err) {
    document.getElementById("appError").innerHTML = `<div class="notice"><strong>Load error:</strong> ${esc(err.message)}. The package includes embedded fallback data. If the page still does not load, use GitHub Pages or run <span class="codeish">python -m http.server 8000</span> and open localhost.</div>`;
  }
}

init();
