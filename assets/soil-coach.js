const Coach = {
  data: null,
  selectedGoal: null,
  selectedObservations: new Set(),
  testTags: new Set(),
  testNotes: []
};

function coachEsc(value) {
  if (value === null || value === undefined || value === "") return "";
  return String(value).replace(/[&<>'"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[ch]));
}

function uniqueItems(items) {
  return [...new Set((items || []).filter(Boolean))];
}

function listHtml(items) {
  const clean = uniqueItems(items);
  return clean.length ? `<ul>${clean.map(item => `<li>${coachEsc(item)}</li>`).join("")}</ul>` : `<p class="small">No items selected yet.</p>`;
}

async function loadCoachData() {
  const response = await fetch("data/beginner_soil_coach.json");
  if (!response.ok) throw new Error("Could not load beginner soil coach data.");
  return await response.json();
}

function allSelectedTags() {
  const tags = [];
  const goal = Coach.data.goals.find(g => g.id === Coach.selectedGoal);
  if (goal) tags.push(...(goal.tags || []));
  for (const obsId of Coach.selectedObservations) {
    const obs = Coach.data.observations.find(o => o.id === obsId);
    if (obs) tags.push(...(obs.tags || []));
  }
  tags.push(...Coach.testTags);

  const sun = document.getElementById("coachSun")?.value || "";
  const water = document.getElementById("coachWater")?.value || "";
  const soilGuess = document.getElementById("coachSoilGuess")?.value || "";
  if (sun === "shade") tags.push("shade");
  if (water === "wet") tags.push("wet");
  if (water === "dry") tags.push("drought");
  if (water === "runoff") tags.push("runoff");
  if (soilGuess) tags.push(soilGuess);
  return uniqueItems(tags);
}

function strongestHabitat(tags) {
  const cards = Coach.data.soil_habitat_cards || [];
  let best = cards[0];
  let bestScore = -1;
  for (const card of cards) {
    const score = (card.tags || []).filter(tag => tags.includes(tag)).length;
    if (score > bestScore) {
      best = card;
      bestScore = score;
    }
  }
  return best;
}

function confidenceText() {
  const obsCount = Coach.selectedObservations.size;
  const hasTest = Coach.testTags.size > 0;
  const hasSoilGuess = Boolean(document.getElementById("coachSoilGuess")?.value);
  if ((obsCount >= 2 && hasTest) || (hasTest && hasSoilGuess)) return Coach.data.confidence_rules.higher;
  if (obsCount >= 1 || hasTest || hasSoilGuess) return Coach.data.confidence_rules.medium;
  return Coach.data.confidence_rules.low;
}

function selectedObservationObjects() {
  return [...Coach.selectedObservations]
    .map(id => Coach.data.observations.find(o => o.id === id))
    .filter(Boolean);
}

function actionsFromTags(tags) {
  const doItems = [];
  const avoidItems = [];
  for (const tag of tags) {
    const rule = Coach.data.tag_actions?.[tag];
    if (!rule) continue;
    doItems.push(...(rule.do || []));
    avoidItems.push(...(rule.avoid || []));
  }
  return { doItems: uniqueItems(doItems), avoidItems: uniqueItems(avoidItems) };
}

function selectedSeason() {
  const chosen = document.getElementById("coachSeason")?.value;
  if (chosen) return chosen;
  const month = new Date().getMonth() + 1;
  if ([3, 4, 5].includes(month)) return "spring";
  if ([6, 7, 8].includes(month)) return "summer";
  if ([9, 10, 11].includes(month)) return "fall";
  return "winter";
}

function recommendedTests(tags) {
  const tests = Coach.data.backyard_tests || [];
  const wanted = [];
  if (tags.includes("slow_infiltration") || tags.includes("wet") || tags.includes("runoff")) wanted.push("infiltration");
  if (tags.includes("clay") || tags.includes("compaction")) wanted.push("ribbon");
  if (tags.includes("shallow") || tags.includes("root_air") || tags.includes("diagnosis")) wanted.push("shovel");
  const chosen = wanted.length ? wanted : ["shovel", "infiltration"];
  return tests.filter(t => chosen.includes(t.id)).slice(0, 2);
}

function buildCoachResult() {
  const el = document.getElementById("coachResult");
  if (!el || !Coach.data) return;

  const goal = Coach.data.goals.find(g => g.id === Coach.selectedGoal) || null;
  const observations = selectedObservationObjects();
  const tags = allSelectedTags();
  const habitat = strongestHabitat(tags);
  const tagActions = actionsFromTags(tags);
  const season = selectedSeason();
  const seasonal = Coach.data.seasonal_actions?.[season] || [];
  const sun = document.getElementById("coachSun")?.value || "not sure";
  const water = document.getElementById("coachWater")?.value || "not sure";
  const space = document.getElementById("coachSpace")?.value || "small bed";

  const doFirst = uniqueItems([
    ...(goal?.first_actions || []),
    ...(tagActions.doItems || []),
    ...(seasonal || [])
  ]).slice(0, 9);
  const avoid = uniqueItems([
    ...(goal?.avoid || []),
    ...(tagActions.avoidItems || []),
    ...observations.map(o => o.avoid)
  ]).slice(0, 7);
  const observationMeanings = observations.map(o => `<li><strong>${coachEsc(o.label)}:</strong> ${coachEsc(o.means)} <em>${coachEsc(o.first_step)}</em></li>`).join("");
  const tests = recommendedTests(tags);

  el.innerHTML = `
    <div class="coach-result-header">
      <p class="eyebrow dark">Your beginner plan</p>
      <h3>${coachEsc(goal?.plain_goal || "Learn the soil first")}</h3>
      <p><strong>Likely soil personality:</strong> ${coachEsc(habitat?.label || "General soil habitat")}</p>
      <p>${coachEsc(habitat?.story || "Use soil clues and backyard tests before making big changes.")}</p>
    </div>

    <div class="coach-result-grid">
      <div class="coach-panel">
        <h4>What this means for roots</h4>
        <p>${coachEsc(habitat?.root_meaning || "Roots need the right balance of water, air, space, and soil cover.")}</p>
        <p class="small"><strong>Your setup:</strong> ${coachEsc(space)}; ${coachEsc(sun)} light; ${coachEsc(water)} water pattern.</p>
      </div>
      <div class="coach-panel">
        <h4>Likely soil-life jobs</h4>
        ${listHtml(habitat?.soil_life_jobs || ["Recyclers", "Root helpers", "Soil builders"])}
      </div>
      <div class="coach-panel do-panel">
        <h4>Do this first</h4>
        ${listHtml(doFirst)}
      </div>
      <div class="coach-panel avoid-panel">
        <h4>Avoid for now</h4>
        ${listHtml(avoid)}
      </div>
    </div>

    <div class="coach-result-grid two-col">
      <div class="coach-panel">
        <h4>What your observations may mean</h4>
        ${observations.length ? `<ul>${observationMeanings}</ul>` : `<p class="small">Select one or more observations above to make this more specific.</p>`}
      </div>
      <div class="coach-panel">
        <h4>Best backyard test to confirm</h4>
        ${tests.map(t => `<p><strong>${coachEsc(t.label)}:</strong> ${coachEsc(t.how_to)}</p>`).join("")}
        ${Coach.testNotes.length ? `<div class="test-note"><strong>Your test notes:</strong>${listHtml(Coach.testNotes)}</div>` : ""}
      </div>
    </div>

    <div class="coach-panel planting-panel">
      <h4>Simple planting structure</h4>
      <p>${coachEsc(goal?.bed_structure || habitat?.first_move || "Start small, keep soil covered, and match plants to the actual soil habitat.")}</p>
      <p><strong>Season focus:</strong> ${coachEsc(season[0].toUpperCase() + season.slice(1))}. ${coachEsc((seasonal || [])[0] || "Use the current season to decide planting and watering intensity.")}</p>
    </div>

    <div class="confidence-meter">
      <strong>Confidence:</strong> ${coachEsc(confidenceText())}
    </div>
  `;
}

function renderGoalCards() {
  const el = document.getElementById("coachGoalCards");
  if (!el) return;
  el.innerHTML = Coach.data.goals.map(goal => `
    <button type="button" class="option-card goal-card" data-goal="${coachEsc(goal.id)}">
      <strong>${coachEsc(goal.label)}</strong>
      <span>${coachEsc(goal.plain_goal)}</span>
    </button>
  `).join("");
  el.querySelectorAll("[data-goal]").forEach(button => {
    button.addEventListener("click", () => {
      Coach.selectedGoal = button.dataset.goal;
      el.querySelectorAll(".option-card").forEach(b => b.classList.remove("selected"));
      button.classList.add("selected");
      buildCoachResult();
    });
  });
  if (!Coach.selectedGoal && Coach.data.goals.length) {
    Coach.selectedGoal = Coach.data.goals[0].id;
    el.querySelector(`[data-goal="${Coach.selectedGoal}"]`)?.classList.add("selected");
  }
}

function renderObservationCards() {
  const el = document.getElementById("coachObservationCards");
  if (!el) return;
  el.innerHTML = Coach.data.observations.map(obs => `
    <button type="button" class="option-card observation-card" data-observation="${coachEsc(obs.id)}">
      <strong>${coachEsc(obs.label)}</strong>
      <span>${coachEsc(obs.first_step)}</span>
    </button>
  `).join("");
  el.querySelectorAll("[data-observation]").forEach(button => {
    button.addEventListener("click", () => {
      const id = button.dataset.observation;
      if (Coach.selectedObservations.has(id)) {
        Coach.selectedObservations.delete(id);
        button.classList.remove("selected");
      } else {
        Coach.selectedObservations.add(id);
        button.classList.add("selected");
      }
      buildCoachResult();
    });
  });
}

function renderTestCards() {
  const el = document.getElementById("backyardTestCards");
  if (!el) return;
  el.innerHTML = (Coach.data.backyard_tests || []).map(test => `
    <div class="test-card" data-test="${coachEsc(test.id)}">
      <h3>${coachEsc(test.label)}</h3>
      <p>${coachEsc(test.how_to)}</p>
      <label class="form-label" for="test-${coachEsc(test.id)}">${coachEsc(test.question)}</label>
      <select id="test-${coachEsc(test.id)}" data-test-choice="${coachEsc(test.id)}">
        <option value="">Choose a result...</option>
        ${test.choices.map((choice, i) => `<option value="${i}">${coachEsc(choice.label)}</option>`).join("")}
      </select>
      <p class="small test-output" id="test-out-${coachEsc(test.id)}"></p>
    </div>
  `).join("");
  el.querySelectorAll("[data-test-choice]").forEach(select => {
    select.addEventListener("change", () => {
      Coach.testTags = new Set();
      Coach.testNotes = [];
      document.querySelectorAll("[data-test-choice]").forEach(sel => {
        const test = Coach.data.backyard_tests.find(t => t.id === sel.dataset.testChoice);
        const choice = test?.choices?.[Number(sel.value)];
        const out = document.getElementById(`test-out-${sel.dataset.testChoice}`);
        if (choice) {
          (choice.tags || []).forEach(tag => Coach.testTags.add(tag));
          Coach.testNotes.push(`${test.label}: ${choice.meaning}`);
          if (out) out.textContent = choice.meaning;
        } else if (out) {
          out.textContent = "";
        }
      });
      buildCoachResult();
    });
  });
}

function renderSeasonCards() {
  const el = document.getElementById("seasonCards");
  if (!el) return;
  const seasons = Coach.data.seasonal_actions || {};
  el.innerHTML = Object.entries(seasons).map(([season, actions]) => `
    <div class="season-card">
      <h3>${coachEsc(season[0].toUpperCase() + season.slice(1))}</h3>
      ${listHtml(actions)}
    </div>
  `).join("");
}

function setupCoachInputs() {
  ["coachSun", "coachWater", "coachSoilGuess", "coachSpace", "coachSeason"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", buildCoachResult);
  });
  const reset = document.getElementById("coachReset");
  if (reset) {
    reset.addEventListener("click", () => {
      Coach.selectedGoal = Coach.data.goals[0]?.id || null;
      Coach.selectedObservations.clear();
      Coach.testTags.clear();
      Coach.testNotes = [];
      document.querySelectorAll(".option-card.selected").forEach(b => b.classList.remove("selected"));
      document.querySelector(`[data-goal="${Coach.selectedGoal}"]`)?.classList.add("selected");
      document.querySelectorAll("[data-test-choice]").forEach(s => { s.value = ""; });
      document.querySelectorAll(".test-output").forEach(p => { p.textContent = ""; });
      ["coachSun", "coachWater", "coachSoilGuess", "coachSpace", "coachSeason"].forEach(id => {
        const field = document.getElementById(id);
        if (field) field.selectedIndex = 0;
      });
      buildCoachResult();
    });
  }
}

async function initCoach() {
  const errorEl = document.getElementById("coachError");
  try {
    Coach.data = await loadCoachData();
    renderGoalCards();
    renderObservationCards();
    renderTestCards();
    renderSeasonCards();
    setupCoachInputs();
    buildCoachResult();
  } catch (err) {
    if (errorEl) errorEl.innerHTML = `<div class="notice"><strong>Soil Coach load error:</strong> ${coachEsc(err.message)}</div>`;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCoach);
} else {
  initCoach();
}
