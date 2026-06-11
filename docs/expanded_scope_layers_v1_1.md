# v1.1 expanded scope layers

The earlier map defaulted to the Kyle + ETJ soil polygon layer.

This version adds a map scope selector using `data/map_layer_manifest.json`.

Available layers in this build:

- Kyle + ETJ: City of Kyle plus ETJ clipped layer. Best for Kyle planning and public lookup.
- Hays County soil polygons: Hays County clipped from the available jurisdiction layer and SSURGO TX604 polygons.
- Comal + Hays SSURGO TX604: Full SSURGO TX604 soil survey area. This is broader than City of Kyle and includes Comal + Hays Counties.

## Build notes

- Joined mapunit names from mapunit.txt.
- Built full TX604 layer with 6037 polygons.
- Built Hays County clipped layer with 224 polygons.

## Interpretation

Kyle + ETJ remains the best layer for City of Kyle planning. The broader SSURGO TX604 layer is useful for context across the Comal/Hays soil survey area.
