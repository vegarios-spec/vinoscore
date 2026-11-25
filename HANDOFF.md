# VinoScore: handoff for the next session

Written at the end of a long session so a fresh Claude Code session (or a person) can continue without re-deriving anything. Read this first, then `README.md`.

- **Project folder:** `C:\Users\Elias\vinoscore`
- **GitHub:** https://github.com/vegarios-spec/vinoscore (public, branch `main`)
- **Owner's language:** the app, README and docs are in **Mexican Spanish**. The owner's last messages were in English, so answer in the language they write in, but keep all user-facing app text in Spanish (México), plain words, no jargon.

---

## 1. What VinoScore is

A prototype for a Tec de Monterrey project. The partner is **Sergio García**, an accountant who runs a winery. A Random Forest estimates whether a white-wine batch (*caldo*) is **"prometedor"** (sensory quality ≥ 7) from 11 lab measurements.

Two users, one shared database:
- **La enóloga** captures lab analyses on a phone (PWA, offline queue) and instantly sees a result.
- **Sergio** decides on desktop which batches get premium treatment and tunes the **decision rule** (cost-based threshold; called "perilla del dinero" in earlier versions).

Team credits (already in README): Elias Vega Rios (data model), Francisco Romero de la Parra (architecture and management), Diego García Serrano (UX/UI and communication).

## 2. Current state

| Area | State |
|---|---|
| Model (`modelo/`) | Done, committed. 7.6 MB `.joblib` is in the repo. |
| API (`api/`, FastAPI + SQLite) | Done, committed, **50 pytest tests pass**. |
| Web (`web/`, React + Vite + TS + Tailwind v4 + PWA) | **Third design ("tool" look, dark by default) done on branch `worktree-rediseno-oscuro`, committed locally, NOT pushed.** |
| Docs (`docs/`) | Architecture diagram (PNG/SVG), user flow, `ruta_a_produccion.md`, README with new screenshots, `prueba_interfaz.py`, design spec and plan in `docs/superpowers/`. |
| GitHub | Pushed at commit `98d1fde` (the **first** UI version, before any redesign). |

**Update 2026-11-25 (third design).** The owner said the second design "looks made by an AI" and asked for something classy, minimal, professional, a *tool*, dark mode by default, **never rounded corners**, and nothing hidden. That work lives on branch `worktree-rediseno-oscuro` (worktree `.claude/worktrees/rediseno-oscuro`). Its first commit is a copy of the second design, which was never committed in the main checkout, followed by the new design. The main checkout (`main`) still has the second design as uncommitted files. **Nothing is pushed; ask before pushing** (the repo is public). An editable architecture whiteboard exists at https://claude.ai/artifact/MYiLjvCHMbxYKbG3Ck6kDE (private until the owner shares it).

**The app runs** with `.\iniciar.ps1` on http://localhost:8000 from whichever folder you start it in. Each folder has its own `vinoscore.db`.

## 3. How to run and test

```powershell
cd C:\Users\Elias\vinoscore
.\iniciar.ps1                                    # installs, builds web, seeds demo, starts on :8000
.\.venv\Scripts\python.exe -m pytest api/tests -q   # 50 tests
cd web; npm run build                            # tsc --noEmit is run separately: npx tsc --noEmit
```

- Sergio view: http://localhost:8000 on a wide screen (or `/?rol=sergio`). Enóloga: `/?rol=enologa`. API docs: `/docs`.
- The API serves `web/dist` at `/` when it exists, so a rebuild is enough (no server restart) **unless the API code changed**.
- Reset demo data: stop the server, delete `vinoscore.db`, run `python -m api.sembrar_demo`, start again.
- **Docker, `Makefile` and `docker-compose.yml` exist but were never tested** (this machine has neither Docker nor `make`). Say so if asked.

## 4. Machine and tooling gotchas (Windows 11)

- **Node is installed but not on PATH in Claude's shell.** Before `npm`/`npx`, refresh PATH: PowerShell `$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")`; in Git Bash `export PATH="$PATH:/c/Program Files/nodejs"`.
- **`gh` is at `C:\Program Files\GitHub CLI\gh.exe`** (not on PATH), already authenticated as `vegarios-spec`.
- Python 3.14 venv in `.venv/`. Run Python with `PYTHONUTF8=1` when printing accents (Windows console is cp1252).
- Playwright + Chromium are installed (venv + `%LOCALAPPDATA%\ms-playwright`). `docs/tomar_capturas.py` retakes the README screenshots; it **creates a lot `DEMO-CAPTURA` and changes the active rule**, so reset the DB afterwards.
- **Diagrams:** exported with `@mermaid-js/mermaid-cli` installed in a *temporary scratch folder* (not in the repo), pointed at Playwright's Chromium via a puppeteer config. Instructions to redo it are in `docs/arquitectura.md`.
- The Playwright end-to-end scripts used during development lived in the session's scratchpad and **are gone**. See "Next steps" to bring them into the repo.
- `npm audit` reports 4 moderate findings in build-time tooling (`workbox-build` → `glob`/`minimatch`). They never ship in the app; deliberately left alone.
- Bash tool quirk: long heredocs containing many quotes can fail to parse; write scripts with the file Write tool instead.

## 5. Decisions already made (do not re-litigate)

1. **Use our own model even though metrics differ slightly from the team's:** recall 0.377 vs 0.393 (accuracy 0.827 vs 0.831, AUC 0.843 vs 0.846). Cause: Random Forest noise / scikit-learn 1.9.1 version. `entrenar.py` accepts ±0.02. README shows our real figures.
2. **Python, not Rust.** The model is scikit-learn; load is ~30 lots/week. ONNX + a faster server is noted in `ruta_a_produccion.md` as a possible future path only.
3. **Public repo named `vinoscore`.** Commit author was rewritten to the GitHub noreply address `333987803+vegarios-spec@users.noreply.github.com` (repo-local git config) so the owner's personal email is **not** exposed. Never put the owner's real email into commits, files or external requests.
4. **Semáforo rule:** green if probability ≥ active threshold, yellow between 0.30 and the threshold, red below 0.30. Words: *Prometedor / Revisar en cata / Estándar*. Colors are always paired with text. Default threshold 0.5; quick modes "Sello Premium" 0.60 and "Filtro a cata" 0.30. Default costs $500 / $1,500 are **examples**.
5. **The 3 "reasons" are an approximation** (stated in README and in the UI). Variables whose median is equal for good and not-good wines (e.g. sulphates) are excluded from reasons.
6. **Demo data:** 30 lots `DEMO-01…30`, real wines from the model's *test* split, stratified by probability so all three colors appear. Flagged `es_demo` and shown with a DEMO badge. The UI says they are not winery data.
7. **Dataset provenance is unconfirmed.** It looks like the UCI *Wine Quality* (Vinho Verde) data cleaned by the team; README says "confirm before citing".

## 6. Design system (third direction: a professional tool, dark by default)

Full spec: `docs/superpowers/specs/2026-11-25-rediseno-oscuro-design.md`. History: the 1st design was plain; the 2nd ("classy": navy, serif, seal, rotary knob) was rejected as "looks made by an AI". Owner rules now: **no rounded corners ever** (also enforced globally in `index.css`), simple palette, dark mode as default with a light option, nothing hidden, easy data entry and reading, professional tone.

- **Structure:** one screen per person, no tabs.
  - Enóloga: home → capture (each field shows `Normal: a – b unit`; Enter goes to the next field, Enter on the last saves) → result ("NN %", semáforo word, bar with active threshold, factors) / pending (offline).
  - Sergio: **Regla de decisión** band on top (costs, threshold slider 0.05–0.95 + quick modes + "Más barato", implications, cost-per-threshold chart, Activate) → counters that filter + search/period/tank/CSV → **table** grouped by semáforo (left) + **lot card** always visible (right, sticky; opens the most promising lot). Below 1024 px the card opens as an overlay (Esc closes).
- **Theme:** `data-tema` on `<html>` ("oscuro" default, "claro"), saved in `localStorage` `vinoscore.tema`; an inline script in `index.html` applies it before paint. Toggle in the top bar.
- **Palette** (dark / light): background `#141516`/`#F7F7F5`, surface `#1C1D1F`/`#FFFFFF`, line `#2E3033`/`#DADAD7`, text `#ECECEA`/`#17181A`, muted `#9C9EA1`/`#5E6064`; semáforo green `#6CBF78`/`#2F7A3B`, amber `#E3B341`/`#8A6100`, red `#E8685A`/`#B3372B`. No brand accent: primary buttons are text-colored. Color only encodes data.
- **Type:** IBM Plex Sans only (400/500/600, bundled via `@fontsource/ibm-plex-sans`), scale 12/14/16/20/28/44, tabular figures for numbers.
- **Shape:** square everything, 1 px lines, no shadows or gradients; semáforo markers are small squares, always next to the word.
- **Copy:** "Regla de decisión" (was "La perilla del dinero"), "Lotes" (was "Libro de lotes"), "Simulador" (was "¿Qué pasa si…?"), "Factores principales" (was "Lo que más pesó"), "Avisar a dirección" (was "Avísale a Sergio").

## 7. File map

```
modelo/entrenar.py            trains + verifies model; writes vinoscore_rf.joblib and metricas.json
api/main.py                   endpoints (also /resumen, /variables, /metricas, /exportar.csv)
api/servicio_modelo.py        probability, semáforo, reasons, range warnings
api/perilla.py                expected-cost-by-threshold
api/sembrar_demo.py           demo lots (--solo-si-vacio seeds only if DB empty)
api/tests/                    50 pytest tests (temp DB, never the real one)
web/src/App.tsx               role routing (first visit: wide screen → Sergio, phone → enóloga)
web/src/Cabecera.tsx          top bar + profile menu (role switch, enóloga name)
web/src/tema.ts, almacen.ts  theme (dark default) and safe localStorage helpers
web/src/Panel.tsx, ui.tsx, util.ts, offline.ts, api.ts, tipos.ts
web/src/vistas/Enologa.tsx    home, capture, result, pending (offline) screens
web/src/vistas/Sergio.tsx     workspace: rule band + table + lot card
web/src/vistas/Regla.tsx      decision rule band (costs, slider, modes, chart, activate)
web/src/vistas/FichaLote.tsx  lot card: result, decision, factors, simulator, analyses, history
docs/                         arquitectura.*, flujo_usuarios.md, ruta_a_produccion.md, capturas/, tomar_capturas.py, prueba_interfaz.py
```

Notes: the web no longer calls `GET /resumen` (title and counters come from the same `/lotes` list, default period "Últimos 7 días"); the endpoint still exists. `GET /lotes?capturado_por=` matches by **prefix**, so "Enóloga" also finds "Enóloga (demo)".

## 8. Next steps (suggested order)

1. **Get the owner's review of the third design**, then ask whether to merge `worktree-rediseno-oscuro` into `main` and push. Do not push without asking; the repo is public.
2. ~~Bring the end-to-end UI test into the repo~~: done, `docs/prueba_interfaz.py` (sections `tema`, `sergio`, `enologa`). It writes test lots and decisions: run it against a demo DB (port 8001 from the worktree was used), never the winery's.
3. **Accessibility pass** with a screen reader or axe: the table rows are clickable `<tr>` with a button in the first cell; the threshold is a native range input; the overlay traps focus. Check muted-text contrast in both themes.
4. **Open questions for Sergio / the team** (also listed in `docs/ruta_a_produccion.md`, marked ❓): which lab analyses the winery really measures and in what units/stage; historical lots with tasting scores; what he considers "prometedor"; real costs for the decision rule; tank/barrel names and lot naming; who captures, on what device, with what connectivity; reports he needs; users and roles; Figma link, final name/logo, presentation date; dataset source.
5. **Roadmap items** (all in `ruta_a_produccion.md`, none started): Supabase/PostgreSQL + Alembic, real auth with roles, native Expo app, hosting, retraining with winery data + calibration + SHAP, tasting-feedback loop, monthly PDF/Excel reports, Sentry, audit log, LFPDPPP privacy notice.
6. Known small things: Docker/Make untested; the order of the capture fields is a proposal to confirm with the enóloga (`api/variables.py`, grouping in `web/src/vistas/Enologa.tsx`); the weekly period default means older lots are hidden until the period is widened (consider a hint).

## 9. Working agreements with this owner

- Ask before **hard-to-reverse or outward-facing** actions (creating repos, pushing, publishing). Approval for one push does not cover the next.
- Show a short plan first for big work, then build step by step and **verify by running** (tests + real browser), and report honestly, including what could not be tested.
- Privacy: keep the owner's personal details out of commits, public files and external requests.
- Before design work, load the `frontend-design:frontend-design` skill and follow its plan → review → build → critique process.
