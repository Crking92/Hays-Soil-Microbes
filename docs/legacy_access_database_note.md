# Legacy SSURGO Access database note

Uploaded file reviewed: `soildb_US_2003(4).mdb`

## What it appears to be

This file appears to be the older Microsoft Access SSURGO template / Soil Data Viewer style database shell used by USDA-NRCS workflows. It contains many SSURGO table names, report names, query names, and Soil Data Viewer references, but the local inspection did not find clear Hays County soil series names such as Brackett, Heiden, Comfort, Doss, Oakalla, Sunev, or Pedernales.

Public NRCS and related workflow documentation describes `soildb_US_2003.mdb` as a database that can be downloaded from Web Soil Survey and then populated or linked with the raw tabular SSURGO folder. In that workflow, the useful survey data are the raw tabular and spatial files, while the Access database acts mainly as a template/query/report interface.

## Dashboard decision

Do not use this file as a primary dashboard data source.

Use these instead:

- `tabular(1).zip` as the primary local soil attribute source.
- `spatial(1).zip` as the primary raw spatial/provenance source.
- Derived dashboard JSON/GeoJSON files for public web use.

## Why not use the MDB directly?

- It is a legacy Access format and is not ideal for a static public web dashboard.
- It likely duplicates or links to the same SSURGO tabular data already extracted from `tabular(1).zip`.
- It may require Microsoft Access, MDBTools, SSURGO Portal, or another database reader to fully inspect.
- It does not appear to add new Hays-specific soil habitat information beyond the raw tabular/spatial package already used.

## Best use

Keep it in the archive as optional provenance or for people who specifically want to open the legacy SSURGO database workflow in Microsoft Access. It should not be bundled into the public dashboard unless there is a specific reason, because it adds file size and technical complexity without improving the public soil habitat translator.
