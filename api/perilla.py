"""La "perilla del dinero": costo esperado de cada umbral.

Se calcula con la tabla de umbrales de metricas.json (matriz de confusión en
el conjunto de prueba):

    costo = FP x (costo de un falso Premium) + FN x (costo de un vino bueno perdido)

Se reporta por cada 100 lotes para que sea fácil de leer.
"""
from __future__ import annotations


def calcular_perilla(
    umbrales: list[dict],
    costo_falso_premium: float,
    costo_bueno_perdido: float,
) -> dict:
    if costo_falso_premium < 0 or costo_bueno_perdido < 0:
        raise ValueError("Los costos no pueden ser negativos.")
    if not umbrales:
        raise ValueError("La tabla de umbrales está vacía.")

    filas = []
    for u in umbrales:
        total = u["VP"] + u["FP"] + u["FN"] + u["VN"]
        costo_total = u["FP"] * costo_falso_premium + u["FN"] * costo_bueno_perdido
        marcados = u["VP"] + u["FP"]
        precision = (u["VP"] / marcados) if marcados else None
        recall = u["VP"] / (u["VP"] + u["FN"]) if (u["VP"] + u["FN"]) else None
        filas.append({
            "umbral": u["umbral"],
            "VP": u["VP"], "FP": u["FP"], "FN": u["FN"], "VN": u["VN"],
            "costo_por_100_lotes": costo_total / total * 100,
            "falsos_premium_por_100": u["FP"] / total * 100,
            "buenos_perdidos_por_100": u["FN"] / total * 100,
            "marcados_premium_por_100": marcados / total * 100,
            "precision": precision,
            "recall": recall,
            # "de cada 100 vinos marcados Premium, X sí lo son"
            "de_cada_100_premium": None if precision is None else round(precision * 100),
        })

    # El más barato; si hay empate, el umbral más alto (más cauteloso).
    recomendado = min(filas, key=lambda f: (round(f["costo_por_100_lotes"], 9), -f["umbral"]))
    return {
        "costo_falso_premium": costo_falso_premium,
        "costo_bueno_perdido": costo_bueno_perdido,
        "umbral_recomendado": recomendado["umbral"],
        "recomendado": recomendado,
        "filas": filas,
        "frase": frase(recomendado),
    }


def frase(fila: dict) -> str:
    if fila["de_cada_100_premium"] is None:
        return ("Con esta regla no se marcaría ningún vino como Premium: "
                "ningún lote alcanza ese nivel de probabilidad.")
    return (f"Con esta regla, de cada 100 vinos marcados Premium, "
            f"{fila['de_cada_100_premium']} sí lo son.")
