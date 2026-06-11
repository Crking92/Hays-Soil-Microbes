# v0.7.1 GitHub JSON fix

This package fixes the GitHub Pages load error caused by invalid JSON tokens such as bare `NaN`.

Browsers require strict JSON. All `NaN`, `Infinity`, and `-Infinity` values in `data/*.json` have been converted to `null`.

## To update the GitHub repo

Replace the existing repository files with this package, especially:

- `data/*.json`
- `assets/app.js`

Then commit/push the changes. GitHub Pages should reload normally after the deployment finishes.
