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
- **Sergio** decides on desktop which batches get premium treatment and tunes the decision rule with the **"perilla del dinero"** (cost-based threshold).

Team credits (already in README): Elias Vega Rios (data model), Francisco Romero de la Parra (architecture and management), Diego García Serrano (UX/UI and communication).

## 2. Current state

| Area | State |
|---|---|
| Model (`modelo/`) | Done, committed. 7.6 MB `.joblib` is in the repo. |
| API (`api/`, FastAPI + SQLite) | Done, committed, **50 pytest tests pass**. |
| Web (`web/`, React + Vite + TS + Tailwind v4 + PWA) | **Redesigned twice this session; the redesign is NOT committed.** |
| Docs (`docs/`) | Architecture diagram (PNG/SVG), user flow, `ruta_a_produccion.md`, README with screenshots. Updated for the redesign but **uncommitted**. |
| GitHub | Pushed at commit `98d1fde` (the **first** UI version, before any redesign). |

**Uncommitted work (33 changed files):** the whole redesign (new views, `Sello`, `Dial`, `Panel`, `Cabecera`, new screenshots, README/docs edits, one small API change). Run `git status` to see it. **Nothing was committed or pushed for the redesign because the owner did not ask.** Ask before committing/pushing; suggested split: `web: rediseño (una pantalla por persona, sello, perilla)`, `api: filtro de capturas por prefijo`, `docs: capturas y texto nuevos`.

**The app is currently running** on http://localhost:8000 (started with `iniciar.ps1`, fresh DB with 30 demo lots). If the session is new, it may be stopped: run `.\iniciar.ps1`.

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

## 6. Design system (current "classy" direction)

The owner first asked for something "more original/creative and less confusing", then for something "more classy". Current state is the refined version.

- **Structure:** one screen per person, **no tabs**.
  - Enóloga: home (big "Capturar lote nuevo" button + her recent lots) → capture (grouped fields, fixed progress bar) → full-screen result.
  - Sergio: single dashboard. Header sentence + color counters that double as filters → "Libro de lotes" grouped by semáforo → **side panel** for a lot (result, reasons, simulator "¿Qué pasa si…?", decision footer) → **side panel** "La perilla del dinero" opened from the "Regla: Prometedor desde X %" button in the top bar. Role switch lives in the profile menu (corner).
- **Palette** (tokens in `web/src/index.css`): Noche `#11283D`, Marino `#1B3A57`, Turquesa `#0F7C7A` (actions/confirmations), Papel `#F4F6F8`, Hielo `#E8EDF2`, muted brass **Latón `#B98A3E`** for hairlines/details (brand amber `#E09F3E` kept but rarely used). Semáforo: `#4E8B3A`, `#E0A11B`, `#C0392B` plus dark "tinta" variants for text (AA contrast).
- **Type:** **Newsreader** (display serif, light/regular/medium) for headlines and big numbers; **Inter** for forms/tables/body. `.font-display` also forces lining figures.
- **Shape:** 8 px buttons, 12 px panels, 1 px hairlines, no drop shadows. Motion is limited to the seal settling in once and the side panel sliding in; both respect `prefers-reduced-motion`.
- **Signature element: the seal ("sello")** (`web/src/Sello.tsx`): engraved, serrated-edge stamp with the word around the rim and "N de cada 100" in the center. `SelloMini` is the small list version.
- **The knob** (`web/src/Dial.tsx`): a real rotary control (drag with mouse/touch, arrow keys, Home/End/PageUp/PageDown, `role="slider"`), 0.05–0.95 in steps of 0.05, brass indicator, amber-brass diamond marking the cheapest rule.
- Style traps to avoid (from the design guidance): warm cream page + serif + terracotta; all-caps tracked eyebrow labels; "·"-joined meta strings; single accented word in a headline; numbered markers where there is no real sequence.

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
web/src/Sello.tsx, Dial.tsx, Panel.tsx, ui.tsx, util.ts, offline.ts, api.ts, tipos.ts
web/src/vistas/Enologa.tsx    home, capture, result, pending (offline) screens
web/src/vistas/Sergio.tsx     dashboard and ledger
web/src/vistas/FichaLote.tsx  lot panel + simulator + decisions
web/src/vistas/PerillaPanel.tsx  knob panel + cost chart
docs/                         arquitectura.*, flujo_usuarios.md, ruta_a_produccion.md, capturas/, tomar_capturas.py
```

Notes: the web no longer calls `GET /resumen` (title and counters come from the same `/lotes` list, default period "Últimos 7 días"); the endpoint still exists. `GET /lotes?capturado_por=` matches by **prefix**, so "Enóloga" also finds "Enóloga (demo)".

## 8. Next steps (suggested order)

1. **Ask the owner whether to commit and push the redesign** (see section 2). Do not push without asking; the repo is public.
2. **Bring the end-to-end UI test into the repo.** It covered: counter filters, search, panel open/close with Esc, simulator, decision saved, knob by keyboard and drag, "cheapest" and quick modes, profile-menu role switch, mobile capture, focus on first empty field, offline queue and auto-sync, no horizontal overflow at 390 px. Recreate it as `docs/prueba_interfaz.py` (Playwright, Python) and mention it in the README. Gotchas it taught: scope locators (`get_by_role("group", name="Filtrar por semáforo")`, `get_by_role("dialog")`) because the seals' accessible names repeat the words; reset the active rule to 0.5 before running.
3. **Accessibility pass** with a screen reader or axe: seals are `role="img"` with descriptive labels (row buttons therefore start with the semáforo word); the knob is a slider; panel traps focus. Check the brass-on-white hairlines and the muted text contrast.
4. **Open questions for Sergio / the team** (also listed in `docs/ruta_a_produccion.md`, marked ❓): which lab analyses the winery really measures and in what units/stage; historical lots with tasting scores; what he considers "prometedor"; real costs for the perilla; tank/barrel names and lot naming; who captures, on what device, with what connectivity; reports he needs; users and roles; Figma link, final name/logo, presentation date; dataset source.
5. **Roadmap items** (all in `ruta_a_produccion.md`, none started): Supabase/PostgreSQL + Alembic, real auth with roles, native Expo app, hosting, retraining with winery data + calibration + SHAP, tasting-feedback loop, monthly PDF/Excel reports, Sentry, audit log, LFPDPPP privacy notice.
6. Known small things: Docker/Make untested; the order of the capture fields is a proposal to confirm with the enóloga (`api/variables.py`, grouping in `web/src/vistas/Enologa.tsx`); the weekly period default means older lots are hidden until the period is widened (consider a hint).

## 9. Working agreements with this owner

- Ask before **hard-to-reverse or outward-facing** actions (creating repos, pushing, publishing). Approval for one push does not cover the next.
- Show a short plan first for big work, then build step by step and **verify by running** (tests + real browser), and report honestly, including what could not be tested.
- Privacy: keep the owner's personal details out of commits, public files and external requests.
- Before design work, load the `frontend-design:frontend-design` skill and follow its plan → review → build → critique process.
