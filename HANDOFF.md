# VinoScore: handoff for the next session

Last updated 2026-11-26. Read this first, then `README.md`. It lets a fresh Claude Code session (or a person) continue without re-deriving anything.

- **Project folder:** `C:\Users\Elias\vinoscore` (branch `main`; it is the only branch and the only checkout)
- **GitHub:** https://github.com/vegarios-spec/vinoscore (public). On 2026-11-26, with the owner's approval, PR #1 (3rd design + review fixes) and PR #2 (`iniciar` rebuilds the web when it changed) were merged into `main`, and their branches (`worktree-rediseno-oscuro`, `ajuste-iniciar`) and the redesign worktree were deleted.
- **Language:** the owner writes in Spanish or English; answer in the language of their message. All user-facing app text, README and docs stay in **Mexican Spanish**, plain words, no jargon.

---

## 1. What VinoScore is

A prototype for a Tec de Monterrey project. The partner is **Sergio García**, an accountant who runs a winery. A Random Forest estimates whether a white-wine batch (*caldo*) is **"prometedor"** (sensory quality ≥ 7) from 11 lab measurements.

Two users, one shared database:
- **La enóloga** captures lab analyses on a phone (PWA, offline queue) and instantly sees a result.
- **Sergio** decides on desktop which batches get premium treatment and tunes the **decision rule** (cost-based threshold; called "perilla del dinero" in earlier versions).

Team credits (already in README): Elias Vega Rios (data model), Francisco Romero de la Parra (architecture and management), Diego García Serrano (UX/UI and communication).

## 2. Current state

| Where | What it has |
|---|---|
| GitHub `main` | The **3rd design**, including the fixes from the final review (PR #1) and the `iniciar` rebuild fix (PR #2). History: `98d1fde` 1st design → `28d1fd0` 2nd design → `6ecdd46` … 3rd design and fixes → `de014f2` PR #2. |
| Local `C:\Users\Elias\vinoscore` | Branch `main`, same as GitHub (the old uncommitted 2nd-design files were discarded with the owner's OK; they live in commit `28d1fd0`). Its `vinoscore.db` is the owner's demo DB; **never run the UI test against it**. Its `web/dist` has the 3rd design (built 2026-11-26). |

**History of the design:** 1st plain → 2nd "classy" (navy, serif, serrated seal, rotary knob), which the owner rejected on 2026-11-25 as "looks made by an AI" → **3rd "tool" design** (dark by default, monochrome, square corners, everything visible). The owner approved the 3rd design spec, saw it running, asked to push it, and on 2026-11-26 asked to fix the pending issues and make it the version on GitHub (merged).

**Servers:** none are running. Start servers only when the owner agrees (the machine can run low on memory), and stop them when done. Use `http://127.0.0.1:<port>` from scripts (on this machine `localhost` from PowerShell may not reach uvicorn).

**Also made:** an editable architecture whiteboard (Claude artifact, private until the owner shares it): https://claude.ai/artifact/MYiLjvCHMbxYKbG3Ck6kDE. It shows the prototype and the production target, with square boxes and steps 1–4.

## 3. How to run and test

```powershell
cd C:\Users\Elias\vinoscore
.\iniciar.ps1                            # installs, builds web, seeds demo, starts on :8000
.\.venv\Scripts\python.exe -m pytest api/tests -q   # 50 tests
cd web; npx tsc --noEmit; npm run build
```

- Sergio view: `/?rol=sergio`; enóloga: `/?rol=enologa`; API docs: `/docs`.
- `iniciar.ps1` / `iniciar.sh` rebuild the web on their own when any file in `web/src`, `web/public`, `web/index.html`, `web/package*.json` or `web/vite.config.ts` is newer than `web/dist/index.html`, and run `npm install` when `web/package-lock.json` is newer than `web/node_modules/.package-lock.json` (added 2026-11-26 after a pull left an old build and a missing font package).
- The API serves `web/dist` **only if it existed when the server started**. After the first build, restart the server once; after that, a rebuild is enough unless API code changed.
- Reset demo data: stop the server, delete that folder's `vinoscore.db`, run `python -m api.sembrar_demo`, start again.
- **UI test** (`docs/prueba_interfaz.py`, Playwright). It **writes test lots, decisions and rule changes**, so run it against a **separate test DB** (`prueba.db`; `*.db` is git-ignored), never the owner's `vinoscore.db` or the winery's. Ask the owner before starting the server. In PowerShell, from `C:\Users\Elias\vinoscore`:

  ```powershell
  $env:PYTHONUTF8 = "1"
  $env:DATABASE_URL = "sqlite:///C:/Users/Elias/vinoscore/prueba.db"
  .\.venv\Scripts\python.exe -m api.sembrar_demo --solo-si-vacio     # 30 demo lots (only if empty)
  .\.venv\Scripts\python.exe -m uvicorn api.main:app --port 8001      # in its own (background) shell, same two env vars
  .\.venv\Scripts\python.exe docs\prueba_interfaz.py http://127.0.0.1:8001   # [--solo tema|sergio|enologa]
  ```

  Then stop the server, `Remove-Item Env:DATABASE_URL`, and delete `prueba.db` if no longer needed (a fresh copy avoids leftover test lots). Seeding into `prueba.db` was verified on 2026-11-26 (the owner's `vinoscore.db` stayed untouched). Last full run (2026-11-26, from the former worktree): all sections "Todo bien".
- **Screenshots:** with the same test server, `python docs/tomar_capturas.py http://127.0.0.1:8001` writes the 6 README screenshots (`enologa-1..3`, `sergio-1-tablero` dark, `sergio-2-ficha` with the simulator, `sergio-3-claro`). It creates lot `DEMO-CAPTURA`, so start from a fresh `prueba.db` if test lots are present.
- **Docker, `Makefile` and `docker-compose.yml` were never tested** (no Docker or `make` on this machine). Say so if asked.

## 4. Machine and tooling gotchas (Windows 11)

- **Node is not on PATH in Claude's shell.** Git Bash: `export PATH="$PATH:/c/Program Files/nodejs"`. PowerShell: `$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")`.
- **`gh` is at `C:\Program Files\GitHub CLI\gh.exe`**, authenticated as `vegarios-spec`. Call it from **PowerShell** (`& "C:\Program Files\GitHub CLI\gh.exe" …`). If a future session works in a worktree, its Bash guard rejects commands whose path contains "GitHub", `cd …` before git, `git -C <other folder>`, or the word `.gitignore`; use plain, separate git commands.
- **Auto mode may block outward actions** even after the owner approved them (it blocked `git push` once and `gh pr merge`). Then the owner runs them with `!` in the prompt. That `!` runs **Bash**, not PowerShell: `! "/c/Program Files/GitHub CLI/gh.exe" pr merge <n> --repo vegarios-spec/vinoscore --merge` (no `&`).
- In PowerShell 5.1, pass commit messages with `git commit -F <file>`: inline messages with double quotes get split into pathspecs.
- The venv is `C:\Users\Elias\vinoscore\.venv` (Python 3.14). Use `PYTHONUTF8=1` when printing accents.
- Playwright + Chromium are installed in that venv.
- Diagrams are exported with `@mermaid-js/mermaid-cli` (via `npx`, from a temporary folder) using Playwright's Chromium through `-p pp.json` with `{"executablePath": "%LOCALAPPDATA%\\ms-playwright\\chromium-*\\chrome-win64\\chrome.exe"}` and `PUPPETEER_SKIP_DOWNLOAD=1`; details in `docs/arquitectura.md`. Downloading the npm package needs the owner's OK (auto mode blocked it once).
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

1. ~~PR #1 and PR #2~~ merged 2026-11-26; branches and worktree deleted.
2. ~~Small fixes from the final review~~ **done 2026-11-26** (commit `cff12bf` and following): per-cause empty lot-card text; `/configuracion` failure shows only its own alert; save error cleared on success; `aria-current` on the selected row's button (`data-elegido` on the `<tr>` for tests); IME-safe Enter and `enterKeyHint="done"` on the last field; the cost chart is one Tab stop (`radiogroup`, arrows/Home/End, square focus box); `dt` before `dd` in the rule figures; unused `oscuro` prop removed; diagram re-exported ("regla y simulador"). The UI test covers the new behavior; last full run "Todo bien".
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
