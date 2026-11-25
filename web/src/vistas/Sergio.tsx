import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Cabecera } from "../Cabecera";
import type { Rol } from "../Cabecera";
import { Sello, SelloMini } from "../Sello";
import type { Configuracion, LoteResumen, Semaforo, Variable } from "../tipos";
import { Cargando, ErrorCaja, InsigniaDemo, Vacio } from "../ui";
import { ORDEN_SEMAFORO, SEMAFORO, fechaRelativa, haceDias, pct } from "../util";
import { FichaLote } from "./FichaLote";
import { PerillaPanel } from "./PerillaPanel";

type Panel = { tipo: "lote"; lote: LoteResumen } | { tipo: "regla" } | null;

const CHIP_DECISION: Record<string, string> = {
  Premium: "bg-turquesa/10 text-turquesa-oscuro ring-1 ring-turquesa/40",
  "Mandar a cata": "bg-ambar-claro text-amber-900 ring-1 ring-laton/50",
  "Estándar": "bg-hielo text-marino ring-1 ring-borde",
};

function IconoPerilla() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="#d9b06a" strokeWidth="1.5" />
      <path d="M12 12 L15.6 6.6" stroke="#d9b06a" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function Medidor({ p, semaforo, umbral }: { p: number; semaforo: Semaforo; umbral: number }) {
  return (
    <div className="relative h-1.5 rounded-full bg-hielo" aria-hidden>
      <div className={`h-full rounded-full ${SEMAFORO[semaforo].relleno}`} style={{ width: `${Math.round(p * 100)}%` }} />
      <span className="absolute inset-y-[-4px] w-px bg-noche/70" style={{ left: `${umbral * 100}%` }} />
    </div>
  );
}

export function VistaSergio({
  variables, rol, onRol, nombre, onNombre,
}: {
  variables: Variable[] | null;
  rol: Rol;
  onRol: (r: Rol) => void;
  nombre: string;
  onNombre: (n: string) => void;
}) {
  const [cfg, setCfg] = useState<Configuracion | null>(null);
  const [lotes, setLotes] = useState<LoteResumen[] | null>(null);
  const [tanques, setTanques] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [panel, setPanel] = useState<Panel>(null);

  const [periodo, setPeriodo] = useState<"todo" | "7" | "30">("7");
  const [tanque, setTanque] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Semaforo | null>(null);

  const umbral = cfg?.umbral_activo ?? 0.5;

  useEffect(() => {
    api.configuracion().then(setCfg).catch(() => undefined);
  }, [version]);

  useEffect(() => {
    let vigente = true;
    setError(null);
    api
      .lotes({ desde: periodo === "todo" ? undefined : haceDias(Number(periodo) - 1), tanque })
      .then((l) => vigente && setLotes(l))
      .catch(() => vigente && setError("No se pudo cargar el libro de lotes. ¿Está encendido el servidor?"));
    return () => {
      vigente = false;
    };
  }, [periodo, tanque, version]);

  useEffect(() => {
    api
      .lotes()
      .then((l) => setTanques([...new Set(l.map((x) => x.tanque).filter(Boolean))].sort()))
      .catch(() => undefined);
  }, [version]);

  // La búsqueda por código es local; los conteos de colores salen de lo que se está viendo.
  const visibles = useMemo(
    () => (lotes ?? []).filter((l) => l.codigo.toLowerCase().includes(busqueda.trim().toLowerCase())),
    [lotes, busqueda],
  );
  const conteo = useMemo(() => {
    const c: Record<Semaforo, number> = { verde: 0, amarillo: 0, rojo: 0 };
    for (const l of visibles) if (l.semaforo) c[l.semaforo]++;
    return c;
  }, [visibles]);

  const grupos = ORDEN_SEMAFORO.filter((s) => !filtro || filtro === s)
    .map((s) => ({ s, filas: visibles.filter((l) => l.semaforo === s) }))
    .filter((g) => g.filas.length > 0);

  const mejor = (lotes ?? []).find((l) => l.probabilidad !== null) ?? null; // la API ya los ordena por probabilidad
  const hayDemo = (lotes ?? []).some((l) => l.es_demo);
  const hayFiltros = tanque !== "" || busqueda !== "" || filtro !== null;

  // El título y los contadores salen de la misma lista (periodo y tanque elegidos), para que siempre coincidan.
  const lista = lotes ?? [];
  const nLotes = lista.length;
  const nVerdes = lista.filter((l) => l.semaforo === "verde").length;
  const nSinDecision = lista.filter((l) => l.semaforo && !l.decision_actual).length;
  const cuando = periodo === "7" ? "Esta semana llegaron" : periodo === "30" ? "En los últimos 30 días llegaron" : "Hasta ahora han llegado";
  const titular =
    lotes === null
      ? " "
      : nLotes === 0
        ? periodo === "7" ? "Esta semana todavía no llegan lotes." : "No hay lotes en este periodo."
        : `${cuando} ${nLotes} ${nLotes === 1 ? "lote" : "lotes"}.`;
  const segunda =
    nLotes > 0
      ? nVerdes > 0
        ? `${nVerdes} ${nVerdes === 1 ? "está listo" : "están listos"} para el sello Premium.`
        : "Ninguno llega todavía al sello Premium."
      : "";

  return (
    <>
      <Cabecera
        rol={rol}
        onRol={onRol}
        nombre={nombre}
        onNombre={onNombre}
        extra={
          <button
            onClick={() => setPanel({ tipo: "regla" })}
            className="flex min-h-11 items-center gap-2 rounded-lg border border-laton/70 px-3.5 text-[0.95rem] font-medium text-white hover:bg-white/10"
          >
            <IconoPerilla />
            <span>
              <span className="hidden md:inline">Regla: </span>Prometedor desde {pct(umbral)}
            </span>
          </button>
        }
      />

      <main>
        {/* Resumen de la semana: los contadores también filtran la lista */}
        <section className="bg-noche text-white">
          <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-12 px-4 pb-10 pt-10 md:pb-12 md:pt-14">
           <div className="min-w-0">
            <h1 className="max-w-3xl font-display text-[2.3rem] font-normal leading-[1.06] md:text-[3.7rem]">
              {titular}
              {segunda && <> {segunda}</>}
            </h1>
            {nLotes > 0 && (
              <p className="mt-5 text-lg text-white/75">
                {nSinDecision === 0
                  ? "Todos tienen decisión."
                  : `${nSinDecision} ${nSinDecision === 1 ? "espera" : "esperan"} tu decisión.`}
              </p>
            )}

            <div role="group" aria-label="Filtrar por semáforo" className="mt-8 flex flex-wrap gap-3">
              {ORDEN_SEMAFORO.map((s) => (
                <button
                  key={s}
                  onClick={() => setFiltro((f) => (f === s ? null : s))}
                  aria-pressed={filtro === s}
                  className={`flex min-h-[4.25rem] items-center gap-3 rounded-lg border py-2 pl-3 pr-5 text-left transition ${
                    filtro === s ? "border-white bg-white text-noche" : "border-white/20 text-white hover:border-white/50"
                  }`}
                >
                  <SelloMini tipo={s} tam={40} />
                  <span>
                    <span className="block font-display text-[2rem] font-normal leading-none tabular">{conteo[s]}</span>
                    <span className="block text-sm">{SEMAFORO[s].etiqueta}</span>
                  </span>
                </button>
              ))}
              <button
                onClick={() => setFiltro(null)}
                aria-pressed={filtro === null}
                className={`flex min-h-[4.25rem] items-center gap-3 rounded-lg border px-5 text-left transition ${
                  filtro === null ? "border-white bg-white text-noche" : "border-white/20 text-white hover:border-white/50"
                }`}
              >
                <span>
                  <span className="block font-display text-[2rem] font-normal leading-none tabular">{visibles.length}</span>
                  <span className="block text-sm">Todos</span>
                </span>
              </button>
            </div>
           </div>

            {mejor && mejor.semaforo && mejor.probabilidad !== null && (
              <button
                onClick={() => setPanel({ tipo: "lote", lote: mejor })}
                className="hidden shrink-0 flex-col items-center gap-2 rounded-xl p-3 text-white hover:bg-white/10 lg:flex"
              >
                <Sello tipo={mejor.semaforo} probabilidad={mejor.probabilidad} tam={232} estampar={false} />
                <span className="mt-1 text-sm text-white/80">Lote más prometedor: <strong className="font-semibold text-white">{mejor.codigo}</strong></span>
              </button>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-[1240px] px-4 pb-16 pt-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-[2.2rem] font-medium leading-none text-marino">Libro de lotes</h2>
              <p className="text-suave">De más a menos prometedor. Toca un lote para ver su ficha y decidir.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar lote"
                aria-label="Buscar lote por código"
                className="campo !min-h-11 !w-40 !text-base"
              />
              <select value={periodo} onChange={(e) => setPeriodo(e.target.value as typeof periodo)} aria-label="Periodo" className="campo !min-h-11 !w-auto !text-base">
                <option value="7">Últimos 7 días</option>
                <option value="30">Últimos 30 días</option>
                <option value="todo">Todo el tiempo</option>
              </select>
              <select value={tanque} onChange={(e) => setTanque(e.target.value)} aria-label="Tanque" className="campo !min-h-11 !w-auto !text-base">
                <option value="">Todos los tanques</option>
                {tanques.map((t) => (
                  <option key={t} value={t}>Tanque {t}</option>
                ))}
              </select>
              <a
                href={api.urlCsv}
                download
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-marino px-4 font-semibold text-marino hover:bg-hielo"
              >
                Descargar CSV
              </a>
            </div>
          </div>

          {hayDemo && (
            <p className="mt-4 rounded-lg border border-l-4 border-laton/40 border-l-laton bg-ambar-claro px-4 py-3 text-sm text-amber-900">
              Los lotes con la marca <InsigniaDemo /> son datos de demostración: vinos del conjunto de pruebas del modelo, no lotes de la bodega.
            </p>
          )}

          <div className="mt-5 space-y-5">
            {error && <ErrorCaja>{error}</ErrorCaja>}
            {!lotes && !error && <Cargando />}
            {lotes && visibles.length === 0 && (
              <Vacio titulo={hayFiltros ? "Ningún lote cumple con esos filtros" : "Todavía no hay lotes"}>
                {hayFiltros ? (
                  <button
                    onClick={() => {
                      setTanque("");
                      setBusqueda("");
                      setFiltro(null);
                    }}
                    className="mt-1 min-h-11 rounded-lg bg-marino px-5 font-semibold text-white"
                  >
                    Quitar los filtros
                  </button>
                ) : (
                  "En cuanto la enóloga capture el primero aparecerá aquí. Para ver cómo se ve con datos de ejemplo, corre python -m api.sembrar_demo."
                )}
              </Vacio>
            )}

            {grupos.length > 0 && (
              <div className="overflow-hidden rounded-xl bg-white ring-1 ring-borde">
                {grupos.map(({ s, filas }) => (
                  <div key={s}>
                    <h3 className="flex flex-wrap items-baseline gap-x-4 border-y border-borde bg-papel/70 px-5 py-3 first:border-t-0">
                      <span aria-hidden className={`inline-block h-5 w-[3px] translate-y-1 rounded-full ${SEMAFORO[s].relleno}`} />
                      <span className={`font-display text-[1.65rem] font-medium leading-none ${SEMAFORO[s].texto}`}>{SEMAFORO[s].etiqueta}</span>
                      <span className="text-sm font-medium text-suave">{filas.length} {filas.length === 1 ? "lote" : "lotes"}</span>
                      <span className="text-sm text-suave">{SEMAFORO[s].verbo}</span>
                    </h3>
                    <ul className="divide-y divide-borde">
                      {filas.map((l) => (
                        <li key={l.id}>
                          <button
                            onClick={() => setPanel({ tipo: "lote", lote: l })}
                            className="grid w-full min-h-[4.5rem] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 px-5 py-3 text-left hover:bg-papel md:grid-cols-[auto_minmax(0,1.2fr)_minmax(180px,1fr)_9.5rem_auto]"
                          >
                            <SelloMini tipo={s} tam={38} />
                            <span className="min-w-0">
                              <span className="flex items-center gap-2 text-[1.05rem] font-semibold text-marino">
                                <span className="truncate">{l.codigo}</span>
                                {l.es_demo && <InsigniaDemo />}
                              </span>
                              <span className="block text-sm text-suave">
                                {l.tanque ? `Tanque ${l.tanque}, ` : ""}
                                {fechaRelativa(l.fecha)}
                              </span>
                            </span>
                            <span className="hidden items-center gap-3 md:flex">
                              <span className="w-full">{l.probabilidad !== null && <Medidor p={l.probabilidad} semaforo={s} umbral={umbral} />}</span>
                              <span className="w-[4.5rem] shrink-0 whitespace-nowrap text-right font-display text-[1.7rem] font-normal leading-none tabular">
                                {l.probabilidad !== null && pct(l.probabilidad)}
                              </span>
                            </span>
                            <span className="hidden md:block">
                              {l.decision_actual ? (
                                <span className={`inline-block rounded-md px-3 py-1 text-sm font-semibold ${CHIP_DECISION[l.decision_actual]}`}>{l.decision_actual}</span>
                              ) : (
                                <span className="inline-block rounded-md border border-dashed border-suave px-3 py-0.5 text-sm font-semibold text-suave">Sin decidir</span>
                              )}
                            </span>
                            <span className="text-right md:hidden">
                              {l.probabilidad !== null && <span className="block font-display text-[1.7rem] font-normal leading-none tabular">{pct(l.probabilidad)}</span>}
                            </span>
                            <span aria-hidden className="hidden text-xl text-borde md:block">›</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
            {grupos.length > 0 && (
              <p className="text-sm text-suave">
                La rayita oscura de cada medidor marca el umbral de la regla activa ({pct(umbral)}). Los lotes sin análisis no aparecen aquí.
              </p>
            )}
          </div>
        </section>
      </main>

      {panel?.tipo === "lote" && variables && (
        <FichaLote
          key={panel.lote.id}
          resumen={panel.lote}
          variables={variables}
          umbral={umbral}
          onCerrar={() => setPanel(null)}
          onDecidido={() => setVersion((v) => v + 1)}
        />
      )}
      {panel?.tipo === "regla" && (
        <PerillaPanel
          onCerrar={() => setPanel(null)}
          onConfigCambia={(c) => {
            setCfg(c);
            setVersion((v) => v + 1);
          }}
        />
      )}
    </>
  );
}
