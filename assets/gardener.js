const G = {};
const files = {
  soil: "data/kyle_etj_soil_summary.json",
  functions: "data/microbial_function_summary_v06.json",
  beginner: "data/beginner_copy.json",
  glossary: "data/gardener_glossary.json"
};

async function loadJSON(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load ${path}`);
  try { return await response.json(); }
  catch (e) { throw new Error(`${path} is not valid JSON: ${e.message}`); }
}

function fmt(n) {
  if (n === null || n === undefined || n === "") return "—";
  if (typeof n === "number") return n.toLocaleString();
  const parsed = Number(n);
  if (!Number.isNaN(parsed) && String(n).trim() !== "") return parsed.toLocaleString();
  return n;
}

function cell(v) {
  if (v === null || v === undefined || v === "") return "—";
  const s = String(v);
  return s.length > 180 ? `${s.slice(0,180)}…` : s;
}

function renderBeginnerSteps() {
  const steps = G.beginner?.start_here || [];
  document.getElementById("beginnerSteps").innerHTML = steps.map(s => `
    <div class="simple-card">
      <h3>${s.title}</h3>
      <p>${s.plain}</p>
      <div class="why"><strong>Why it matters:</strong> ${s.why_it_matters}</div>
    </div>
  `).join("");
}

function renderPlainTerms() {
  const terms = G.beginner?.plain_terms || [];
  document.getElementById("plainTerms").innerHTML = terms.map(t => `
    <div class="simple-card">
      <h3>${t.term}</h3>
      <p>${t.plain}</p>
    </div>
  `).join("");
}

function renderDecisionCards() {
  const cards = G.beginner?.decision_cards || [];
  document.getElementById("decisionCards").innerHTML = cards.map(c => `
    <div class="simple-card">
      <h3>${c.situation}</h3>
      <p>${c.think_about}</p>
    </div>
  `).join("");
}

function renderBenefits() {
  const cards = G.glossary?.benefit_cards || [];
  document.getElementById("benefitCards").innerHTML = cards.map(c => `
    <div class="simple-card">
      <h3>${c.benefit}</h3>
      <p>${c.plain_language}</p>
      <div class="why"><strong>In the data, this may show up as:</strong> ${c.look_for}</div>
    </div>
  `).join("");
}

function renderFunctionSignals() {
  const cats = G.functions?.function_categories || [];
  const friendly = {
    "transport_secretion": ["Moving nutrients and signals", "Microbes need to move materials in and out of cells. This is basic living-soil activity."],
    "phosphorus_cycle": ["Phosphorus availability", "Phosphorus helps roots, flowers, seeds, and plant energy. Soil life can affect how available it is."],
    "metal_iron": ["Iron and minerals", "Microbes interact with iron and other minerals, which can affect soil chemistry."],
    "stress_drought_heat": ["Stress tolerance", "Some genes suggest microbes may handle heat, drought, or other tough conditions."],
    "motility_biofilm": ["Soil structure and biofilms", "Biofilms and movement can help microbes live around roots and soil particles."],
    "sulfur_cycle": ["Sulfur cycling", "Sulfur is a plant nutrient and part of soil chemistry."],
    "nitrogen_cycle": ["Nitrogen cycling", "Nitrogen is important for leafy green growth. Soil microbes help transform it."],
    "carbon_decomposition": ["Organic matter breakdown", "This is how dead leaves, roots, and mulch become part of the soil food web."],
    "carbon_fixation": ["Carbon capture potential", "Some microbes have genes related to capturing carbon, but this does not prove carbon storage by itself."]
  };

  document.getElementById("gardenerFunctionCards").innerHTML = cats.slice(0, 9).map(c => {
    const f = friendly[c.function_category] || [String(c.function_category).replaceAll("_", " "), "Regional functional-potential signal."];
    return `
      <div class="simple-card">
        <h3>${f[0]}</h3>
        <p>${f[1]}</p>
        <div class="why"><strong>Regional gene hits:</strong> ${fmt(c.gene_hits)}</div>
      </div>
    `;
  }).join("");
}

function simpleSoilSummary(record) {
  const text = JSON.stringify(record).toLowerCase();
  const tags = [];
  if (text.includes("clay")) tags.push("May hold water and nutrients, but can compact or drain slowly.");
  if (text.includes("limestone") || text.includes("calcareous") || text.includes("carbonate")) tags.push("Likely influenced by limestone or alkaline chemistry.");
  if (text.includes("shallow")) tags.push("Shallow soil can dry quickly and favors tough native plants.");
  if (text.includes("well drained")) tags.push("Better drainage often favors drought-adapted plants.");
  if (text.includes("riparian") || text.includes("flood")) tags.push("May relate to wetter lowland or streamside conditions.");
  if (!tags.length) tags.push("Use the soil name, texture, and drainage clues to match plants to place.");
  return tags.join(" ");
}

function renderSimpleTable(id, records, limit = 35) {
  const el = document.getElementById(id);
  if (!records || !records.length) {
    el.innerHTML = `<p class="small">No matching soil records found.</p>`;
    return;
  }

  const rows = records.slice(0, limit);
  el.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Soil clue</th><th>Plain-language meaning</th><th>Original record preview</th></tr></thead>
        <tbody>
          ${rows.map(r => {
            const values = Object.entries(r).filter(([k,v]) => v !== null && v !== "").slice(0, 5).map(([k,v]) => `${k}: ${cell(v)}`).join("<br>");
            const title = r.muname || r.compname || r.MUSYM || r.MUKEY || "Soil record";
            return `<tr><td><strong>${cell(title)}</strong></td><td>${simpleSoilSummary(r)}</td><td>${values}</td></tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
    <p class="small">Showing ${Math.min(records.length, limit).toLocaleString()} of ${records.length.toLocaleString()} matching records. Use this as a guide, not a property-level soil test.</p>
  `;
}

function filterGardenerSoils() {
  const q = document.getElementById("gardenerSearch").value.toLowerCase();
  const records = G.soil?.records || [];
  const filtered = records.filter(r => JSON.stringify(r).toLowerCase().includes(q));
  renderSimpleTable("gardenerSoilTable", filtered, 35);
}

async function init() {
  try {
    const entries = await Promise.all(Object.entries(files).map(async ([k, p]) => [k, await loadJSON(p)]));
    entries.forEach(([k, v]) => G[k] = v);
    document.getElementById("oneSentence").textContent = G.beginner?.one_sentence || "";
    renderBeginnerSteps();
    renderBenefits();
    renderFunctionSignals();
    renderDecisionCards();
    renderPlainTerms();
    renderSimpleTable("gardenerSoilTable", G.soil?.records || [], 35);
    document.getElementById("gardenerSearch").addEventListener("input", filterGardenerSoils);
  } catch (err) {
    document.getElementById("gardenerError").innerHTML = `<div class="notice"><strong>Load error:</strong> ${err.message}</div>`;
  }
}
init();
