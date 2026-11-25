import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Cabecera } from "../Cabecera";
import type { Rol } from "../Cabecera";
import { Panel } from "../Panel";
import type { Configuracion, LoteResumen, Semaforo, Variable } from "../tipos";
import { BarraProbabilidad, Cargando, ErrorCaja, InsigniaDemo, Marcador, Vacio } from "../ui";
import { ORDEN_SEMAFORO, SEMAFORO, fechaRelativa, haceDias, pct } from "../util";
import { FichaLote } from "./FichaLote";
import { Regla } from "./Regla";

/** true en pantallas de 1024 px o más, donde la ficha vive en su propia columna. */
function useAncha() {
  const consulta = "(min-width: 1024px)";
  const [ancha, setAncha] = useState(() => window.matchMedia(consulta).matches);
  useEffect(() => {
    const m = window.matchMedia(consulta);
    const cambio = () => setAncha(m.matches);
    m.addEventListener("change", cambio);
    return () => m.removeEventListener("change", cambio);
  }, []);
  return ancha;
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
  const [elegido, setElegido] = useState<number | null>(null);
  const [panelAbierto, setPanelAbierto] = useState(false);
  const ancha = useAncha();

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
      .catch(() => vigente && setError("No se pudo cargar la lista de lotes. Revisa que el servidor esté encendido."));
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

  // La búsqueda por código es local; los conteos salen de lo que se está viendo.
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
  const enTabla = grupos.flatMap((g) => g.filas);

  // En pantalla ancha siempre hay un lote en la ficha: el elegido o, si no está a la vista, el más prometedor.
  const actual = enTabla.find((l) => l.id === elegido) ?? (ancha ? enTabla[0] ?? null : null);
  const sinDecision = visibles.filter((l) => l.semaforo && !l.decision_actual).length;
  const hayDemo = (lotes ?? []).some((l) => l.es_demo);
  const hayFiltros = tanque !== "" || busqueda !== "" || filtro !== null;

  const elegir = (l: LoteResumen) => {
    setElegido(l.id);
    if (!ancha) setPanelAbierto(true);
  };
  const quitarFiltros = () => {
    setTanque("");
    setBusqueda("");
    setFiltro(null);
  };

  const ficha =
    actual && variables ? (
      <FichaLote key={actual.id} resumen={actual} variables={variables} umbral={umbral} onDecidido={() => setVersion((v) => v + 1)} />
    ) : null;

  return (
    <>
      <Cabecera rol={rol} onRol={onRol} nombre={nombre} onNombre={onNombre} />

      <main>
        <Regla
          onConfigCambia={(c) => {
            setCfg(c);
            setVersion((v) => v + 1);
          }}
        />

        <div className="mx-auto max-w-[1600px] px-4 pb-16 pt-5 lg:px-6">
          {/* Resumen que también filtra, y herramientas de la lista */}
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
              <h2 className="text-lg font-medium">Lotes</h2>
              <div role="group" aria-label="Filtrar por semáforo" className="flex flex-wrap border border-linea">
                {ORDEN_SEMAFORO.map((s) => (
                  <button
                    key={s}
                    onClick={() => setFiltro((f) => (f === s ? null : s))}
                    aria-pressed={filtro === s}
                    className="flex min-h-10 items-center gap-2 border-r border-linea px-3 text-sm hover:bg-realce aria-pressed:bg-texto aria-pressed:text-fondo"
                  >
                    <Marcador tipo={s} />
                    <span className="font-medium tabular">{conteo[s]}</span>
                    {SEMAFORO[s].etiqueta}
                  </button>
                ))}
                <button
                  onClick={() => setFiltro(null)}
                  aria-pressed={filtro === null}
                  className="flex min-h-10 items-center gap-2 px-3 text-sm hover:bg-realce aria-pressed:bg-texto aria-pressed:text-fondo"
                >
                  <span className="font-medium tabular">{visibles.length}</span> Todos
                </button>
              </div>
              {lotes && lotes.length > 0 && (
                <p className="pb-2 text-sm text-suave">
                  <span className="font-medium text-texto tabular">{sinDecision}</span> {sinDecision === 1 ? "lote espera" : "lotes esperan"} decisión
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar lote"
                aria-label="Buscar lote por código"
                className="campo !min-h-10 !w-44 text-sm"
              />
              <select value={periodo} onChange={(e) => setPeriodo(e.target.value as typeof periodo)} aria-label="Periodo" className="campo !min-h-10 !w-auto text-sm">
                <option value="7">Últimos 7 días</option>
                <option value="30">Últimos 30 días</option>
                <option value="todo">Todo el tiempo</option>
              </select>
              <select value={tanque} onChange={(e) => setTanque(e.target.value)} aria-label="Tanque" className="campo !min-h-10 !w-auto text-sm">
                <option value="">Todos los tanques</option>
                {tanques.map((t) => (
                  <option key={t} value={t}>Tanque {t}</option>
                ))}
              </select>
              <a href={api.urlCsv} download className="inline-flex min-h-10 items-center border border-linea-fuerte px-4 text-sm font-medium hover:bg-realce">
                Descargar CSV
              </a>
            </div>
          </div>

          {hayDemo && (
            <p className="mt-4 border-l-2 border-ambar pl-3 text-sm text-suave">
              Los lotes marcados <InsigniaDemo /> son datos de demostración: vinos del conjunto de prueba del modelo, no lotes de la bodega.
            </p>
          )}

          <div className="mt-5 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px]">
            {/* Tabla */}
            <div className="min-w-0 space-y-3">
              {error && <ErrorCaja>{error}</ErrorCaja>}
              {!lotes && !error && <Cargando />}
              {lotes && enTabla.length === 0 && (
                <Vacio titulo={hayFiltros ? "Ningún lote cumple con estos filtros" : "Todavía no hay lotes en este periodo"}>
                  {hayFiltros ? (
                    <button onClick={quitarFiltros} className="mt-2 min-h-10 border border-linea-fuerte px-4 text-sm font-medium text-texto hover:bg-realce">
                      Quitar filtros
                    </button>
                  ) : (
                    "Aparecerán aquí en cuanto la enóloga capture el primero. Para ver más, amplía el periodo."
                  )}
                </Vacio>
              )}
              {enTabla.length > 0 && (
                <div className="overflow-x-auto border border-linea">
                  <table aria-label="Lotes" className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-b border-linea text-left text-xs text-suave">
                        <th scope="col" className="px-4 py-2.5 font-normal">Lote</th>
                        <th scope="col" className="hidden px-3 py-2.5 font-normal md:table-cell">Tanque</th>
                        <th scope="col" className="hidden px-3 py-2.5 font-normal md:table-cell">Fecha</th>
                        <th scope="col" className="px-3 py-2.5 text-right font-normal">Probabilidad</th>
                        <th scope="col" className="px-4 py-2.5 font-normal">Decisión</th>
                      </tr>
                    </thead>
                    {grupos.map(({ s, filas }) => (
                      <tbody key={s}>
                        <tr className="border-b border-linea bg-superficie">
                          <th scope="colgroup" colSpan={5} className="px-4 py-2 text-left font-normal">
                            <span className="inline-flex items-center gap-2">
                              <Marcador tipo={s} />
                              <span className="font-medium">{SEMAFORO[s].etiqueta}</span>
                              <span className="text-suave tabular">{filas.length} {filas.length === 1 ? "lote" : "lotes"}</span>
                            </span>
                          </th>
                        </tr>
                        {filas.map((l) => {
                          const sel = actual?.id === l.id;
                          return (
                            <tr
                              key={l.id}
                              data-codigo={l.codigo}
                              data-semaforo={l.semaforo ?? ""}
                              aria-selected={sel}
                              onClick={() => elegir(l)}
                              className={`cursor-pointer border-b border-linea last:border-b-0 hover:bg-realce ${sel ? "bg-realce shadow-[inset_2px_0_0_var(--texto)]" : ""}`}
                            >
                              <td className="max-w-[16rem] px-4 py-2.5">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    elegir(l);
                                  }}
                                  className="flex max-w-full items-center gap-2 text-left font-medium"
                                >
                                  <span className="truncate">{l.codigo}</span>
                                  {l.es_demo && <InsigniaDemo />}
                                </button>
                                <span className="block truncate text-xs text-suave md:hidden">
                                  {[l.tanque && `Tanque ${l.tanque}`, fechaRelativa(l.fecha)].filter(Boolean).join(", ")}
                                </span>
                              </td>
                              <td className="hidden max-w-[8rem] truncate px-3 py-2.5 text-suave md:table-cell">{l.tanque || "–"}</td>
                              <td className="hidden whitespace-nowrap px-3 py-2.5 text-suave md:table-cell">{fechaRelativa(l.fecha)}</td>
                              <td className="px-3 py-2.5">
                                <span className="flex items-center justify-end gap-3">
                                  {l.probabilidad !== null && l.semaforo && (
                                    <span className="hidden w-28 sm:block">
                                      <BarraProbabilidad p={l.probabilidad} semaforo={l.semaforo} umbral={umbral} />
                                    </span>
                                  )}
                                  <span className="w-12 text-right font-medium tabular">{l.probabilidad !== null ? pct(l.probabilidad) : "–"}</span>
                                </span>
                              </td>
                              <td className={`whitespace-nowrap px-4 py-2.5 ${l.decision_actual ? "" : "text-suave"}`}>{l.decision_actual ?? "Sin decidir"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    ))}
                  </table>
                </div>
              )}
              {enTabla.length > 0 && (
                <p className="text-xs text-suave">
                  Ordenados de más a menos probable. La línea en cada barra marca el umbral de la regla activa ({pct(umbral)}).
                </p>
              )}
            </div>

            {/* Ficha, siempre a la vista en pantalla ancha */}
            {ancha && (
              <aside className="sticky top-[4.5rem] max-h-[calc(100dvh-5.5rem)] overflow-y-auto border border-linea p-5">
                {ficha ?? (
                  <section aria-label="Ficha del lote">
                    <p className="text-sm font-medium">{lotes ? "No hay lotes con estos filtros." : "Cargando…"}</p>
                    {lotes && <p className="mt-1 text-sm text-suave">Cambia la búsqueda, el periodo o el tanque para ver un lote aquí.</p>}
                  </section>
                )}
              </aside>
            )}
          </div>
        </div>
      </main>

      {!ancha && panelAbierto && ficha && (
        <Panel etiqueta={`Ficha del lote ${actual?.codigo ?? ""}`} onCerrar={() => setPanelAbierto(false)}>
          {ficha}
        </Panel>
      )}
    </>
  );
}
