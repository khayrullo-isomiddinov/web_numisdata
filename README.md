# Moneda Ibérica (MIB)

Web front-end for **[monedaiberica.org](https://monedaiberica.org)** — a knowledge platform for the study, cataloguing, and dissemination of ancient coinages from the Iberian Peninsula and southern France (6th–1st centuries BC).

Covers Greek, Punic, Iberian, Celtiberian, Vasconian, Lusitanian, and Latin issues. Core catalogue: 200+ mints, 4,000+ types, backed by a large documentary archive of coins from museums, private collections, and auctions.

Developed in the framework of the ARCH project (*Ancient Coinages as Related Cultural Heritage*). Data is managed with **Numisdata** (Dédalo ontology) and published through the Dédalo Publication Server API.

Current web version: **5.0.49** (see `tpl/version.inc`).

## Stack

| Layer | Requirement |
| --- | --- |
| Backend | PHP 8.3+ (strict typing) |
| Frontend | ES2021+ (ES6 modules / bundled assets) |
| Database | MariaDB 12.2.0+ (publication DB) |
| CMS / API | Dédalo Publication Server REST API (`JSON_TRIGGER_URL`) |

License: [GNU Affero General Public License v3](LICENSE).

## Features

- **Catalogue** — browse types, coins, mints, and hierarchies
- **Hoards & findspots** — geographic and contextual records
- **Map** — spatial view of mints / find data
- **Thesaurus** — controlled vocabularies and term navigation
- **Bibliography** — references linked to catalogue records
- **Thematic search** — filtered research queries
- **Research / analysis** — charts, regression, and related tools
- **Multilingual UI** — Spanish, English, French, Italian, Portuguese, Valencian (`lg-spa`, `lg-eng`, `lg-fra`, `lg-ita`, `lg-por`, `lg-cat`)

## Repository layout

```
web_mib/
├── web_app/          # App core: routing, page factory, API client, common helpers
├── tpl/              # Templates, JS/CSS, i18n, page modules (catalog, coin, mint, …)
│   ├── config/       # Local config (from sample.config.php — do not commit secrets)
│   ├── lang/         # Translation JSON files
│   └── version.inc   # WEB_VERSION / WEB_BUILD
├── .htaccess         # URL rewrite → web_app/web
└── AGENTS.md         # Conventions for contributors / AI agents
```

Public requests are rewritten to `web_app/web/` (see `.htaccess`). Templates under `tpl/` render catalogue sections (e.g. `catalog`, `type`, `coin`, `mint`, `hoard`, `map`, `thesaurus`, `biblio`, `research`).

## Configuration

1. Copy the sample config:

   ```bash
   cp tpl/config/sample.config.php tpl/config/config.php
   ```

2. Edit `tpl/config/config.php` for your environment:

   - `__WEB_BASE_URL__` / `__WEB_ROOT_WEB__` — site base URL and path
   - `WEB_DB` — publication database name
   - `JSON_TRIGGER_URL` — Dédalo publication API endpoint
   - `API_WEB_USER_CODE` — must match the publication server
   - `WEB_AR_LANGS`, mail, map provider, etc.

Do **not** edit production config in the repo; keep secrets out of version control.

## Development notes

- PHP classes use `snake_case` names and files like `class.{name}.php` (see `AGENTS.md`).
- Frontend assets are often built/minified (CodeKit / `JS_SUFFIX`); source lives beside `-min` bundles under `tpl/`.
- Agent-oriented coding rules: [`AGENTS.md`](AGENTS.md).

## Links

- Site: [https://monedaiberica.org](https://monedaiberica.org)
- Project context: ARCH / Numisdata / [Dédalo](https://dedalo.dev)
