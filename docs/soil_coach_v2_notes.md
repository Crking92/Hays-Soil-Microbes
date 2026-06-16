# Soil Coach v2 notes

This version turns the Soil Habitat Translator into a beginner-first garden tool.

## Added

- `gardener.html` is now **My Soil Coach**.
- Added an interactive beginner flow:
  - garden goal
  - observed symptoms
  - sunlight / water / season / soil clues
  - backyard test results
  - generated beginner action plan
- Added `data/beginner_soil_coach.json` as the editable content file for beginner goals, symptoms, tests, seasonal actions, and safe recommendations.
- Added `assets/soil-coach.js` to render the interactive coach.
- Added beginner planting recipes and quick action shortcuts to `actions.html`.
- Added a plain-language decoder to `research.html`.
- Added a beginner next-step block to `map.html`.

## Design principle

The public tool should act like a soil habitat coach:

1. Start with what the user wants to do.
2. Translate what they see in the yard.
3. Give a safe first action.
4. Tell them what not to do yet.
5. Offer one simple backyard test to improve confidence.
6. Keep technical evidence available but not first.

## Scientific caution

The coach does not diagnose an exact property, prescribe fertilizer, or prove microbe activity at a site. It combines mapped soil habitat, user observations, simple tests, and broad ecological interpretation.


## Version 3 click-through learning path

This release adds a beginner-first guided mode on `gardener.html`. Instead of showing all controls at once, the page now walks users through one choice at a time: goal, observations, site clues, backyard tests, a mini soil-habitat lesson, and a copyable beginner plan. The older all-at-once controls remain below the guided mode for staff, advanced users, and demonstrations.

The design goal is to make the project feel like a soil habitat coach rather than a database: every click becomes a clue, every clue gets a plain-language explanation, and the final result emphasizes what roots experience, likely soil-life jobs, first actions, and things to avoid.
