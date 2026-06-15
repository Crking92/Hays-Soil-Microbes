const App = {
  map: null,
  soilLayer: null,
  soilData: null,
  marker: null,
  currentLayer: null,
  manifest: null,
  soilSummary: null,
  recordsByMukey: new Map(),
  storyRules: null
};

async function loadJSON(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load ${path}`);
  return await response.json();
}

function fmt(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return String(value);
}

function esc(value) {
  return fmt(value).replace(/[&<>'"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[ch]));
}

function prop(props, names) {
  for (const name of names) {
    if (props && props[name] !== undefined && props[name] !== null && props[name] !== "") return props[name];
  }
  return null;
}

function lowerRecord(record) {
  if (!record) return "";
  const values = Array.isArray(record) ? record : Object.values(record);
  return values.map(value => {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") return lowerRecord(value);
    return String(value);
  }).join(" ").toLowerCase();
}

function numberValue(record, key) {
  const value = record?.[key];
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function titleForFeature(props, record = null) {
  return prop(record, ["muname", "compname"]) || prop(props, ["muname", "MU_NAME", "MapUnitName", "mapunit_name", "compname", "COMP_NAME", "MUSYM", "musym", "MUKEY", "mukey"]) || "Mapped soil polygon";
}

function layerNote() {
  const layer = (App.manifest?.layers || []).find(l => l.id === App.currentLayer);
  return layer ? layer.scope_note : "";
}

function chooseBestRecord(records) {
  if (!records || !records.length) return null;
  return [...records].sort((a, b) => {
    const majorA = String(a.majcompflag || "").toLowerCase() === "yes" ? 1 : 0;
    const majorB = String(b.majcompflag || "").toLowerCase() === "yes" ? 1 : 0;
    const pctA = numberValue(a, "comppct_r") || 0;
    const pctB = numberValue(b, "comppct_r") || 0;
    const filledA = Object.values(a).filter(v => v !== null && v !== "").length;
    const filledB = Object.values(b).filter(v => v !== null && v !== "").length;
    return (majorB - majorA) || (pctB - pctA) || (filledB - filledA);
  })[0];
}

function indexSoilRecords() {
  const grouped = new Map();
  for (const record of App.soilSummary?.records || []) {
    const key = String(record.mukey || record.MUKEY || "");
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(record);
  }
  App.recordsByMukey = new Map([...grouped.entries()].map(([key, records]) => [key, chooseBestRecord(records)]));
}

function recordForFeature(feature) {
  const props = feature?.properties || {};
  const key = String(prop(props, ["MUKEY", "mukey"]) || "");
  return App.recordsByMukey.get(key) || null;
}

function addUnique(list, value) {
  if (value && !list.includes(value)) list.push(value);
}

function storyText(props, record) {
  const primaryValues = [
    props?.muname, props?.MU_NAME, props?.MapUnitName, props?.mapunit_name, props?.MUSYM,
    record?.muname, record?.compname, record?.localphase, record?.drainagecl, record?.hydricrating,
    record?.geomdesc, record?.surface_texture_description, record?.restriction_kind, record?.flodfreqdcd,
    record?.ecological_site_names, record?.existing_plant_indicators_top10, record?.taxclname, record?.taxorder, record?.taxsubgrp
  ];
  return lowerRecord(primaryValues);
}

function storyFromFeature(feature) {
  const props = feature?.properties || {};
  const record = recordForFeature(feature);
  const combined = storyText(props, record);
  const clay = numberValue(record, "claytotal_r_surface_0_30cm");
  const pH = numberValue(record, "ph1to1h2o_r_surface_0_30cm");
  const caco3 = numberValue(record, "caco3_r_surface_0_30cm");
  const organic = numberValue(record, "om_r_surface_0_30cm");
  const restriction = numberValue(record, "restriction_depth_cm");
  const bedrock = numberValue(record, "brockdepmin");
  const hydric = String(record?.hydricrating || "").toLowerCase();

  const personalities = [];
  const clues = [];
  const plantMeaning = [];
  const microbeJobs = [];
  const actions = [];
  const warnings = [];

  const isClay = (clay !== null && clay >= 35) || combined.includes("clay");
  const isVeryClay = clay !== null && clay >= 50;
  const isLimestone = (pH !== null && pH >= 7.4) || (caco3 !== null && caco3 >= 5) || /limestone|calcareous|carbonate|brackett|eckrant|comfort/.test(combined);
  const isShallow = (restriction !== null && restriction <= 50) || (bedrock !== null && bedrock <= 50) || /shallow|lithic|rock outcrop|rocky/.test(combined);
  const isWet = /poorly drained|somewhat poorly|flood|pond|riparian|bottomland/.test(combined) || hydric === "yes";
  const isLoamy = /loam|loamy/.test(combined);
  const isPrairie = /prairie|grassland|bluestem|grama|indiangrass|switchgrass|gamagrass|perennial forbs|savanna/.test(combined);
  const isWoodland = /woodland|oak|forest|juniper|savanna/.test(combined);
  const lowOrganic = organic !== null && organic < 1.5;
  const highRunoff = /high|very high/.test(String(record?.runoff || "").toLowerCase());

  if (isClay) {
    addUnique(personalities, isVeryClay ? "Sticky Sponge: very clayey soil" : "Sticky Sponge: clay-influenced soil");
    addUnique(clues, clay !== null ? `${clay}% surface clay` : "clay signal");
    addUnique(plantMeaning, "Clay can hold water and nutrients, but it can compact and become hard when dry.");
    addUnique(microbeJobs, "Soil builders: clay can protect organic matter and microbial habitat inside soil crumbs.");
    addUnique(actions, "Avoid working or driving on clay soil when it is wet.");
  }

  if (isLimestone) {
    addUnique(personalities, "Limestone Lunchbox: nutrients may be locked up by high pH");
    if (pH !== null) addUnique(clues, `pH ${pH}`);
    if (caco3 !== null) addUnique(clues, `${caco3}% calcium carbonate`);
    addUnique(plantMeaning, "High-pH limestone soil can make phosphorus, iron, and some micronutrients harder for plants to access.");
    addUnique(microbeJobs, "Nutrient unlockers: alkaline-tolerant microbes may help move phosphorus and minerals.");
    addUnique(actions, "Choose native plants adapted to limestone or alkaline soil.");
    addUnique(actions, "Use a soil test before adding fertilizer.");
  }

  if (isShallow) {
    addUnique(personalities, "Thin-Skin Hill Soil: shallow or rocky rooting zone");
    addUnique(clues, restriction !== null ? `root restriction near ${restriction} cm` : "shallow or rocky signal");
    addUnique(plantMeaning, "Shallow soil gives roots less room and usually dries faster after rain.");
    addUnique(microbeJobs, "Drought survivors: wet-dry stress may strongly shape soil life.");
    addUnique(actions, "Use drought-adapted local native plants and protect thin topsoil.");
  }

  if (isWet) {
    addUnique(personalities, "Flood-Pulse Soil: wet periods change oxygen");
    addUnique(clues, "wet, hydric, floodplain, ponding, or riparian signal");
    addUnique(plantMeaning, "Wet periods can lower soil oxygen and require plants that tolerate saturation.");
    addUnique(microbeJobs, "Balance keepers: wet soil can shift nitrogen cycling and decomposition.");
    addUnique(actions, "Use plants adapted to periodic wetness and avoid compacting saturated soil.");
  }

  if (isLoamy && !isVeryClay) {
    addUnique(personalities, "Balanced Loam: mixed texture with root-friendly potential");
    addUnique(clues, record?.surface_texture_description || "loamy texture");
    addUnique(plantMeaning, "Loamy textures often balance water holding, drainage, and root growth.");
    addUnique(microbeJobs, "Root helpers: balanced texture can support active root-zone exchange when roots and organic matter are present.");
  }

  if (lowOrganic) {
    addUnique(personalities, "Hungry Soil: low organic food near the surface");
    addUnique(clues, `${organic}% surface organic matter`);
    addUnique(plantMeaning, "Low organic matter means soil life depends strongly on living roots and plant litter.");
    addUnique(microbeJobs, "Recyclers: decomposer microbes need dead roots, leaves, mulch, and other organic material.");
    addUnique(actions, "Keep living roots and protective plant cover as much as possible.");
  }

  if (isPrairie) {
    addUnique(personalities, "Root-Fed Prairie Soil: grassland roots drive soil life");
    addUnique(clues, "prairie, grassland, or native grass indicator");
    addUnique(plantMeaning, "Native grasses and forbs can build deep, fibrous root systems that feed the soil food web.");
    addUnique(microbeJobs, "Root helpers: grassland roots can support rhizosphere bacteria and root-partner fungi.");
    addUnique(actions, "Use diverse native grasses and forbs instead of leaving long-term bare soil.");
  }

  if (isWoodland) {
    addUnique(personalities, "Leaf-Litter Woodland Soil: woody roots and litter matter");
    addUnique(clues, "woodland, oak, tree, or savanna indicator");
    addUnique(plantMeaning, "Woody systems rely on protected root zones and steady leaf-litter cycling.");
    addUnique(microbeJobs, "Recyclers and root helpers: fungi often play a large role in woody litter and tree-root systems.");
    addUnique(actions, "Protect leaf litter where appropriate and avoid compacting tree root zones.");
  }

  if (highRunoff) {
    addUnique(clues, `${record?.runoff} runoff`);
    addUnique(plantMeaning, "High runoff means intense rain may leave quickly instead of soaking in.");
    addUnique(actions, "Use plant cover and roots to slow water and reduce erosion.");
  }

  if (!personalities.length) addUnique(personalities, "General Soil Habitat: use the mapped soil name as the starting clue");
  if (!clues.length) addUnique(clues, "soil map unit found");
  if (!plantMeaning.length) addUnique(plantMeaning, "Use texture, depth, drainage, pH, and plant community clues to match plants to place.");
  if (!microbeJobs.length) addUnique(microbeJobs, "Microbial meaning is inferred from soil habitat plus regional evidence, not a local microbe test.");
  if (!actions.length) addUnique(actions, "Keep living roots, protect soil cover, reduce disturbance, and choose soil-adapted native plants.");

  if (!record) warnings.push("Only the polygon fields were found for this map layer. The full summarized soil record was not matched.");

  const simpleTypeParts = [];
  if (isLimestone) simpleTypeParts.push("limestone/alkaline");
  if (isVeryClay) simpleTypeParts.push("heavy clay"); else if (isClay) simpleTypeParts.push("clayey"); else if (isLoamy) simpleTypeParts.push("loamy");
  if (isShallow) simpleTypeParts.push("shallow/rocky");
  if (isWet) simpleTypeParts.push("wet or flood-pulse");
  if (!simpleTypeParts.length) simpleTypeParts.push("mapped soil");

  return {
    record,
    title: titleForFeature(props, record),
    simpleType: simpleTypeParts.join(" "),
    personalities,
    clues,
    plantMeaning,
    microbeJobs,
    actions,
    warnings,
    evidence: "Soil-habitat prediction based on mapped soil properties and regional microbial evidence. This is not a direct soil DNA test for this exact location."
  };
}

function keyProps(props, record) {
  const wanted = [
    ["Soil map unit", prop(props, ["muname", "MU_NAME", "MapUnitName", "mapunit_name"]) || record?.muname],
    ["Map unit symbol", prop(props, ["MUSYM", "musym"]) || record?.musym],
    ["Map unit key", prop(props, ["MUKEY", "mukey"]) || record?.mukey],
    ["Component", record?.compname],
    ["Surface texture", record?.surface_texture_description],
    ["Drainage", record?.drainagecl],
    ["Runoff", record?.runoff],
    ["Surface clay %", record?.claytotal_r_surface_0_30cm],
    ["Surface organic matter %", record?.om_r_surface_0_30cm],
    ["Surface CaCO3 %", record?.caco3_r_surface_0_30cm],
    ["Surface pH", record?.ph1to1h2o_r_surface_0_30cm],
    ["Restriction depth cm", record?.restriction_depth_cm],
    ["Ecological site", record?.ecological_site_names],
    ["Plant indicators", record?.existing_plant_indicators_top10]
  ];
  return wanted.filter(([, value]) => value !== null && value !== undefined && value !== "");
}

function renderList(items) {
  return `<ul>${items.map(item => `<li>${esc(item)}</li>`).join("")}</ul>`;
}

function renderPills(items) {
  return items.map(item => `<span class="plain-pill">${esc(item)}</span>`).join(" ");
}

function renderResult(feature, latlng, source) {
  const el = document.getElementById("lookupResult");
  if (!feature) {
    el.innerHTML = `
      <div class="lookup-result story-result">
        <p class="result-title">No soil polygon found here</p>
        <p class="result-subtitle">${esc(latlng.lat.toFixed(6))}, ${esc(latlng.lng.toFixed(6))}</p>
        <div class="notice">Try another map layer, click inside the loaded soil layer, or check the coordinates.</div>
        <div class="result-item"><strong>Current layer</strong>${esc(layerNote())}</div>
      </div>`;
    return;
  }

  const props = feature.properties || {};
  const story = storyFromFeature(feature);
  const rows = keyProps(props, story.record);

  el.innerHTML = `
    <div class="lookup-result story-result">
      <p class="eyebrow dark">Your soil story</p>
      <p class="result-title">${esc(story.title)}</p>
      <p class="result-subtitle">${esc(source)} · ${esc(latlng.lat.toFixed(6))}, ${esc(latlng.lng.toFixed(6))}</p>

      <div class="soil-story-banner">
        <strong>Simple soil type:</strong> ${esc(story.simpleType)}
      </div>

      <div class="result-grid">
        <div class="result-item public-story-card">
          <strong>Soil personality</strong>
          <div>${renderPills(story.personalities)}</div>
        </div>

        <div class="result-item public-story-card">
          <strong>Plain soil clues</strong>
          <div>${renderPills(story.clues)}</div>
        </div>

        <div class="result-item public-story-card">
          <strong>What this may mean for plants</strong>
          ${renderList(story.plantMeaning)}
        </div>

        <div class="result-item public-story-card">
          <strong>What tiny soil workers may be doing</strong>
          ${renderList(story.microbeJobs)}
        </div>

        <div class="result-item public-story-card action-highlight">
          <strong>What to do here</strong>
          ${renderList(story.actions)}
          <p><a href="actions.html">Open the full action guide</a></p>
        </div>

        <div class="result-item public-story-card evidence-card">
          <strong>Evidence level</strong>
          <p>${esc(story.evidence)}</p>
          ${story.warnings.length ? `<div class="notice">${renderList(story.warnings)}</div>` : ""}
        </div>

        <div class="result-actions">
          <button type="button" onclick="window.print()">Print this soil story</button>
          <a href="gardener.html"><button type="button" class="secondary">Learn the microbe jobs</button></a>
          <a href="research.html"><button type="button" class="secondary">Show the science</button></a>
        </div>

        <details class="details-lite">
          <summary>Show original soil fields used for this story</summary>
          <div class="details-body">
            <table><tbody>${rows.map(([key, value]) => `<tr><th>${esc(key)}</th><td>${esc(value)}</td></tr>`).join("")}</tbody></table>
          </div>
        </details>
      </div>
    </div>`;
}

function inRing(point, ring) {
  let x = point[0], y = point[1], inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    const hit = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-15) + xi);
    if (hit) inside = !inside;
  }
  return inside;
}

function inPoly(point, coords) {
  if (!coords || !coords.length || !inRing(point, coords[0])) return false;
  for (let i = 1; i < coords.length; i++) if (inRing(point, coords[i])) return false;
  return true;
}

function inFeature(latlng, feature) {
  if (!feature || !feature.geometry) return false;
  const point = [latlng.lng, latlng.lat];
  const geometry = feature.geometry;
  if (geometry.type === "Polygon") return inPoly(point, geometry.coordinates);
  if (geometry.type === "MultiPolygon") return geometry.coordinates.some(poly => inPoly(point, poly));
  return false;
}

function findFeature(latlng) {
  for (const feature of App.soilData.features || []) if (inFeature(latlng, feature)) return feature;
  return null;
}

function lookup(latlng, source) {
  const feature = findFeature(latlng);
  if (App.marker) App.map.removeLayer(App.marker);
  App.marker = L.marker(latlng).addTo(App.map);
  renderResult(feature, latlng, source);
  App.marker.bindPopup(feature ? `<strong>${esc(titleForFeature(feature.properties || {}, recordForFeature(feature)))}</strong><br>${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}` : "No mapped soil polygon found here.").openPopup();
}

function styleFeature(feature) {
  const story = storyFromFeature(feature);
  const text = storyText(feature.properties || {}, story.record);
  let fill = "#7a9b62";
  if (text.includes("clay")) fill = "#96724b";
  if (/limestone|carbonate|calcareous|brackett|eckrant/.test(text)) fill = "#8f8a6a";
  if (/flood|riparian|poorly drained|pond/.test(text)) fill = "#5b8aa8";
  if (/shallow|rock|lithic/.test(text)) fill = "#9b8062";
  return { color: "#38592f", weight: 1, opacity: 0.7, fillColor: fill, fillOpacity: 0.28 };
}

async function loadLayer(layerId) {
  const layer = (App.manifest.layers || []).find(l => l.id === layerId);
  if (!layer) return;
  document.getElementById("mapStatus").textContent = `Loading ${layer.label}…`;
  if (App.soilLayer) App.map.removeLayer(App.soilLayer);
  App.currentLayer = layerId;
  App.soilData = await loadJSON(layer.file);
  App.soilLayer = L.geoJSON(App.soilData, {
    style: styleFeature,
    onEachFeature: (feature, leafletLayer) => {
      leafletLayer.on("click", e => lookup(e.latlng, "map click"));
      leafletLayer.bindTooltip(titleForFeature(feature.properties || {}, recordForFeature(feature)), { sticky: true });
    }
  }).addTo(App.map);
  fitLayer();
  document.getElementById("mapStatus").textContent = `${(App.soilData.features || []).length.toLocaleString()} polygons loaded: ${layer.label}.`;
  document.getElementById("layerScopeNote").textContent = layer.scope_note;
}

async function geocode() {
  const query = document.getElementById("addressInput").value.trim();
  const status = document.getElementById("addressStatus");
  if (!query) return;
  status.textContent = "Searching address…";
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`, { headers: { "Accept": "application/json" } });
    const data = await response.json();
    if (!data.length) {
      status.textContent = "No address result found. Try adding city/state.";
      return;
    }
    const latlng = L.latLng(Number(data[0].lat), Number(data[0].lon));
    App.map.setView(latlng, 15);
    lookup(latlng, "address search");
    status.textContent = `Found: ${data[0].display_name}`;
  } catch (err) {
    status.textContent = `Address search error: ${err.message}`;
  }
}

function coordLookup() {
  const lat = Number(document.getElementById("latInput").value);
  const lng = Number(document.getElementById("lngInput").value);
  const status = document.getElementById("coordStatus");
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    status.textContent = "Enter valid latitude and longitude.";
    return;
  }
  const latlng = L.latLng(lat, lng);
  App.map.setView(latlng, 15);
  lookup(latlng, "coordinate entry");
  status.textContent = `Looked up ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

function useLocation() {
  const status = document.getElementById("geoStatus");
  if (!navigator.geolocation) {
    status.textContent = "This browser does not support location.";
    return;
  }
  status.textContent = "Waiting for location permission…";
  navigator.geolocation.getCurrentPosition(pos => {
    const latlng = L.latLng(pos.coords.latitude, pos.coords.longitude);
    App.map.setView(latlng, 15);
    lookup(latlng, "browser location");
    status.textContent = `Location found. Accuracy about ${Math.round(pos.coords.accuracy)} meters.`;
  }, err => {
    status.textContent = `Location unavailable: ${err.message}`;
  }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
}

function fitLayer() {
  if (App.soilLayer) App.map.fitBounds(App.soilLayer.getBounds(), { padding: [20, 20] });
}

async function init() {
  try {
    App.map = L.map("map").setView([29.99, -97.88], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(App.map);

    const [manifest, soilSummary, storyRules] = await Promise.all([
      loadJSON("data/map_layer_manifest.json"),
      loadJSON("data/kyle_etj_soil_summary.json"),
      loadJSON("data/public_soil_story_rules.json")
    ]);
    App.manifest = manifest;
    App.soilSummary = soilSummary;
    App.storyRules = storyRules;
    indexSoilRecords();

    const select = document.getElementById("layerSelect");
    select.innerHTML = (App.manifest.layers || []).map(layer => `<option value="${esc(layer.id)}">${esc(layer.label)}</option>`).join("");
    select.addEventListener("change", () => loadLayer(select.value));
    await loadLayer(App.manifest.default_layer || App.manifest.layers[0].id);

    App.map.on("click", e => lookup(e.latlng, "map click"));
    document.getElementById("addressButton").addEventListener("click", geocode);
    document.getElementById("addressInput").addEventListener("keydown", e => { if (e.key === "Enter") geocode(); });
    document.getElementById("coordButton").addEventListener("click", coordLookup);
    document.getElementById("locationButton").addEventListener("click", useLocation);
    document.getElementById("fitButton").addEventListener("click", fitLayer);
  } catch (err) {
    document.getElementById("mapError").innerHTML = `<div class="notice"><strong>Map load error:</strong> ${esc(err.message)}</div>`;
  }
}

init();
