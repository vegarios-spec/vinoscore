import { useEffect, useState } from "react";
import { api } from "../api";
import type { Decision, LoteFicha, Variable } from "../tipos";
import { Avisos, Boton, Cargando, ErrorCaja, InsigniaDemo, ListaRazones, SemaforoGrande, Tarjeta, TextoProbabilidad } from "../ui";
import { fechaHora, num } from "../util";

const DECISIONES: { valor: Decision; texto: string; variante: "secundario" | "primario" | "borde" }[] = [
  { valor: "Premium", texto: "Aprobar como Premium", variante: "secundario" },
  { valor: "Mandar a cata", texto: "Mandar a cata", variante: "primario" },
  { valor: "Estándar", texto: "Estándar", variante: "borde" },
];

export function Ficha({
  loteId, variables, onVolver, onCambio, onSimular,
}: {
  loteId: number;
  variables: Variable[];
  onVolver: () => void;
  onCambio: () => void;
  onSimular: (id: number) => void;
}) {
  const [ficha, setFicha] = useState<LoteFicha | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comentario, setComentario] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    setFicha(null);
    api
      .lote(loteId)
      .then((f) => vigente && setFicha(f))
      .catch(() => vigente && setError("No se pudo cargar el lote."));
    return () => {
      vigente = false;
    };
  }, [loteId]);

  const decidir = async (d: Decision) => {
    setGuardando(true);
    setAviso(null);
    try {
      await api.decidir(loteId, d, "Sergio", comentario.trim());
      setComentario("");
      setFicha(await api.lote(loteId));
      setAviso(`Listo: el lote quedó como “${d}”.`);
      onCambio();
    } catch {
      setError("No se pudo guardar la decisión. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-5">
      <button onClick={onVolver} className="min-h-11 font-semibold text-turquesa underline">
        ← Volver al tablero
      </button>
      {error && <ErrorCaja>{error}</ErrorCaja>}
      {!ficha && !error && <Cargando />}
      {ficha && (
        <>
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="text-3xl font-extrabold text-marino">Lote {ficha.codigo}</h2>
            {ficha.es_demo && <InsigniaDemo />}
            <p className="text-suave">
              {ficha.tanque && `Tanque ${ficha.tanque} · `}
              {fechaHora(ficha.fecha)} · capturó {ficha.capturado_por || "—"}
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-5">
              {ficha.probabilidad !== null && ficha.semaforo && (
                <Tarjeta className="space-y-3">
                  <SemaforoGrande semaforo={ficha.semaforo} probabilidad={ficha.probabilidad} />
                  <TextoProbabilidad p={ficha.probabilidad} />
                  <Boton variante="borde" onClick={() => onSimular(ficha.id)}>
                    Probar “¿qué pasa si…?”
                  </Boton>
                </Tarjeta>
              )}
              <Avisos avisos={ficha.advertencias} />
              <Tarjeta>
                <ListaRazones razones={ficha.razones} nota={ficha.nota} />
              </Tarjeta>
            </div>

            <div className="space-y-5">
              <Tarjeta>
                <h3 className="text-base font-bold text-marino">Análisis del lote</h3>
                <table className="mt-2 w-full text-left">
                  <tbody>
                    {variables.map((v) => {
                      const valor = ficha.valores[v.clave];
                      if (valor === undefined) return null;
                      const fuera = valor < v.rango_normal[0] || valor > v.rango_normal[1];
                      return (
                        <tr key={v.clave} className="border-b border-borde last:border-0">
                          <th scope="row" className="py-2 pr-2 font-medium">
                            {v.nombre}
                          </th>
                          <td className="py-2 pr-2 text-right font-semibold tabular">
                            {num(valor, v.decimales)} <span className="font-normal text-suave">{v.unidad}</span>
                          </td>
                          <td className="py-2 text-right text-sm">
                            {fuera ? (
                              <span className="font-semibold text-amarillo-texto">⚠ Fuera de lo normal</span>
                            ) : (
                              <span className="text-suave">Normal</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Tarjeta>

              <Tarjeta className="space-y-3">
                <h3 className="text-base font-bold text-marino">Tu decisión</h3>
                <p className="text-sm text-suave">
                  Decisión actual: <strong className="text-tinta">{ficha.decision_actual ?? "todavía sin decidir"}</strong>
                </p>
                <label className="block text-sm font-semibold">
                  Comentario (opcional)
                  <textarea
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    rows={2}
                    maxLength={1000}
                    placeholder="Ej. Probar con la enóloga el viernes"
                    className="mt-1 w-full rounded-xl border-2 border-borde p-2 text-base font-normal"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  {DECISIONES.map((d) => (
                    <Boton key={d.valor} variante={d.variante} disabled={guardando} onClick={() => decidir(d.valor)}>
                      {d.texto}
                    </Boton>
                  ))}
                </div>
                {aviso && (
                  <p role="status" className="font-semibold text-verde-texto">
                    ✓ {aviso}
                  </p>
                )}
                {ficha.decisiones.length > 0 && (
                  <div className="border-t border-borde pt-3">
                    <h4 className="text-sm font-bold text-suave">Historial de decisiones</h4>
                    <ul className="mt-1 space-y-2">
                      {ficha.decisiones.map((d) => (
                        <li key={d.id} className="text-sm">
                          <strong>{d.decision}</strong> · {d.quien || "—"} · {fechaHora(d.fecha)}
                          {d.comentario && <span className="block text-suave">“{d.comentario}”</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Tarjeta>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
