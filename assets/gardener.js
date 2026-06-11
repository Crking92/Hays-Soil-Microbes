
const G = {};
const files = {
  soil: "data/kyle_etj_soil_summary.json",
  functions: "data/microbial_function_summary_v06.json",
  beginner: "data/beginner_copy.json",
  glossary: "data/gardener_glossary.json",
  teaching: "data/soil_food_web_teaching.json"
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
  return s.length > 170 ? `${s.slice(0,170)}…` : s;
}

function renderFoodWebSteps() {
  const steps = G.teaching?.soil_food_web_steps || [];
  document.getElementById("foodWebSteps").innerHTML = steps.map((s, i) => `
    <div class="story-step">
      <h3>${i + 1}. ${s.title}</h3>
      <p>${s.simple}</p>
      <div class="why"><strong>How this connects to the dashboard:</strong> ${s.dashboard_connection}</div>
    </div>
  `).join("");
}

function renderFunctionTranslations() {
  const cats = G.functions?.function_categories || [];
  const translations = G.teaching?.function_translations || {};
  const cards = cats.slice(0, 9).map(c => {
    const t = translations[c.function_category] || {
      friendly_title: String(c.function_category || "Soil function").replaceAll("_", " "),
      plain_meaning: "A regional functional-potential signal.",
      why_gardeners_care: "This may help describe soil-life potential.",
      how_to_use: "Use as context, not a direct prescription."
    };
    return `
      <div class="meaning-card">
        <h3>${t.friendly_title}</h3>
        <p>${t.plain_meaning}</p>
        <p><strong>Why it matters:</strong> ${t.why_gardeners_care}</p>
        <p><strong>How to use it:</strong> ${t.how_to_use}</p>
        <div class="why"><strong>Regional gene hits in this dataset:</strong> ${fmt(c.gene_hits)}</div>
      </div>
    `;
  });
  document.getElementById("functionTranslations").innerHTML = cards.join("");
}

function renderActions() {
  const actions = G.teaching?.simple_actions || [];
  document.getElementById("simpleActions").innerHTML = actions.map(a => `
    <div class="action-card">
      <h3>${a.action}</h3>
      <p><strong>Why:</strong> ${a.why}</p>
      <p><strong>Example:</strong> ${a.example}</p>
    </div>
  `).join("");
}

function renderCanCannot() {
  const can = G.teaching?.what_the_dashboard_can_say || [];
  const cannot = G.teaching?.what_the_dashboard_should_not_say || [];
  document.getElementById("canCannot").innerHTML = `
    <div class="yes-box">
      <h3>Good ways to use the dashboard</h3>
      <ul>${can.map(x => `<li>${x}</li>`).join("")}</ul>
    </div>
    <div class="no-box">
      <h3>Do not overclaim</h3>
      <ul>${cannot.map(x => `<li>${x}</li>`).join("")}</ul>
    </div>
  `;
}

function renderBenefitCards() {
  const cards = G.glossary?.benefit_cards || [];
  document.getElementById("benefitCards").innerHTML = cards.map(c => `
    <div class="meaning-card">
      <h3>${c.benefit}</h3>
      <p>${c.plain_language}</p>
      <div class="why"><strong>Dashboard clues:</strong> ${c.look_for}</div>
    </div>
  `).join("");
}

function simpleSoilSummary(record) {
  const text = JSON.stringify(record).toLowerCase();
  const tags = [];
  if (text.includes("clay")) tags.push("May hold water and nutrients, but can compact if worked wet.");
  if (text.includes("limestone") || text.includes("calcareous") || text.includes("carbonate")) tags.push("Likely alkaline or limestone-influenced; choose adapted plants.");
  if (text.includes("shallow")) tags.push("May dry quickly; favors tough, drought-adapted native plants.");
  if (text.includes("well drained")) tags.push("Often better for upland or drought-adapted plantings.");
  if (text.includes("riparian") || text.includes("flood")) tags.push("May relate to wetter lowland or streamside conditions.");
  if (!tags.length) tags.push("Use the soil name, texture, and drainage clues to match plants to place.");
  return tags.join(" ");
}

function renderSimpleTable(records, limit = 25) {
  const el = document.getElementById("gardenerSoilTable");
  if (!records || !records.length) {
    el.innerHTML = `<p class="small">No matching soil records found.</p>`;
    return;
  }
  const rows = records.slice(0, limit);
  el.innerHTML = `
    <div class="small-data-note">This is supporting data. Start with the teaching cards above, then use this table to look up soil clues.</div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Soil clue</th><th>Plain-language meaning</th><th>Record preview</th></tr></thead>
        <tbody>
          ${rows.map(r => {
            const title = r.muname || r.compname || r.MUSYM || r.MUKEY || "Soil record";
            const values = Object.entries(r).filter(([k,v]) => v !== null && v !== "").slice(0, 5).map(([k,v]) => `${k}: ${cell(v)}`).join("<br>");
            return `<tr><td><strong>${cell(title)}</strong></td><td>${simpleSoilSummary(r)}</td><td>${values}</td></tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
    <p class="small">Showing ${Math.min(records.length, limit).toLocaleString()} of ${records.length.toLocaleString()} records.</p>
  `;
}

function filterGardenerSoils() {
  const q = document.getElementById("gardenerSearch").value.toLowerCase();
  const records = G.soil?.records || [];
  renderSimpleTable(records.filter(r => JSON.stringify(r).toLowerCase().includes(q)), 25);
}

async function init() {
  try {
    const entries = await Promise.all(Object.entries(files).map(async ([k, p]) => [k, await loadJSON(p)]));
    entries.forEach(([k, v]) => G[k] = v);
    document.getElementById("coreMessage").textContent = G.teaching?.core_message || "";
    renderFoodWebSteps();
    renderBenefitCards();
    renderFunctionTranslations();
    renderActions();
    renderCanCannot();
    renderSimpleTable(G.soil?.records || [], 25);
    document.getElementById("gardenerSearch").addEventListener("input", filterGardenerSoils);
  } catch (err) {
    document.getElementById("gardenerError").innerHTML = `<div class="notice"><strong>Load error:</strong> ${err.message}</div>`;
  }
}

init();
