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
    if (typeof setupGuidedCoach === "function") setupGuidedCoach();
  } catch (err) {
    if (errorEl) errorEl.innerHTML = `<div class="notice"><strong>Soil Coach load error:</strong> ${coachEsc(err.message)}</div>`;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCoach);
} else {
  initCoach();
}

/* v3 guided click-through learning path */
Coach.guidedStep = 0;
Coach.guidedSteps = ["welcome", "goal", "observations", "site", "tests", "lesson", "plan"];

function setCoachSelectValue(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = value;
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function syncGoalCards() {
  document.querySelectorAll("[data-goal]").forEach(button => {
    button.classList.toggle("selected", button.dataset.goal === Coach.selectedGoal);
  });
}

function syncObservationCards() {
  document.querySelectorAll("[data-observation]").forEach(button => {
    button.classList.toggle("selected", Coach.selectedObservations.has(button.dataset.observation));
  });
}

function currentGoal() {
  return Coach.data?.goals?.find(g => g.id === Coach.selectedGoal) || null;
}

function currentHabitat() {
  if (!Coach.data) return null;
  return strongestHabitat(allSelectedTags());
}

function planParts() {
  const goal = currentGoal();
  const observations = selectedObservationObjects();
  const tags = allSelectedTags();
  const habitat = currentHabitat();
  const tagActions = actionsFromTags(tags);
  const season = selectedSeason();
  const seasonal = Coach.data.seasonal_actions?.[season] || [];
  const doFirst = uniqueItems([...(goal?.first_actions || []), ...(tagActions.doItems || []), ...(seasonal || [])]).slice(0, 9);
  const avoid = uniqueItems([...(goal?.avoid || []), ...(tagActions.avoidItems || []), ...observations.map(o => o.avoid)]).slice(0, 7);
  return { goal, observations, tags, habitat, season, seasonal, doFirst, avoid };
}

function planText() {
  const parts = planParts();
  const obs = parts.observations.map(o => `- ${o.label}: ${o.means}`).join("\n") || "- No observations selected yet.";
  const jobs = (parts.habitat?.soil_life_jobs || []).map(x => `- ${x}`).join("\n") || "- Recyclers\n- Root helpers\n- Soil builders";
  const doItems = parts.doFirst.map(x => `- ${x}`).join("\n") || "- Keep soil covered.\n- Start small.\n- Confirm with one backyard test.";
  const avoidItems = parts.avoid.map(x => `- ${x}`).join("\n") || "- Avoid big changes from one clue alone.";
  return `My Soil Coach Plan\n\nGoal: ${parts.goal?.plain_goal || "Learn the soil first"}\nLikely soil habitat: ${parts.habitat?.label || "General soil habitat"}\n\nSoil story:\n${parts.habitat?.story || "Use site clues before making big changes."}\n\nWhat roots may experience:\n${parts.habitat?.root_meaning || "Roots need water, air, space, and cover."}\n\nMy observations:\n${obs}\n\nLikely soil-life jobs:\n${jobs}\n\nDo this first:\n${doItems}\n\nAvoid for now:\n${avoidItems}\n\nConfidence: ${confidenceText()}\n\nLimit: This is a habitat guide, not a lab soil test or fertilizer prescription.`;
}

function renderClueStack() {
  const el = document.getElementById("guidedClueStack");
  if (!el || !Coach.data) return;
  const parts = planParts();
  const clues = [];
  if (parts.goal) clues.push({ label: "Goal", value: parts.goal.label });
  if (parts.observations.length) clues.push({ label: "Observations", value: parts.observations.map(o => o.label).join(", ") });
  const sun = document.getElementById("coachSun")?.value;
  const water = document.getElementById("coachWater")?.value;
  const soil = document.getElementById("coachSoilGuess")?.value;
  const season = selectedSeason();
  if (sun) clues.push({ label: "Sun", value: sun });
  if (water) clues.push({ label: "Water", value: water });
  if (soil) clues.push({ label: "Soil clue", value: soil });
  if (season) clues.push({ label: "Season", value: season });
  if (Coach.testNotes.length) clues.push({ label: "Backyard tests", value: Coach.testNotes.join("; ") });
  clues.push({ label: "Current story", value: parts.habitat?.label || "General soil habitat" });
  el.innerHTML = clues.map(c => `<div class="clue-chip"><strong>${coachEsc(c.label)}</strong><span>${coachEsc(c.value)}</span></div>`).join("");
}

function guidedChoiceHtml(items, selectedCheck, attrs, small=false) {
  return `<div class="guided-choice-grid">${items.map(item => {
    const selected = selectedCheck(item) ? " selected" : "";
    const attrText = attrs(item);
    return `<button type="button" class="guided-choice${small ? " small-choice" : ""}${selected}" ${attrText}><strong>${coachEsc(item.label)}</strong><span>${coachEsc(item.description || item.plain_goal || item.first_step || item.meaning || "Choose this option.")}</span></button>`;
  }).join("")}</div>`;
}

function renderWelcomeStep() {
  const panel = document.getElementById("guidedCoachPanel");
  panel.innerHTML = `
    <h3>Start here</h3>
    <div class="big-question">Do you want the dashboard to guide you like a garden coach?</div>
    <p>This mode hides the technical database at first. You answer simple garden questions, and the tool explains what each clue means.</p>
    <div class="guided-choice-grid">
      <button type="button" class="guided-choice selected" data-guided-jump="1"><strong>Yes, guide me step by step</strong><span>Best for beginners, volunteers, public events, and new gardeners.</span></button>
      <a class="guided-choice" href="#fullCoach"><strong>Show all questions at once</strong><span>Best for people who already know what they want to enter.</span></a>
      <a class="guided-choice" href="map.html"><strong>Find my mapped soil first</strong><span>Use the map, then come back to interpret the result.</span></a>
    </div>
    <div class="guided-explain"><h4>How this teaches</h4><p>Each click becomes a clue. The plan changes as clues stack up, like matching puzzle pieces instead of guessing from one symptom.</p></div>
  `;
}

function renderGoalStep() {
  const panel = document.getElementById("guidedCoachPanel");
  panel.innerHTML = `
    <h3>Question 1</h3>
    <div class="big-question">What are you trying to do in the garden?</div>
    <p>Different goals need different first steps. A pollinator bed, a struggling bed, and an erosion area should not all get the same advice.</p>
    ${guidedChoiceHtml(Coach.data.goals, g => g.id === Coach.selectedGoal, g => `data-guided-goal="${coachEsc(g.id)}"`)}
    <div class="guided-explain"><h4>Why this matters</h4><p>The goal chooses the safest first action. For example, a struggling bed should be observed before adding fertilizer, while a new native bed needs plant structure and soil cover.</p></div>
  `;
}

function renderObservationStep() {
  const panel = document.getElementById("guidedCoachPanel");
  panel.innerHTML = `
    <h3>Question 2</h3>
    <div class="big-question">What do you notice with your eyes, hands, or plants?</div>
    <p>Pick every clue that fits. These are not final diagnoses; they are beginner-friendly hints.</p>
    ${guidedChoiceHtml(Coach.data.observations, o => Coach.selectedObservations.has(o.id), o => `data-guided-observation="${coachEsc(o.id)}"`)}
    <div class="guided-explain"><h4>What this teaches</h4><p>Plants often show soil problems indirectly. Yellow leaves, wilting, crusting, and cracking can all come from water, roots, air, pH, or compaction.</p></div>
  `;
}

function buttonGroup(label, id, options) {
  const current = document.getElementById(id)?.value || "";
  return `<div class="guided-mini-card"><h4>${coachEsc(label)}</h4><div class="guided-choice-grid">${options.map(opt => `<button type="button" class="guided-choice small-choice${current === opt.value ? " selected" : ""}" data-select-target="${coachEsc(id)}" data-select-value="${coachEsc(opt.value)}"><strong>${coachEsc(opt.label)}</strong><span>${coachEsc(opt.help || "")}</span></button>`).join("")}</div></div>`;
}

function renderSiteStep() {
  const panel = document.getElementById("guidedCoachPanel");
  panel.innerHTML = `
    <h3>Question 3</h3>
    <div class="big-question">What simple site clues can you add?</div>
    <p>These choices help separate clay, limestone, shallow soil, shade, runoff, and true wet spots.</p>
    <div class="guided-mini-result">
      ${buttonGroup("Sunlight", "coachSun", [
        { value: "full sun", label: "Full sun", help: "Prairie-style plantings often fit." },
        { value: "part sun", label: "Part sun", help: "Use edge or mixed-light plants." },
        { value: "shade", label: "Mostly shade", help: "Protect tree roots and leaf litter." }
      ])}
      ${buttonGroup("Water pattern", "coachWater", [
        { value: "dry", label: "Usually dry", help: "Drought and soil cover matter." },
        { value: "average", label: "Average", help: "A wider plant palette may work." },
        { value: "wet", label: "Stays wet", help: "Confirm if this is true wet soil." },
        { value: "runoff", label: "Runs off", help: "Slow and spread stormwater." }
      ])}
      ${buttonGroup("Soil clue", "coachSoilGuess", [
        { value: "clay", label: "Sticky clay", help: "Slow water; protect structure." },
        { value: "shallow", label: "Rocky/shallow", help: "Less root room; dries fast." },
        { value: "limestone", label: "Limestone", help: "High pH and calcium-adapted plants." },
        { value: "cover", label: "Bare/crusty", help: "Soil needs armor and roots." }
      ])}
      ${buttonGroup("Season", "coachSeason", [
        { value: "spring", label: "Spring", help: "Plant before heat when possible." },
        { value: "summer", label: "Summer", help: "Protect, observe, water carefully." },
        { value: "fall", label: "Fall", help: "Best native planting window." },
        { value: "winter", label: "Winter", help: "Plan and observe drainage." }
      ])}
    </div>
    <div class="guided-explain"><h4>Why this matters</h4><p>The same symptom can mean different things in different places. Wilting in shallow limestone, compacted clay, and a wet low spot needs different treatment.</p></div>
  `;
}

function renderTestsStep() {
  const panel = document.getElementById("guidedCoachPanel");
  const tests = Coach.data.backyard_tests || [];
  panel.innerHTML = `
    <h3>Question 4</h3>
    <div class="big-question">Can you add one backyard test result?</div>
    <p>Choose a result only if you have done the test or already know the answer. You can skip this step.</p>
    <div class="guided-mini-result">
      ${tests.map(test => `<div class="guided-mini-card"><h4>${coachEsc(test.label)}</h4><p>${coachEsc(test.how_to)}</p><div class="guided-choice-grid">${test.choices.map((choice, i) => `<button type="button" class="guided-choice small-choice" data-guided-test="${coachEsc(test.id)}" data-guided-test-choice="${i}"><strong>${coachEsc(choice.label)}</strong><span>${coachEsc(choice.meaning)}</span></button>`).join("")}</div></div>`).join("")}
    </div>
    <div class="guided-explain"><h4>Beginner warning</h4><p>Do not over-trust one test. A small bed can be changed by fill dirt, irrigation, foot traffic, construction, or buried rock.</p></div>
  `;
}

function renderLessonStep() {
  const panel = document.getElementById("guidedCoachPanel");
  const habitat = currentHabitat();
  panel.innerHTML = `
    <h3>Mini lesson</h3>
    <div class="big-question">Soil is a habitat, not just dirt.</div>
    <p>Your current clues point toward <strong>${coachEsc(habitat?.label || "a general soil habitat")}</strong>.</p>
    <div class="guided-mini-result">
      <div class="guided-mini-card"><h4>Water</h4><p>Water needs a path into the soil and a place to leave. Clay, crusting, compaction, slopes, and rock all change that path.</p></div>
      <div class="guided-mini-card"><h4>Air</h4><p>Roots and many soil organisms need oxygen. Wet, compacted, or sealed soil can reduce air in tiny spaces.</p></div>
      <div class="guided-mini-card"><h4>Food</h4><p>Leaves, roots, mulch, and dead plant material feed the tiny recycler workers.</p></div>
      <div class="guided-mini-card"><h4>Room</h4><p>Roots need space. Shallow rock, dense clay, and compaction can limit the underground house.</p></div>
    </div>
    <div class="lesson-check">
      <strong>Quick check:</strong> Which action usually helps most beginner soil habitats first?
      <div class="guided-choice-grid">
        <button type="button" class="guided-choice small-choice" data-quiz="wrong"><strong>Add lots of fertilizer first</strong><span>Sometimes useful after testing, but not the first default.</span></button>
        <button type="button" class="guided-choice small-choice" data-quiz="right"><strong>Keep soil covered and match plants to the habitat</strong><span>This helps water, heat, roots, and soil-life jobs.</span></button>
        <button type="button" class="guided-choice small-choice" data-quiz="wrong"><strong>Till deeply every season</strong><span>This can damage structure, especially in clay.</span></button>
      </div>
      <div id="quizFeedback" class="quiz-feedback"></div>
    </div>
  `;
}

function renderPlanStep() {
  const panel = document.getElementById("guidedCoachPanel");
  const parts = planParts();
  panel.innerHTML = `
    <h3>Your beginner plan</h3>
    <div class="big-question">Start small, protect the soil, and confirm with observations.</div>
    <p><strong>Likely soil habitat:</strong> ${coachEsc(parts.habitat?.label || "General soil habitat")}</p>
    <p>${coachEsc(parts.habitat?.story || "Use soil clues and backyard tests before making big changes.")}</p>
    <div class="guided-mini-result">
      <div class="guided-mini-card"><h4>Do this first</h4>${listHtml(parts.doFirst)}</div>
      <div class="guided-mini-card"><h4>Avoid for now</h4>${listHtml(parts.avoid)}</div>
      <div class="guided-mini-card"><h4>Likely soil-life jobs</h4>${listHtml(parts.habitat?.soil_life_jobs || [])}</div>
      <div class="guided-mini-card"><h4>Confidence</h4><p>${coachEsc(confidenceText())}</p></div>
    </div>
    <div class="guided-explain"><h4>Copyable plan</h4><div id="copyPlanText" class="copy-plan-box">${coachEsc(planText())}</div><div class="result-actions" style="margin-top:10px;"><button id="copyPlanButton" type="button">Copy plan</button><button id="printPlanButton" type="button" class="secondary">Print page</button></div></div>
  `;
}

function renderGuidedCoach() {
  const panel = document.getElementById("guidedCoachPanel");
  if (!panel || !Coach.data) return;
  const total = Coach.guidedSteps.length;
  if (Coach.guidedStep < 0) Coach.guidedStep = 0;
  if (Coach.guidedStep >= total) Coach.guidedStep = total - 1;
  const stepName = Coach.guidedSteps[Coach.guidedStep];
  const badge = document.getElementById("guidedStepBadge");
  const fill = document.getElementById("guidedProgressFill");
  if (badge) badge.textContent = `Step ${Coach.guidedStep + 1} of ${total}`;
  if (fill) fill.style.width = `${((Coach.guidedStep + 1) / total) * 100}%`;

  if (stepName === "welcome") renderWelcomeStep();
  if (stepName === "goal") renderGoalStep();
  if (stepName === "observations") renderObservationStep();
  if (stepName === "site") renderSiteStep();
  if (stepName === "tests") renderTestsStep();
  if (stepName === "lesson") renderLessonStep();
  if (stepName === "plan") renderPlanStep();

  renderClueStack();
  setupGuidedStepEvents();
  const back = document.getElementById("guidedBack");
  const next = document.getElementById("guidedNext");
  if (back) back.disabled = Coach.guidedStep === 0;
  if (next) next.textContent = Coach.guidedStep === total - 1 ? "Review again" : "Next";
}

function setupGuidedStepEvents() {
  document.querySelectorAll("[data-guided-jump]").forEach(button => {
    button.addEventListener("click", () => {
      Coach.guidedStep = Number(button.dataset.guidedJump) || 0;
      renderGuidedCoach();
    });
  });
  document.querySelectorAll("[data-guided-goal]").forEach(button => {
    button.addEventListener("click", () => {
      Coach.selectedGoal = button.dataset.guidedGoal;
      syncGoalCards();
      buildCoachResult();
      renderGuidedCoach();
    });
  });
  document.querySelectorAll("[data-guided-observation]").forEach(button => {
    button.addEventListener("click", () => {
      const id = button.dataset.guidedObservation;
      if (Coach.selectedObservations.has(id)) Coach.selectedObservations.delete(id);
      else Coach.selectedObservations.add(id);
      syncObservationCards();
      buildCoachResult();
      renderGuidedCoach();
    });
  });
  document.querySelectorAll("[data-select-target]").forEach(button => {
    button.addEventListener("click", () => {
      setCoachSelectValue(button.dataset.selectTarget, button.dataset.selectValue);
      buildCoachResult();
      renderGuidedCoach();
    });
  });
  document.querySelectorAll("[data-guided-test]").forEach(button => {
    button.addEventListener("click", () => {
      const testId = button.dataset.guidedTest;
      const choiceIndex = Number(button.dataset.guidedTestChoice);
      const select = document.querySelector(`[data-test-choice="${CSS.escape(testId)}"]`);
      if (select) {
        select.value = String(choiceIndex);
        select.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        const test = Coach.data.backyard_tests.find(t => t.id === testId);
        const choice = test?.choices?.[choiceIndex];
        if (choice) {
          (choice.tags || []).forEach(tag => Coach.testTags.add(tag));
          Coach.testNotes.push(`${test.label}: ${choice.meaning}`);
        }
      }
      buildCoachResult();
      renderGuidedCoach();
    });
  });
  document.querySelectorAll("[data-quiz]").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-quiz]").forEach(b => b.classList.remove("selected"));
      button.classList.add("selected");
      const out = document.getElementById("quizFeedback");
      if (out) out.textContent = button.dataset.quiz === "right" ? "Correct. Cover + right plant match is the safest first soil-health move." : "Not the safest first move. Test, observe, cover soil, and match plants before major inputs.";
    });
  });
  const copyButton = document.getElementById("copyPlanButton");
  if (copyButton) {
    copyButton.addEventListener("click", async () => {
      const text = planText();
      try {
        await navigator.clipboard.writeText(text);
        copyButton.textContent = "Copied";
      } catch (_) {
        copyButton.textContent = "Select the text above to copy";
      }
    });
  }
  const printButton = document.getElementById("printPlanButton");
  if (printButton) printButton.addEventListener("click", () => window.print());
}

function setupGuidedCoach() {
  const back = document.getElementById("guidedBack");
  const next = document.getElementById("guidedNext");
  const restart = document.getElementById("guidedRestart");
  if (back) back.addEventListener("click", () => { Coach.guidedStep -= 1; renderGuidedCoach(); });
  if (next) next.addEventListener("click", () => {
    if (Coach.guidedStep >= Coach.guidedSteps.length - 1) Coach.guidedStep = 1;
    else Coach.guidedStep += 1;
    renderGuidedCoach();
  });
  if (restart) restart.addEventListener("click", () => {
    Coach.guidedStep = 0;
    const reset = document.getElementById("coachReset");
    if (reset) reset.click();
    renderGuidedCoach();
  });
  renderGuidedCoach();
}
