# Soil Coach v3 click-through learning path

## Purpose

This update makes the beginner experience more interactive and easier to teach. The main gardener page now starts with a guided, one-question-at-a-time path before showing the full control panel.

## New interaction pattern

The guided path has seven steps:

1. Welcome / choose guided mode
2. Garden goal
3. Observed soil or plant clues
4. Simple site clues: sun, water, soil clue, season
5. Backyard tests
6. Mini lesson: soil as habitat
7. Copyable beginner plan

## Beginner design principle

The page should not ask beginners to understand pH, SSURGO component tables, microbial gene hits, or soil taxonomy before getting value. Those details remain available later, but the first experience should answer:

- What is my likely soil habitat?
- What might roots be experiencing?
- What soil-life jobs are likely important here?
- What should I do first?
- What should I avoid for now?

## Technical notes

Updated files:

- `gardener.html`
- `assets/soil-coach.js`
- `assets/style.css`
- `README.md`
- `docs/soil_coach_v2_notes.md`

The guided path reuses `data/beginner_soil_coach.json` rather than adding a separate data model. This keeps the full-control view and guided view synchronized.

## Limitation

The copied plan is still a habitat guide, not a fertilizer prescription, engineering report, or exact microbial assay.
