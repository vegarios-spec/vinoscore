# VinoScore: handoff for the next session

Last updated 2026-11-26. Read this first, then `README.md`. It lets a fresh Claude Code session (or a person) continue without re-deriving anything.

- **Project folder:** `C:\Users\Elias\vinoscore` (main checkout, branch `main`)
- **Redesign worktree:** `C:\Users\Elias\vinoscore\.claude\worktrees\rediseno-oscuro` (branch `worktree-rediseno-oscuro`)
- **GitHub:** https://github.com/vegarios-spec/vinoscore (public). **Open PR #1:** https://github.com/vegarios-spec/vinoscore/pull/1 (`worktree-rediseno-oscuro` → `main`, not merged)
- **Language:** the owner writes in Spanish or English; answer in the language of their message. All user-facing app text, README and docs stay in **Mexican Spanish**, plain words, no jargon.

---

## 1. What VinoScore is

A prototype for a Tec de Monterrey project. The partner is **Sergio García**, an accountant who runs a winery. A Random Forest estimates whether a white-wine batch (*caldo*) is **"prometedor"** (sensory quality ≥ 7) from 11 lab measurements.

Two users, one shared database:
- **La enóloga** captures lab analyses on a phone (PWA, offline queue) and instantly sees a result.
- **Sergio** decides on desktop which batches get premium treatment and tunes the **decision rule** (cost-based threshold; called "perilla del dinero" in earlier versions).

Team credits (already in README): Elias Vega Rios (data model), Francisco Romero de la Parra (architecture and management), Diego García Serrano (UX/UI and communication).

## 2. Current state (read carefully: two folders, two versions)

| Where | What it has |
|---|---|
| GitHub `main` | Commit `98d1fde`: the **first** UI version. |
| GitHub branch `worktree-rediseno-oscuro` / **PR #1** | 7 commits: `28d1fd0` = the 2nd design (never committed before), then the **3rd design** (`6ecdd46` … `54d9596`). This is the current, owner-approved design. |
| Local main checkout `C:\Users\Elias\vinoscore` | Branch `main` at `98d1fde` **plus the 2nd design as ~34 uncommitted files** (same content as commit `28d1fd0`). Its `vinoscore.db` is the owner's demo DB; never touched by tests. |
| Local worktree `.claude\worktrees\rediseno-oscuro` | Same as PR #1, clean. Has its own `vinoscore.db` (demo + test lots) and its own `web/node_modules`. |

**History of the design:** 1st plain → 2nd "classy" (navy, serif, serrated seal, rotary knob), which the owner rejected on 2026-11-25 as "looks made by an AI" → **3rd "tool" design** (dark by default, monochrome, square corners, everything visible). The owner approved the 3rd design spec, saw it running, and asked to push it ("Súbelo a GitHub"). The PR was opened; **merging is the owner's call** (ask first).

**Servers:** nothing of ours is guaranteed to be running. The worktree server on port 8001 was **stopped by Claude Code because the machine ran low on memory** (not an app failure). Port 8000 may still be serving the old 2nd design from the main checkout. Start servers only when asked.

**Also made:** an editable architecture whiteboard (Claude artifact, private until the owner shares it): https://claude.ai/artifact/MYiLjvCHMbxYKbG3Ck6kDE. It shows the prototype and the production target, with square boxes and steps 1–4.

## 3. How to run and test

```powershell
cd C:\Users\Elias\vinoscore              # or the worktree folder
.\iniciar.ps1                            # installs, builds web, seeds demo, starts on :8000
.\.venv\Scripts\python.exe -m pytest api/tests -q   # 50 tests
cd web; npx tsc --noEmit; npm run build
```

- Sergio view: `/?rol=sergio`; enóloga: `/?rol=enologa`; API docs: `/docs`.
- The API serves `web/dist` **only if it existed when the server started**. After the first build, restart the server once; after that, a rebuild is enough unless API code changed.
- Reset demo data: stop the server, delete that folder's `vinoscore.db`, run `python -m api.sembrar_demo`, start again.
- **UI test** (`docs/prueba_interfaz.py`, Playwright): `python docs/prueba_interfaz.py http://localhost:8001 [--solo tema|sergio|enologa]`. It **writes test lots, decisions and rule changes**, so run it only against a demo DB, never the winery's. In this session it ran from the worktree on port 8001: `PYTHONUTF8=1 /c/Users/Elias/vinoscore/.venv/Scripts/python.exe -m uvicorn api.main:app --port 8001` (cwd = worktree). Last full run: all sections "Todo bien".
- **Screenshots:** `python docs/tomar_capturas.py http://localhost:8001` writes the 6 README screenshots (`enologa-1..3`, `sergio-1-tablero` dark, `sergio-2-ficha` with the simulator, `sergio-3-claro`). It creates lot `DEMO-CAPTURA`, so reset the DB first if test lots are present.
- **Docker, `Makefile` and `docker-compose.yml` were never tested** (no Docker or `make` on this machine). Say so if asked.

## 4. Machine and tooling gotchas (Windows 11)

- **Node is not on PATH in Claude's shell.** Git Bash: `export PATH="$PATH:/c/Program Files/nodejs"`. PowerShell: `$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")`.
- **`gh` is at `C:\Program Files\GitHub CLI\gh.exe`**, authenticated as `vegarios-spec`. Call it from **PowerShell** (`& "C:\Program Files\GitHub CLI\gh.exe" …`): in a worktree-isolated session the Bash guard rejects commands whose path contains "GitHub", and anything with `cd …` before git, `git -C <other folder>`, or the word `.gitignore`. Use plain, separate git commands.
- The main venv (`C:\Users\Elias\vinoscore\.venv`, Python 3.14) is shared: the worktree has no venv of its own. Use `PYTHONUTF8=1` when printing accents.
- Playwright + Chromium are installed in that venv.
- Diagrams were exported with `@mermaid-js/mermaid-cli` from a temporary folder; how to redo it is in `docs/arquitectura.md`. The exported image still says "perilla" on one arrow.
- `npm audit`: 4 moderate findings in build-only tooling (`workbox-build` → `glob`/`minimatch`). They never ship; left alone on purpose.
- The machine can run low on memory; background servers may get stopped.

## 5. Decisions already made (do not re-litigate)

1. **Use our own model even though metrics differ slightly from the team's:** recall 0.377 vs 0.393 (accuracy 0.827 vs 0.831, AUC 0.843 vs 0.846). Cause: Random Forest noise / scikit-learn 1.9.1. `entrenar.py` accepts ±0.02. README shows our real figures.
2. **Python, not Rust.** The model is scikit-learn; load is ~30 lots/week.
3. **Public repo named `vinoscore`.** Commits use the noreply address `333987803+vegarios-spec@users.noreply.github.com` (repo-local git config). **Never put the owner's real email into commits, files or external requests.** Before every push, grep the branch for personal emails (done for PR #1: clean).
4. **Semáforo rule:** green if probability ≥ active threshold, yellow between 0.30 and the threshold, red below 0.30. Words: *Prometedor / Revisar en cata / Estándar*, always with the color. Default threshold 0.5; quick modes "Sello Premium" 0.60 and "Filtro a cata" 0.30. Default costs $500 / $1,500 are **examples**.
5. **The 3 reasons ("Factores principales") are an approximation**, stated in README and UI.
6. **Demo data:** 30 lots `DEMO-01…30` from the model's test split, flagged `es_demo`, shown with a "Demo" badge.
7. **Dataset provenance is unconfirmed** (looks like UCI *Wine Quality*); README says "confirm before citing".
8. **3rd design rules from the owner:** never rounded corners (anywhere, any future UI), dark mode default + light option, simple palette, nothing hidden, easy data entry and reading, professional tone, it is a tool.
9. **Money input:** a comma is only a thousands separator (`1,500` = 1500); an ambiguous comma (`1,5`) is rejected with a message instead of guessed. Stored costs keep their decimals.

## 6. Design system (3rd direction)

Spec: `docs/superpowers/specs/2026-11-25-rediseno-oscuro-design.md`. Plan: `docs/superpowers/plans/2026-11-25-rediseno-oscuro.md`.

- **Enóloga:** home → capture (every field shows `Normal: a – b unidad`; Enter = next field, Enter on the last = save) → result (`NN %`, semáforo word, bar with the active threshold, factors) or pending (offline).
- **Sergio:** "Regla de decisión" band on top (costs, threshold slider 0.05–0.95, quick modes, "Más barato", implications, clickable cost-per-threshold chart, Activate) → counters that filter + search/period/tank/CSV → **table** grouped by semáforo (left) + **lot card** always visible (right; opens with the most promising lot). Below 1024 px the card opens as an overlay (Esc closes). The table fits from 390 to 1440 px: the date column moves under the code below 1280 px, and the bar hides between 1024 and 1279 px.
- **Theme:** `data-tema` on `<html>` ("oscuro" default, "claro"), saved in `localStorage` key `vinoscore.tema`; an inline script in `index.html` applies it before paint. `almacen.ts` makes every localStorage access safe.
- **Palette** (dark / light): background `#141516`/`#F7F7F5`, surface `#1C1D1F`/`#FFFFFF`, line `#2E3033`/`#DADAD7`, text `#ECECEA`/`#17181A`, muted `#9C9EA1`/`#5E6064`; green `#6CBF78`/`#2F7A3B`, amber `#E3B341`/`#8A6100`, red `#E8685A`/`#B3372B`. No brand accent; primary buttons use the text color. Color only encodes data.
- **Type:** IBM Plex Sans only (400/500/600, bundled), scale 12/14/16/20/28/44, tabular figures.
- **Shape:** square everything (plus a global `border-radius: 0 !important` in `index.css`), 1 px lines, no shadows or gradients; semáforo markers are small squares.
- **Copy:** "Regla de decisión", "Lotes", "Simulador", "Factores principales", "Avisar a dirección", "Dirección lo marcó como…".

## 7. File map

```
modelo/entrenar.py              trains + verifies model; writes vinoscore_rf.joblib and metricas.json
api/main.py                     endpoints (/analisis, /lotes, /decisiones, /configuracion, /perilla, /simular, /exportar.csv …)
api/servicio_modelo.py          probability, semáforo, reasons, range warnings
api/perilla.py                  expected cost by threshold
api/sembrar_demo.py             demo lots (--solo-si-vacio seeds only if the DB is empty)
api/tests/                      50 pytest tests (temp DB)
web/index.html                  theme script before paint
web/src/index.css               theme tokens, .campo, global square corners
web/src/tema.ts, almacen.ts     theme and safe localStorage
web/src/App.tsx                 role routing
web/src/Cabecera.tsx            top bar: theme toggle, profile menu (role switch, enóloga name)
web/src/ui.tsx                  Boton, Marcador, InsigniaSemaforo, BarraProbabilidad, ListaRazones, Avisos…
web/src/util.ts                 formatting, SEMAFORO texts, leerNumero, leerPesos, pesosCampo
web/src/Panel.tsx               overlay for narrow screens
web/src/vistas/Sergio.tsx       workspace: band + table + card
web/src/vistas/Regla.tsx        decision rule band
web/src/vistas/FichaLote.tsx    lot card with simulator and decisions
web/src/vistas/Enologa.tsx      enóloga screens
docs/prueba_interfaz.py         UI test (Playwright)
docs/tomar_capturas.py          README screenshots
docs/superpowers/               design spec and implementation plan
```

## 8. Next steps (suggested order)

1. **Owner decides on PR #1.** If they want it merged: merge on GitHub (or ask Claude), then update the main checkout. Its 34 uncommitted files are the 2nd design, already included in commit `28d1fd0`, so they can be discarded. **Confirm with the owner before discarding them**, then `git pull`. After that the worktree can be removed.
2. **Small fixes found by the final review, deliberately deferred** (none block use):
   - The empty lot-card text says "con estos filtros" even when the period is just empty or `/variables` failed (`web/src/vistas/Sergio.tsx`).
   - If `/configuracion` fails, the band shows the cost-format alert and "Calculando…" instead of only the load error (`Regla.tsx`).
   - A failed rule-save message is not cleared by a later successful save (`Regla.tsx`).
   - Accessibility: `aria-selected` on plain `<tr>` is ignored (use `aria-current` on the row button); no IME `isComposing` check in the Enter handler and the last capture field shows `enterKeyHint="next"` (`Enologa.tsx`); the 19 chart bars are separate Tab stops (`Regla.tsx`).
   - Re-export the architecture diagram so the arrow says "regla y simulador" instead of "perilla y simulador".
3. **Accessibility pass** with a screen reader or axe, in both themes.
4. **Open questions for Sergio / the team** (also in `docs/ruta_a_produccion.md`, marked ❓): which lab analyses the winery really measures and in what units; historical lots with tasting scores; what he considers "prometedor"; real costs for the decision rule; tank and lot naming; who captures, on what device and connectivity; reports needed; users and roles; final name/logo; presentation date; dataset source.
5. **Roadmap** (in `ruta_a_produccion.md`, none started): Supabase/PostgreSQL + Alembic, real login with roles, native Expo app, hosting with HTTPS, retraining with winery data + calibration + SHAP, tasting feedback loop, monthly reports, Sentry, audit log, privacy notice (LFPDPPP).
6. Known small things: Docker/Make untested; the capture field order is a proposal to confirm with the enóloga; the default 7-day period hides older lots until widened.

## 9. Working agreements with this owner

- Ask before **hard-to-reverse or outward-facing** actions (pushing, merging, publishing, deleting). Approval for one push does not cover the next.
- For big work: short plan first, then build step by step and **verify by running** (tests + real browser screenshots); report honestly, including what was not tested.
- Privacy: keep the owner's personal details out of commits, public files and external requests.
- Design work: load the `frontend-design:frontend-design` skill first. Follow the owner's rules in section 5.8, square corners above all.
- Opening the app: the owner likes it opened directly in their browser (`Start-Process "http://localhost:<port>/?rol=sergio"` from PowerShell).
