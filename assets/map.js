const App = {
  soilData: null,
  currentLayer: null,
  manifest: null,
  soilSummary: null,
  recordsByMukey: new Map(),
  storyRules: null,
  componentMix: null,
  groupedRecordsByMukey: new Map(),
  svg: null,
  marker: null,
  selectedPath: null,
  selectedFeature: null,
  plot: { width: 1000, height: 720, pad: 28, minX: 0, minY: 0, maxX: 1, maxY: 1 }
};

const FILES = {
  manifest: "data/map_layer_manifest.json",
  soilSummary: "data/tx604_soil_summary.json",
  storyRules: "data/public_soil_story_rules.json",
  componentMix: "data/soil_component_mix.json"
};

function fmt(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "number") return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return String(value);
}

function esc(value) {
  return fmt(value).replace(/[&<>'"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[ch]));
}

async function loadJSON(path, fallback) {
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
  App.groupedRecordsByMukey = grouped;
  App.recordsByMukey = new Map([...grouped.entries()].map(([key, records]) => [key, chooseBestRecord(records)]));
}

function componentRowsForFeature(feature) {
  const props = feature?.properties || {};
  const key = String(prop(props, ["MUKEY", "mukey"]) || "");
  return App.groupedRecordsByMukey.get(key) || [];
}

function componentMixForFeature(feature) {
  const props = feature?.properties || {};
  const key = String(prop(props, ["MUKEY", "mukey"]) || "");
  const mix = App.componentMix?.mapunits?.[key];
  if (mix && mix.length) return mix;
  return componentRowsForFeature(feature).map(r => ({
    component: r.compname,
    percent: r.comppct_r,
    major: r.majcompflag,
    habitat: r.simple_soil_habitat_type,
    data_quality: r.property_data_quality
  }));
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
    record?.ecological_site_names, record?.existing_plant_indicators_top10, record?.taxclname, record?.taxorder, record?.taxsubgrp,
    record?.microbial_habitat_class, record?.likely_microbe_functions_inferred
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
  const lowConfidence = String(record?.property_data_quality || record?.microbe_confidence_grade || "").toLowerCase().includes("limited") || String(record?.microbe_confidence_grade || "").startsWith("D");

  const isClay = (clay !== null && clay >= 35) || combined.includes("clay");
  const isVeryClay = clay !== null && clay >= 50;
  const isLimestone = (pH !== null && pH >= 7.4) || (caco3 !== null && caco3 >= 5) || /limestone|calcareous|carbonate|brackett|eckrant|comfort/.test(combined);
  const isShallow = (restriction !== null && restriction <= 50) || (bedrock !== null && bedrock <= 50) || /shallow|lithic|rock outcrop|rocky/.test(combined);
  const isWet = record?.true_wet_flood_flag === true || hydric === "yes";
  const isClayRedoxOnly = record?.clay_redox_microsites_flag === true && !isWet;
  const isLoamy = /loam|loamy/.test(combined);
  const isPrairie = /prairie|grassland|bluestem|grama|indiangrass|switchgrass|gamagrass|perennial forbs|savanna/.test(combined);
  const isWoodland = /woodland|oak|forest|juniper|savanna/.test(combined);
  const lowOrganic = organic !== null && organic < 1.5;
  const highRunoff = /high|very high/.test(String(record?.runoff || "").toLowerCase());

  if (isClay) {
    addUnique(personalities, isVeryClay ? "Sticky Sponge" : "Clay-influenced soil");
    addUnique(clues, clay !== null ? `${clay}% surface clay` : "clay signal");
    addUnique(plantMeaning, "Clay can hold water and nutrients, but it can compact and become hard when dry.");
    addUnique(microbeJobs, isClayRedoxOnly ? "Soil builders and drought survivors may matter in clay wet-dry pockets; this is not the same as a floodplain signal." : "Soil builders may help form soil crumbs that protect air, water, roots, and organic matter.");
    addUnique(actions, "Avoid working or driving on clay soil when it is wet.");
  }

  if (isLimestone) {
    addUnique(personalities, "Limestone Lunchbox");
    if (pH !== null) addUnique(clues, `pH ${pH}`);
    if (caco3 !== null) addUnique(clues, `${caco3}% calcium carbonate`);
    addUnique(plantMeaning, "High-pH limestone soil can make phosphorus, iron, and some micronutrients harder for plants to use.");
    addUnique(microbeJobs, "Nutrient unlockers may help move phosphorus and minerals in alkaline soil.");
    addUnique(actions, "Choose native plants adapted to limestone or alkaline soil.");
    addUnique(actions, "Use a soil test before adding fertilizer.");
  }

  if (isShallow) {
    addUnique(personalities, "Thin-Skin Hill Soil");
    addUnique(clues, restriction !== null ? `root restriction near ${restriction} cm` : "shallow or rocky signal");
    addUnique(plantMeaning, "Shallow soil gives roots less room and usually dries faster after rain.");
    addUnique(microbeJobs, "Drought survivors are likely important because wet-dry stress strongly shapes soil life.");
    addUnique(actions, "Use drought-adapted local native plants and protect thin topsoil.");
  }

  if (isWet) {
    addUnique(personalities, "Flood-Pulse Soil");
    addUnique(clues, "wet, hydric, floodplain, ponding, water, or riparian signal");
    addUnique(plantMeaning, "Wet periods can lower soil oxygen and require plants that tolerate saturation.");
    addUnique(microbeJobs, "Balance keepers may shift nitrogen cycling and decomposition during wet periods.");
    addUnique(actions, "Use plants adapted to periodic wetness and avoid compacting saturated soil.");
  }

  if (isLoamy && !isVeryClay) {
    addUnique(personalities, "Balanced Loam");
    addUnique(clues, record?.surface_texture_description || "loamy texture");
    addUnique(plantMeaning, "Loamy textures often balance water holding, drainage, and root growth.");
    addUnique(microbeJobs, "Root helpers can be active when living roots and organic matter are present.");
  }

  if (lowOrganic) {
    addUnique(personalities, "Hungry Soil");
    addUnique(clues, `${organic}% surface organic matter`);
    addUnique(plantMeaning, "Low organic matter means soil life depends strongly on living roots and plant litter.");
    addUnique(microbeJobs, "Recyclers need dead roots, leaves, mulch, and other organic material to keep nutrients moving.");
    addUnique(actions, "Keep living roots and protective plant cover as much as possible.");
  }

  if (isPrairie) {
    addUnique(personalities, "Root-Fed Prairie Soil");
    addUnique(clues, "prairie, grassland, or native grass indicator");
    addUnique(plantMeaning, "Native grasses and forbs can build deep, fibrous root systems that feed soil life.");
    addUnique(microbeJobs, "Root helpers near grassland roots may support nutrient exchange and soil aggregation.");
    addUnique(actions, "Use diverse native grasses and forbs instead of leaving long-term bare soil.");
  }

  if (isWoodland) {
    addUnique(personalities, "Leaf-Litter Woodland Soil");
    addUnique(clues, "woodland, oak, tree, or savanna indicator");
    addUnique(plantMeaning, "Woody systems rely on protected root zones and steady leaf-litter cycling.");
    addUnique(microbeJobs, "Recyclers and root helpers are important in woody litter and tree-root systems.");
    addUnique(actions, "Protect leaf litter where appropriate and avoid compacting tree root zones.");
  }

  if (highRunoff) {
    addUnique(clues, `${record?.runoff} runoff`);
    addUnique(plantMeaning, "High runoff means intense rain may leave quickly instead of soaking in.");
    addUnique(actions, "Use plant cover and roots to slow water and reduce erosion.");
  }

  if (lowConfidence) {
    addUnique(warnings, "This component has limited soil-property data. Use broad habitat actions, not exact microbial claims.");
    microbeJobs.length = 0;
    addUnique(microbeJobs, "Microbe jobs are not inferred strongly from this component because key soil properties are missing.");
  }

  if (!personalities.length) addUnique(personalities, "General Soil Habitat");
  if (!clues.length) addUnique(clues, "soil map unit found");
  if (!plantMeaning.length) addUnique(plantMeaning, "Use texture, depth, drainage, pH, and plant community clues to match plants to place.");
  if (!microbeJobs.length) addUnique(microbeJobs, "Microbial meaning is inferred from soil habitat plus regional evidence, not a local microbe test.");
  if (!actions.length) addUnique(actions, "Keep living roots, protect soil cover, reduce disturbance, and choose soil-adapted native plants.");

  if (!record) warnings.push("This polygon has a soil map name, but the full summarized soil record was not matched in the Kyle/ETJ table.");

  const simpleTypeParts = [];
  if (isLimestone) simpleTypeParts.push("limestone/alkaline");
  if (isVeryClay) simpleTypeParts.push("heavy clay"); else if (isClay) simpleTypeParts.push("clayey"); else if (isLoamy) simpleTypeParts.push("loamy");
  if (isShallow) simpleTypeParts.push("shallow/rocky");
  if (isWet) simpleTypeParts.push("wet or flood-pulse");
  if (!simpleTypeParts.length) simpleTypeParts.push("mapped soil");

  const oneSentence = record?.public_soil_story || `This looks like ${simpleTypeParts.join(" ")} habitat. It may shape roots, water movement, nutrient availability, and the kinds of soil-life jobs most likely to matter here.`;

  return {
    record,
    title: titleForFeature(props, record),
    simpleType: simpleTypeParts.join(" "),
    oneSentence,
    personalities,
    clues,
    plantMeaning,
    microbeJobs,
    actions,
    warnings,
    evidence: record?.public_microbe_claim || "Habitat prediction. This uses mapped soil properties and regional microbial evidence. It does not prove exact microbes at this exact spot."
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
    ["Plant indicators", record?.existing_plant_indicators_top10],
    ["Simple habitat type", record?.simple_soil_habitat_type],
    ["Public habitat flags", record?.public_habitat_flags],
    ["Property data quality", record?.property_data_quality],
    ["True wet/flood flag", record?.true_wet_flood_flag],
    ["Clay wet-dry microsites", record?.clay_redox_microsites_flag],
    ["Inferred soil-life class", record?.microbial_habitat_class],
    ["Evidence grade", record?.microbe_confidence_grade]
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
      <p class="result-title">No soil polygon found here</p>
      <p class="result-subtitle">${esc(latlng.lat.toFixed(6))}, ${esc(latlng.lng.toFixed(6))}</p>
      <div class="notice">Try another layer, click inside a soil shape, or check the coordinates.</div>
      <div class="result-item"><strong>Current layer</strong>${esc(layerNote())}</div>`;
    return;
  }

  const props = feature.properties || {};
  const story = storyFromFeature(feature);
  const rows = keyProps(props, story.record);

  el.innerHTML = `
    <p class="eyebrow dark">Your soil story</p>
    <p class="result-title">${esc(story.title)}</p>
    <p class="result-subtitle">${esc(source)} - ${esc(latlng.lat.toFixed(6))}, ${esc(latlng.lng.toFixed(6))}</p>

    <div class="soil-story-banner">
      <strong>Short version:</strong> ${esc(story.oneSentence)}
    </div>

    <div class="result-grid">
      <div class="result-item public-story-card">
        <strong>Simple soil type</strong>
        <p>${esc(story.simpleType)}</p>
        <div>${renderPills(story.personalities)}</div>
      </div>

      <div class="result-item public-story-card">
        <strong>Plain soil clues</strong>
        <div>${renderPills(story.clues)}</div>
      </div>

      <div class="result-item public-story-card">
        <strong>What roots may experience</strong>
        ${renderList(story.plantMeaning)}
      </div>

      <div class="result-item public-story-card">
        <strong>What tiny soil workers may be doing</strong>
        ${renderList(story.microbeJobs)}
      </div>

      <div class="result-item public-story-card action-highlight">
        <strong>Best next actions</strong>
        ${renderList(story.actions)}
        <p><a href="actions.html">Open the full action guide</a></p>
      </div>


      <div class="result-item public-story-card component-mix-card">
        <strong>Map-unit mix</strong>
        <p class="small">SSURGO map units can contain more than one soil component. The story above uses the dominant/best-filled component, but other components may occur inside the same polygon.</p>
        <div class="table-wrap compact-table"><table><thead><tr><th>Component</th><th>%</th><th>Habitat</th><th>Data quality</th></tr></thead><tbody>${componentMixForFeature(feature).slice(0,8).map(c => `<tr><td>${esc(c.component || "-")}</td><td>${esc(c.percent || "-")}</td><td>${esc(c.habitat || "-")}</td><td>${esc(c.data_quality || "-")}</td></tr>`).join("")}</tbody></table></div>
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
    </div>`;
}

function collectCoords(geometry, out) {
  if (!geometry) return;
  if (geometry.type === "Polygon") {
    geometry.coordinates.forEach(ring => ring.forEach(coord => out.push(coord)));
  } else if (geometry.type === "MultiPolygon") {
    geometry.coordinates.forEach(poly => poly.forEach(ring => ring.forEach(coord => out.push(coord))));
  }
}

function computeBounds(features) {
  const coords = [];
  features.forEach(feature => collectCoords(feature.geometry, coords));
  if (!coords.length) return [-98.1, 29.8, -97.7, 30.2];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  coords.forEach(([x, y]) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });
  return [minX, minY, maxX, maxY];
}

function setPlotBounds(features) {
  const [minX, minY, maxX, maxY] = computeBounds(features);
  App.plot.minX = minX;
  App.plot.minY = minY;
  App.plot.maxX = maxX;
  App.plot.maxY = maxY;
}

function project(coord) {
  const { width, height, pad, minX, minY, maxX, maxY } = App.plot;
  const usableW = width - pad * 2;
  const usableH = height - pad * 2;
  const scaleX = usableW / ((maxX - minX) || 1);
  const scaleY = usableH / ((maxY - minY) || 1);
  const scale = Math.min(scaleX, scaleY);
  const mapW = (maxX - minX) * scale;
  const mapH = (maxY - minY) * scale;
  const offsetX = (width - mapW) / 2;
  const offsetY = (height - mapH) / 2;
  const x = offsetX + (coord[0] - minX) * scale;
  const y = offsetY + (maxY - coord[1]) * scale;
  return [x, y];
}

function unproject(x, y) {
  const { width, height, pad, minX, minY, maxX, maxY } = App.plot;
  const usableW = width - pad * 2;
  const usableH = height - pad * 2;
  const scaleX = usableW / ((maxX - minX) || 1);
  const scaleY = usableH / ((maxY - minY) || 1);
  const scale = Math.min(scaleX, scaleY);
  const mapW = (maxX - minX) * scale;
  const mapH = (maxY - minY) * scale;
  const offsetX = (width - mapW) / 2;
  const offsetY = (height - mapH) / 2;
  const lng = minX + (x - offsetX) / scale;
  const lat = maxY - (y - offsetY) / scale;
  return { lat, lng };
}

function ringPath(ring) {
  if (!ring || !ring.length) return "";
  return ring.map((coord, i) => {
    const [x, y] = project(coord);
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ") + " Z";
}

function featurePath(feature) {
  const geom = feature.geometry || {};
  if (geom.type === "Polygon") return geom.coordinates.map(ringPath).join(" ");
  if (geom.type === "MultiPolygon") return geom.coordinates.map(poly => poly.map(ringPath).join(" ")).join(" ");
  return "";
}

function featureClass(feature) {
  const story = storyFromFeature(feature);
  const text = storyText(feature.properties || {}, story.record);
  if (story.record?.true_wet_flood_flag === true) return "wet";
  if (/shallow|rock|lithic/.test(text)) return "shallow";
  if (/limestone|carbonate|calcareous|brackett|eckrant/.test(text)) return "limestone";
  if (text.includes("clay")) return "clay";
  return "general";
}

function svgPointFromEvent(event) {
  const pt = App.svg.createSVGPoint();
  pt.x = event.clientX;
  pt.y = event.clientY;
  return pt.matrixTransform(App.svg.getScreenCTM().inverse());
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

function placeMarker(latlng) {
  if (!App.svg) return;
  if (App.marker) App.marker.remove();
  const [x, y] = project([latlng.lng, latlng.lat]);
  const marker = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  marker.setAttribute("cx", x.toFixed(1));
  marker.setAttribute("cy", y.toFixed(1));
  marker.setAttribute("r", "7");
  marker.setAttribute("class", "map-marker");
  App.svg.appendChild(marker);
  App.marker = marker;
}

function highlightFeature(feature) {
  if (App.selectedPath) App.selectedPath.classList.remove("selected");
  App.selectedPath = null;
  if (!feature) return;
  const index = (App.soilData.features || []).indexOf(feature);
  const path = App.svg?.querySelector(`path[data-index="${index}"]`);
  if (path) {
    path.classList.add("selected");
    App.selectedPath = path;
  }
}

function lookup(latlng, source, directFeature = null) {
  const feature = directFeature || findFeature(latlng);
  highlightFeature(feature);
  placeMarker(latlng);
  renderResult(feature, latlng, source);
}

function renderMap() {
  const features = App.soilData?.features || [];
  setPlotBounds(features);
  const paths = features.map((feature, index) => {
    const d = featurePath(feature);
    const cls = featureClass(feature);
    const title = titleForFeature(feature.properties || {}, recordForFeature(feature));
    return `<path class="soil-poly ${cls}" data-index="${index}" tabindex="0" role="button" aria-label="Soil polygon: ${esc(title)}" d="${d}"><title>${esc(title)}</title></path>`;
  }).join("");

  const mapEl = document.getElementById("map");
  mapEl.innerHTML = `<svg id="soilSvg" viewBox="0 0 ${App.plot.width} ${App.plot.height}" preserveAspectRatio="xMidYMid meet" aria-label="Soil polygons">${paths}</svg>`;
  App.svg = document.getElementById("soilSvg");
  App.marker = null;
  App.selectedPath = null;

  App.svg.addEventListener("keydown", event => {
    const path = event.target.closest ? event.target.closest("path[data-index]") : null;
    if (!path || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    const feature = App.soilData.features[Number(path.dataset.index)];
    const coords = [];
    collectCoords(feature.geometry, coords);
    const avg = coords.reduce((acc, c) => [acc[0] + c[0], acc[1] + c[1]], [0,0]).map(v => v / Math.max(coords.length, 1));
    lookup({ lat: avg[1], lng: avg[0] }, "keyboard map selection", feature);
  });

  App.svg.addEventListener("click", event => {
    const svgPoint = svgPointFromEvent(event);
    const latlng = unproject(svgPoint.x, svgPoint.y);
    const path = event.target.closest ? event.target.closest("path[data-index]") : null;
    if (path) {
      const feature = App.soilData.features[Number(path.dataset.index)];
      lookup(latlng, "map click", feature);
    } else {
      lookup(latlng, "map click");
    }
  });
}

async function loadLayer(layerId) {
  const layer = (App.manifest.layers || []).find(l => l.id === layerId);
  if (!layer) return;
  document.getElementById("mapStatus").textContent = `Loading ${layer.label}...`;
  App.currentLayer = layerId;
  App.soilData = await loadJSON(layer.file, window.HAYS_MAP_EMBED?.layers?.[layerId]);
  renderMap();
  document.getElementById("mapStatus").textContent = `${(App.soilData.features || []).length.toLocaleString()} soil shapes loaded: ${layer.label}.`;
  document.getElementById("layerScopeNote").textContent = layer.scope_note;
}

async function geocode() {
  const query = document.getElementById("addressInput").value.trim();
  const status = document.getElementById("addressStatus");
  if (!query) return;
  status.textContent = "Searching address...";
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`, { headers: { "Accept": "application/json" } });
    const data = await response.json();
    if (!data.length) {
      status.textContent = "No address result found. Try adding city/state.";
      return;
    }
    const latlng = { lat: Number(data[0].lat), lng: Number(data[0].lon) };
    lookup(latlng, "address search");
    status.textContent = `Found: ${data[0].display_name}`;
  } catch (err) {
    status.textContent = `Address search error: ${err.message}. Coordinate lookup and map clicking still work.`;
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
  const latlng = { lat, lng };
  lookup(latlng, "coordinate entry");
  status.textContent = `Looked up ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

function useLocation() {
  const status = document.getElementById("geoStatus");
  if (!navigator.geolocation) {
    status.textContent = "This browser does not support location.";
    return;
  }
  status.textContent = "Waiting for location permission...";
  navigator.geolocation.getCurrentPosition(pos => {
    const latlng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    lookup(latlng, "browser location");
    status.textContent = `Location found. Accuracy about ${Math.round(pos.coords.accuracy)} meters.`;
  }, err => {
    status.textContent = `Location unavailable: ${err.message}`;
  }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
}

function resetMap() {
  renderMap();
  document.getElementById("lookupResult").innerHTML = `
    <p class="result-title">No location selected yet</p>
    <p class="result-subtitle">Click a soil shape or use one of the lookup tools above.</p>
    <div class="result-item"><strong>What you will get</strong> A soil story, root meaning, likely microbe jobs, actions, and an evidence label.</div>`;
}

async function init() {
  try {
    const embedded = window.HAYS_MAP_EMBED || {};
    const [manifest, soilSummary, storyRules, componentMix] = await Promise.all([
      loadJSON(FILES.manifest, embedded.manifest),
      loadJSON(FILES.soilSummary, embedded.soilSummary),
      loadJSON(FILES.storyRules, embedded.storyRules),
      loadJSON(FILES.componentMix, embedded.componentMix)
    ]);
    App.manifest = manifest;
    App.soilSummary = soilSummary;
    App.storyRules = storyRules;
    App.componentMix = componentMix;
    indexSoilRecords();

    const select = document.getElementById("layerSelect");
    select.innerHTML = (App.manifest.layers || []).map(layer => `<option value="${esc(layer.id)}">${esc(layer.label)}</option>`).join("");
    select.addEventListener("change", () => loadLayer(select.value));
    await loadLayer(App.manifest.default_layer || App.manifest.layers[0].id);

    document.getElementById("addressButton").addEventListener("click", geocode);
    document.getElementById("addressInput").addEventListener("keydown", e => { if (e.key === "Enter") geocode(); });
    document.getElementById("coordButton").addEventListener("click", coordLookup);
    document.getElementById("locationButton").addEventListener("click", useLocation);
    document.getElementById("fitButton").addEventListener("click", resetMap);
  } catch (err) {
    document.getElementById("mapError").innerHTML = `<div class="notice"><strong>Map load error:</strong> ${esc(err.message)}</div>`;
    document.getElementById("mapStatus").textContent = "Map did not load.";
  }
}

init();
