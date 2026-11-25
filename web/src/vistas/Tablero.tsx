import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import type { LoteResumen, Resumen } from "../tipos";
import { Cargando, ErrorCaja, InsigniaDemo, InsigniaSemaforo, Tarjeta, Vacio } from "../ui";
import { fechaHora, pct } from "../util";

function Cifra({ titulo, valor, detalle, clase = "" }: { titulo: string; valor: number | string; detalle?: string; clase?: string }) {
  return (
    <Tarjeta className={`!p-4 ${clase}`}>
      <p className="text-sm font-semibold text-suave">{titulo}</p>
      <p className="mt-1 text-4xl font-extrabold tabular">{valor}</p>
      {detalle && <p className="mt-1 text-sm text-suave">{detalle}</p>}
    </Tarjeta>
  );
}

function BarraProbabilidad({ p }: { p: number | null }) {
  if (p === null) return <span className="text-suave">—</span>;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2.5 w-24 overflow-hidden rounded-full bg-borde" aria-hidden>
        <div className="h-full rounded-full bg-marino" style={{ width: `${Math.round(p * 100)}%` }} />
      </div>
      <span className="w-12 text-right font-semibold tabular">{pct(p)}</span>
    </div>
  );
}

export function Tablero({
  version, onAbrir, umbral,
}: {
  version: number;
  onAbrir: (id: number) => void;
  umbral: number | null;
}) {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [lotes, setLotes] = useState<LoteResumen[] | null>(null);
  const [todosTanques, setTodosTanques] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [tanque, setTanque] = useState("");
  const [semaforo, setSemaforo] = useState("");

  useEffect(() => {
    let vigente = true;
    setError(null);
    Promise.all([api.resumen(), api.lotes({ desde, hasta, tanque, semaforo })])
      .then(([r, l]) => {
        if (!vigente) return;
        setResumen(r);
        setLotes(l);
      })
      .catch(() => vigente && setError("No se pudo cargar el tablero. ¿Está encendido el servidor?"));
    return () => {
      vigente = false;
    };
  }, [desde, hasta, tanque, semaforo, version]);

  // Lista de tanques disponible para el filtro (sin filtros aplicados).
  useEffect(() => {
    api
      .lotes()
      .then((l) => setTodosTanques([...new Set(l.map((x) => x.tanque).filter(Boolean))].sort()))
      .catch(() => undefined);
  }, [version]);

  const hayDemo = useMemo(() => lotes?.some((l) => l.es_demo) ?? false, [lotes]);
  const hayFiltros = desde || hasta || tanque || semaforo;

  return (
    <div className="space-y-5">
      {hayDemo && (
        <div className="rounded-xl border border-ambar bg-amber-50 p-3 text-sm text-amber-900">
          <strong>Datos de demostración.</strong> Los lotes marcados DEMO son vinos del conjunto de pruebas del modelo, no son lotes de
          la bodega.
        </div>
      )}

      {resumen && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Cifra titulo="Lotes de la semana" valor={resumen.lotes_semana} detalle="Últimos 7 días" />
            <Cifra titulo="Verde: Prometedor" valor={resumen.verdes} clase="border-l-8 !border-l-verde" />
            <Cifra titulo="Amarillo: Revisar en cata" valor={resumen.amarillos} clase="border-l-8 !border-l-amarillo" />
            <Cifra titulo="Rojo: Estándar" valor={resumen.rojos} clase="border-l-8 !border-l-rojo" />
            <Cifra titulo="Sin decisión" valor={resumen.sin_decision} detalle="Esperan tu respuesta" />
          </div>
          <p className="text-sm text-suave">
            Regla activa: <strong className="text-tinta">Prometedor</strong> si la probabilidad es {pct(umbral ?? resumen.umbral_activo)} o más;{" "}
            <strong className="text-tinta">Revisar en cata</strong> entre 30 % y {pct(umbral ?? resumen.umbral_activo)}. Puedes cambiarla en
            “Perilla del dinero”.
          </p>
        </>
      )}

      <Tarjeta className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-bold text-marino">Lotes, del más al menos prometedor</h2>
          <a
            href={api.urlCsv}
            download
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-marino px-4 font-semibold text-marino hover:bg-fondo"
          >
            ⬇ Exportar a CSV
          </a>
        </div>

        <div className="flex flex-wrap gap-3">
          <Filtro etiqueta="Desde">
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="min-h-11 rounded-lg border-2 border-borde px-2" />
          </Filtro>
          <Filtro etiqueta="Hasta">
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="min-h-11 rounded-lg border-2 border-borde px-2" />
          </Filtro>
          <Filtro etiqueta="Tanque">
            <select value={tanque} onChange={(e) => setTanque(e.target.value)} className="min-h-11 rounded-lg border-2 border-borde bg-white px-2">
              <option value="">Todos</option>
              {todosTanques.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Filtro>
          <Filtro etiqueta="Semáforo">
            <select value={semaforo} onChange={(e) => setSemaforo(e.target.value)} className="min-h-11 rounded-lg border-2 border-borde bg-white px-2">
              <option value="">Todos</option>
              <option value="verde">Prometedor (verde)</option>
              <option value="amarillo">Revisar en cata (amarillo)</option>
              <option value="rojo">Estándar (rojo)</option>
            </select>
          </Filtro>
          {hayFiltros && (
            <button
              className="min-h-11 self-end rounded-lg px-3 font-semibold text-turquesa underline"
              onClick={() => {
                setDesde("");
                setHasta("");
                setTanque("");
                setSemaforo("");
              }}
            >
              Quitar filtros
            </button>
          )}
        </div>

        {error && <ErrorCaja>{error}</ErrorCaja>}
        {!lotes && !error && <Cargando />}
        {lotes && lotes.length === 0 && (
          <Vacio>
            {hayFiltros
              ? "Ningún lote cumple con esos filtros."
              : "Todavía no hay lotes. La enóloga los captura desde su vista, o puedes cargar los de demostración con: python -m api.sembrar_demo"}
          </Vacio>
        )}
        {lotes && lotes.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b-2 border-borde text-sm text-suave">
                  <th className="py-2 pr-3 font-semibold">Lote</th>
                  <th className="py-2 pr-3 font-semibold">Tanque</th>
                  <th className="py-2 pr-3 font-semibold">Fecha</th>
                  <th className="py-2 pr-3 font-semibold">Probabilidad</th>
                  <th className="py-2 pr-3 font-semibold">Semáforo</th>
                  <th className="py-2 font-semibold">Decisión</th>
                </tr>
              </thead>
              <tbody>
                {lotes.map((l) => (
                  <tr key={l.id} className="cursor-pointer border-b border-borde hover:bg-fondo" onClick={() => onAbrir(l.id)}>
                    <td className="py-2.5 pr-3">
                      <button
                        className="flex items-center gap-2 font-bold text-marino underline-offset-2 hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAbrir(l.id);
                        }}
                      >
                        {l.codigo} {l.es_demo && <InsigniaDemo />}
                      </button>
                    </td>
                    <td className="py-2.5 pr-3">{l.tanque || "—"}</td>
                    <td className="py-2.5 pr-3 text-sm tabular">{fechaHora(l.fecha)}</td>
                    <td className="py-2.5 pr-3">
                      <BarraProbabilidad p={l.probabilidad} />
                    </td>
                    <td className="py-2.5 pr-3">
                      <InsigniaSemaforo semaforo={l.semaforo} />
                    </td>
                    <td className="py-2.5">{l.decision_actual ?? <span className="text-suave">Sin decidir</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
    </div>
  );
}

function Filtro({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold">
      {etiqueta}
      {children}
    </label>
  );
}
