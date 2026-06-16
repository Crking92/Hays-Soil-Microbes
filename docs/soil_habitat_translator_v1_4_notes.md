# Soil Habitat Translator v1.4 Implementation Notes

## Added from the uploaded files

- Parsed uploaded SSURGO tabular package: 51 map units, 183 components, 193 horizons, 2100 monthly records, 1081 plant-indicator records, 158 ecological-class records, and 141554 interpretation rows.
- Created `data/tx604_soil_summary.json` so the broader Hays/TX604 map layers have summary records for all 51 map units, not only the 43 Kyle/ETJ map units.
- Created `data/soil_component_mix.json` to show map-unit component mixtures.
- Created `data/source_manifest.json` as a source audit trail.

## Scientific changes

- Split overbroad `WET_FLOOD` into:
  - `TRUE_WET_FLOOD`: hydric, poorly drained, flooding/ponding, floodplain/riparian/bottomland evidence.
  - `CLAY_WET_DRY_MICROSITES`: clay/hydrologic-group C-D wet-dry behavior without implying true floodplain conditions.
- Added a limited-data gate. Components already labeled as insufficient property data, plus newly generated components with sparse raw properties, now receive a low-confidence public claim instead of detailed microbe-guild inference.
- Framed the public dashboard as a soil habitat translator: soil habitat -> possible soil-life jobs -> broad stewardship actions.

## Public-facing changes

- Renamed the beginner path toward “Soil Habitat Translator.”
- Simplified the research page into evidence layers and moved raw tables behind the technical appendix framing.
- Added map-unit mix tables to map lookup results.
- Added form labels and keyboard-selectable map polygons for accessibility.

## Files most changed

- `assets/map.js`
- `assets/app.js`
- `assets/gardener.js`
- `index.html`
- `gardener.html`
- `map.html`
- `research.html`
- `README.md`
- `data/kyle_etj_soil_summary.json`
- `data/tx604_soil_summary.json`
- `data/soil_component_mix.json`
- `data/source_manifest.json`
