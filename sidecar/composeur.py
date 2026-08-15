# Composeur BarjoTur v3 — orienteering OR-Tools (C06).
# Reprise propre du prototype (00_CartoLooney/norvege-2027/backend/sidecar/app.py) :
# mêmes modèles, mêmes invariants, code restructuré avec couches claires.
#
# Couches :
#   db.py      → accès DB2 (aides, paramètres, candidats, persister)
#   reward.py  → calcul du reward par base
#   solver.py  → résolution OR-Tools (OP) + distribution des nuits
#   agenda.py  → micro-OP journée (plan_jour, build_agenda)
#   geom.py    → expansion géométrique (APSP, A*, fallback)
#
# Endpoints :
#   GET  /health      → état du service + OR-Tools
#   POST /compose     → orienteering sur une liste de bases candidates
#
# Règle de production : OR-Tools SEUL ; pas de fallback glouton.
# DATABASE_URL fourni par l'environnement (secrets.env, jamais en dur).

import os
import json
import heapq
import logging
from collections import defaultdict
from typing import Any

import psycopg
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

try:
    from ortools.constraint_solver import pywrapcp, routing_enums_pb2
    ORTOOLS = True
except Exception:
    ORTOOLS = False

log = logging.getLogger("composeur")
app = FastAPI(title="barjotur-composeur", version="0.1")
DSN = os.environ["DATABASE_URL"]

# Défauts de repli — les valeurs vivantes viennent du registre budget.parametre (DB2).
_DEF: dict[str, Any] = {
    "DEPOT": 19,
    "NIGHTS": 21,
    "SENS_PRIX": 0.3,
    "COUT_REF": 30.0,
    "THEME_W": 0.3,
    "DISJ_SCALE": 800.0,
    "CAP_HARD": 6.0,
}

# Thèmes par archétype (correspondance prototype, M155).
_THEME_FAV: dict[str, list[str]] = {
    "slow_nature": ["paysage", "rando"],
    "cadence_34": ["paysage", "rando", "culturel"],
    "fjords": ["paysage", "nautique"],
    "max_incontournables": ["paysage", "culturel"],
    "equilibre": ["paysage", "rando", "nautique", "culturel"],
    "cap_nord": ["paysage"],
    "max_autonomie": ["paysage", "rando"],
    "consensus": ["paysage", "rando"],
}

# Bases imposées par archétype (cap_nord doit atteindre le nord, base 60 = nord).
_FORCE: dict[str, int] = {"cap_nord": 60}


# ---------------------------------------------------------------------------
# DB — chargement des aides depuis DB2
# ---------------------------------------------------------------------------

def charger_params() -> dict[str, Any]:
    """Lit les constantes composeur depuis budget.parametre (DB2). Défauts _DEF en repli."""
    p: dict[str, Any] = dict(_DEF)
    mapping: dict[str, tuple[str, type]] = {
        "composeur_depot_base": ("DEPOT", int),
        "nuits_sur_site": ("NIGHTS", int),
        "nuits_boucle": ("NIGHTS", int),
        "sensibilite_prix": ("SENS_PRIX", float),
        "cout_ref_eur": ("COUT_REF", float),
        "poids_theme": ("THEME_W", float),
        "reward_disjunction_scale": ("DISJ_SCALE", float),
        "cap_conduite_hard_h": ("CAP_HARD", float),
    }
    try:
        with psycopg.connect(DSN) as c, c.cursor() as cur:
            cur.execute(
                "SELECT cle, valeur FROM budget.parametre WHERE cle = ANY(%s) AND statut='actif'",
                (list(mapping),),
            )
            for cle, val in cur.fetchall():
                nom, cast = mapping[cle]
                try:
                    p[nom] = cast(val)
                except Exception:
                    pass
    except Exception as e:
        log.warning("charger_params: %s (repli sur défauts)", e)
    return p


def charger_aides() -> tuple[
    dict[int, dict[str, float]],
    list[tuple[int, int, float]],
    list[dict[str, Any]],
    dict[int, float],
    dict[tuple[int, int], list[int]],
    dict[int, int],
]:
    """Charge depuis DB2 :
    - bf : reward_inputs par base (facteurs, thèmes, hors_foule, cout_moy, lat_norm)
    - legs : triplets (src, tgt, temps_reel_s) de base_base_cost_temps
    - archs : signatures d'archétypes (archetype_signature)
    - vote : poids vote par base (api.base_vote_weight)
    - bbp : chemins APSP précalculés (base_base_path)
    - sup : nuits_max_faisable par base (base_activite_supply)
    """
    with psycopg.connect(DSN) as c, c.cursor() as cur:
        cur.execute(
            "SELECT base_id,f1,f2,f3,f4,f5,f6,hors_foule,reward_top8,lat_norm,cout_moy,"
            "th_paysage,th_rando,th_nautique,th_culturel FROM mcda2.base_reward_inputs"
        )

        def f(x: Any) -> float:
            return float(x) if x is not None else 0.0

        bf: dict[int, dict[str, float]] = {
            r[0]: {
                "f1": f(r[1]), "f2": f(r[2]), "f3": f(r[3]), "f4": f(r[4]),
                "f5": f(r[5]), "f6": f(r[6]), "hf": f(r[7]), "rtop": f(r[8]),
                "latn": f(r[9]), "cout": f(r[10]),
                "th_paysage": f(r[11]), "th_rando": f(r[12]),
                "th_nautique": f(r[13]), "th_culturel": f(r[14]),
            }
            for r in cur.fetchall()
        }
        cur.execute(
            "SELECT src_base,tgt_base,temps_reel_s FROM mcda2.base_base_cost_temps WHERE temps_reel_s IS NOT NULL"
        )
        legs: list[tuple[int, int, float]] = [(r[0], r[1], float(r[2])) for r in cur.fetchall()]

        cur.execute(
            "SELECT code,w_nature,w_grandeur,w_tranquillite,w_rando,w_bivouac,w_incontournable,"
            "biais_nord,cap_conduite_hard_h,cadence_nuits_moy,anti_foule_force,autonomie_pref "
            "FROM mcda2.archetype_signature"
        )
        archs: list[dict[str, Any]] = [
            {
                "code": r[0], "w_nat": float(r[1]), "w_gra": float(r[2]), "w_tra": float(r[3]),
                "w_ran": float(r[4]), "w_biv": float(r[5]), "w_inc": float(r[6]),
                "biais_nord": float(r[7]), "cap_hard_h": float(r[8]), "cadence": float(r[9]),
                "anti_foule": float(r[10]), "autonomie": float(r[11]),
            }
            for r in cur.fetchall()
        ]
        cur.execute("SELECT base_id, vote_weight FROM api.base_vote_weight")
        vote: dict[int, float] = {r[0]: float(r[1]) for r in cur.fetchall()}

        cur.execute("SELECT src_base, tgt_base, path FROM mcda2.base_base_path")
        bbp: dict[tuple[int, int], list[int]] = {(r[0], r[1]): list(r[2]) for r in cur.fetchall()}

        cur.execute("SELECT base_id, nuits_max_faisable FROM mcda2.base_activite_supply")
        sup: dict[int, int] = {r[0]: int(r[1]) for r in cur.fetchall()}

    return bf, legs, archs, vote, bbp, sup


# ---------------------------------------------------------------------------
# Géométrie — APSP interne (repli) et A* live (production)
# ---------------------------------------------------------------------------

def apsp(legs: list[tuple[int, int, float]]) -> tuple[
    dict[tuple[int, int], float], dict[tuple[int, int], list[int]]
]:
    """Dijkstra multi-source sur le graphe des legs (temps réel, s).
    Sert de repli si base_base_path ne couvre pas une paire."""
    adj: dict[int, list[tuple[int, float]]] = defaultdict(list)
    for s, t, c in legs:
        adj[s].append((t, c))
        adj[t].append((s, c))
    cost: dict[tuple[int, int], float] = {}
    path: dict[tuple[int, int], list[int]] = {}
    for src in list(adj):
        dist: dict[int, float] = {src: 0.0}
        prev: dict[int, int] = {}
        pq: list[tuple[float, int]] = [(0.0, src)]
        while pq:
            d, u = heapq.heappop(pq)
            if d > dist.get(u, 1e18):
                continue
            for v, w in adj[u]:
                nd = d + w
                if nd < dist.get(v, 1e18):
                    dist[v] = nd
                    prev[v] = u
                    heapq.heappush(pq, (nd, v))
        for dst, d in dist.items():
            cost[(src, dst)] = d
            p = [dst]
            x = dst
            while x != src and x in prev:
                x = prev[x]
                p.append(x)
            path[(src, dst)] = list(reversed(p))
    return cost, path


def developper_chemin(
    route: list[int],
    bbp: dict[tuple[int, int], list[int]],
    path_repli: dict[tuple[int, int], list[int]],
) -> list[int]:
    """Développe la route OP en séquence continue via les chemins APSP précalculés (base_base_path).
    Repli sur le Dijkstra interne si une paire est absente."""
    seq = [route[0]]
    for i in range(len(route) - 1):
        a, b = route[i], route[i + 1]
        p = bbp.get((a, b))
        if p is None:
            rp = bbp.get((b, a))
            p = list(reversed(rp)) if rp is not None else None
        if p is None:
            p = path_repli.get((a, b)) or path_repli.get((b, a), [a, b])
            if p and p[0] != a:
                p = list(reversed(p))
        seq += p[1:]
    return seq


def geom_par_sequence(seq: list[int]) -> Any:
    """Géométrie continue via api.geom_sequence (assemblage base_base_routes_v2). Utilisé en dernier recours."""
    with psycopg.connect(DSN) as c, c.cursor() as cur:
        cur.execute("SELECT api.geom_sequence(%s::int[])", (seq,))
        return cur.fetchone()[0]  # type: ignore[index]


def geom_par_astar(route: list[int]) -> Any:
    """Géométrie continue via A* live (pgr_aStar sur ways_van DB2). Production. Cache par paire."""
    with psycopg.connect(DSN) as c, c.cursor() as cur:
        cur.execute("SET statement_timeout = '120s'")
        cur.execute("SELECT api.geom_route_astar(%s::int[])", (route,))
        return cur.fetchone()[0]  # type: ignore[index]


# ---------------------------------------------------------------------------
# Reward — modèle F1-F6 + thèmes + vote + prix + biais géo
# ---------------------------------------------------------------------------

def reward_base(
    arch: dict[str, Any],
    base_id: int,
    bf: dict[int, dict[str, float]],
    vote: dict[int, float],
    rtop_max: float,
    prm: dict[str, Any],
) -> float:
    """Reward d'une base pour un archétype.
    Formule : qual(F1-F6 pondérés + incontournable) − anti-foule → ×geo_pref × theme_match − prix × vote."""
    v = bf[base_id]
    qual = (
        arch["w_nat"] * v["f1"]
        + arch["w_gra"] * v["f2"]
        + arch["w_tra"] * v["f3"]
        + arch["w_ran"] * v["f4"]
        + arch["w_biv"] * v["f5"]
        + arch["w_inc"] * (v["rtop"] / rtop_max)
    )
    qual -= arch["anti_foule"] * (1.0 - v["hf"])
    # Biais géographique : préférence nord ou contraire
    geo_pref = arch["biais_nord"] * v["latn"] + (1.0 - arch["biais_nord"]) * (1.0 - v["latn"])
    r = max(0.05, qual) * (0.4 + 1.6 * geo_pref)
    # Thèmes : poids d'envie inline (signature philosophie, M513) sinon liste favorite de l'archétype.
    themes_w = arch.get("themes")
    if themes_w:
        tot = sum(themes_w.values())
        theme_match = (sum(v.get("th_" + k, 0.0) * w for k, w in themes_w.items()) / tot) if tot > 0 else 0.0
    else:
        fav = _THEME_FAV.get(arch["code"], [])
        theme_match = (sum(v.get("th_" + k, 0.0) for k in fav) / len(fav)) if fav else 0.0
    r *= 1.0 + prm["THEME_W"] * theme_match
    # Prix (critère orthogonal)
    r -= prm["SENS_PRIX"] * (v["cout"] / prm["COUT_REF"])
    # Vote live (amplificateur ou atténuateur)
    r *= 1.0 + vote.get(base_id, 0.0)
    return max(0.05, r)


# ---------------------------------------------------------------------------
# Distribution des nuits (M174, activité-aware M190 §1)
# ---------------------------------------------------------------------------

def distribuer_nuits(
    mids: list[int], total: int, sup: dict[int, int]
) -> tuple[list[int], int]:
    """Distribue `total` nuits sur les bases `mids`, 1-3 chacune (M101/M174), en priorisant
    les bases riches en activités (M190 §1, bornées par nuits_max_faisable).
    Retourne (liste par base, déficit) ; déficit > 0 = signal INFEASIBLE (remonter méso)."""
    k = len(mids)
    if k <= 0:
        return [], total
    cap = [min(3, int(sup.get(b, 1))) for b in mids]
    per = [1] * k
    rem = total - k
    ordre = sorted(range(k), key=lambda i: -cap[i])
    while rem > 0:
        avance = False
        for i in ordre:
            if rem > 0 and per[i] < cap[i]:
                per[i] += 1
                rem -= 1
                avance = True
        if not avance:
            break
    # Repli : lever le cap ≤3 si sum(caps) < total
    if rem > 0:
        i = 0
        while sum(per) < total and any(x < 3 for x in per):
            if per[i % k] < 3:
                per[i % k] += 1
            i += 1
    return per, max(0, total - sum(per))


# ---------------------------------------------------------------------------
# Solver — OR-Tools orienteering
# ---------------------------------------------------------------------------

def resoudre_archetype(
    arch: dict[str, Any],
    bf: dict[int, dict[str, float]],
    cost: dict[tuple[int, int], float],
    vote: dict[int, float],
    prm: dict[str, Any],
    base_imposee: int | None = None,
    sup: dict[int, int] | None = None,
) -> dict[str, Any] | None:
    """Orienteering Problem mono-véhicule, dépôt fixe, budget nuits borné.
    Retourne la route + métriques, ou None si OR-Tools n'a pas de solution."""
    depot_base: int = int(prm["DEPOT"])
    nights_total: int = int(prm["NIGHTS"])
    bases = sorted(bf)
    idx: dict[int, int] = {b: i for i, b in enumerate(bases)}
    n = len(bases)
    depot = idx[depot_base]
    rtop_max = max(v["rtop"] for v in bf.values()) or 1.0
    cap_hard = int(arch["cap_hard_h"] * 60)  # en minutes
    nights_per = max(1, round(arch["cadence"]))
    val: dict[int, float] = {b: reward_base(arch, b, bf, vote, rtop_max, prm) for b in bases}

    def cout_min(i: int, j: int) -> int:
        x, y = bases[i], bases[j]
        c = int(cost.get((x, y), cost.get((y, x), 24 * 3600)) / 60)
        return c if c <= cap_hard else c * 50  # pénalité cap leg dur

    mgr = pywrapcp.RoutingIndexManager(n, 1, depot)
    rt = pywrapcp.RoutingModel(mgr)

    cb_transit = rt.RegisterTransitCallback(
        lambda fi, ti: cout_min(mgr.IndexToNode(fi), mgr.IndexToNode(ti))
    )
    rt.SetArcCostEvaluatorOfAllVehicles(cb_transit)

    def cb_nuits(fi: int) -> int:
        return 0 if mgr.IndexToNode(fi) == depot else min(nights_per, 3)

    cb_n = rt.RegisterUnaryTransitCallback(cb_nuits)
    rt.AddDimensionWithVehicleCapacity(cb_n, 0, [nights_total], True, "nuits")

    for node in range(n):
        if node == depot:
            continue
        if base_imposee is not None and bases[node] == base_imposee:
            continue  # waypoint imposé : obligatoire
        rt.AddDisjunction(
            [mgr.NodeToIndex(node)],
            int(val[bases[node]] * prm["DISJ_SCALE"]),
        )

    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    params.time_limit.FromSeconds(6)
    sol = rt.SolveWithParameters(params)
    if not sol:
        return None

    route: list[int] = []
    index = rt.Start(0)
    total_min = 0
    while not rt.IsEnd(index):
        node = mgr.IndexToNode(index)
        route.append(bases[node])
        nxt = sol.Value(rt.NextVar(index))
        total_min += cout_min(node, mgr.IndexToNode(nxt))
        index = nxt
    route.append(depot_base)

    legs = [
        cout_min(idx[route[i]], idx[route[i + 1]])
        for i in range(len(route) - 1)
    ]
    mids = route[1:-1]
    per, deficit = distribuer_nuits(mids, nights_total, sup or {})
    nights_map = {b: per[i] for i, b in enumerate(mids)}

    return {
        "route": route,
        "n_bases": len(mids),
        "nuits": sum(per),
        "nights_par_base": nights_map,
        "nuits_deficit": deficit,
        "value": round(sum(val[b] for b in mids), 1),
        "drive_h": round(total_min / 60.0, 1),
        "leg_max_h": round(max(legs) / 60.0, 1) if legs else 0.0,
        "nights_per": nights_per,
        "cap_hard_h": arch["cap_hard_h"],
    }


# ---------------------------------------------------------------------------
# Micro-OP journée (M187/A070) — plan_jour + build_agenda
# ---------------------------------------------------------------------------

def _tmin(s: Any, default: int) -> int:
    """'HH:MM' → minutes ; nombre → minutes ; sinon default."""
    if s is None:
        return default
    s = str(s)
    if ":" in s:
        h, m = s.split(":")[:2]
        return int(h) * 60 + int(m)
    try:
        return int(float(s))
    except Exception:
        return default


def charger_params_agenda() -> dict[str, int]:
    keys = [
        "lever_prep_min", "pdej_duree_min", "diner_debut_ideal",
        "picnic_debut_ideal", "picnic_conso_min", "resto_midi_min",
        "diner_duree_min", "tisane_chocolat_min",
    ]
    p: dict[str, str] = {}
    try:
        with psycopg.connect(DSN) as c, c.cursor() as cur:
            cur.execute(
                "SELECT cle, valeur FROM budget.parametre WHERE cle = ANY(%s) AND statut='actif'",
                (keys,),
            )
            p = {k: v for k, v in cur.fetchall()}
    except Exception as e:
        log.warning("charger_params_agenda: %s", e)
    return {
        "lever_prep": _tmin(p.get("lever_prep_min"), 20),
        "pdej": _tmin(p.get("pdej_duree_min"), 60),
        "diner_ideal": _tmin(p.get("diner_debut_ideal"), 19 * 60 + 30),
        "picnic_ideal": _tmin(p.get("picnic_debut_ideal"), 12 * 60),
        "picnic_conso": _tmin(p.get("picnic_conso_min"), 60),
        "resto": _tmin(p.get("resto_midi_min"), 120),
        "diner_duree": _tmin(p.get("diner_duree_min"), 60),
        "tisane": _tmin(p.get("tisane_chocolat_min"), 20),
    }


def charger_candidats(bases: list[int]) -> dict[int, list[dict[str, Any]]]:
    """Activités atteignables par base (mcda2.base_activite_candidate), top-40 par valeur."""
    by: dict[int, list[dict[str, Any]]] = {}
    with psycopg.connect(DSN) as c, c.cursor() as cur:
        cur.execute(
            "SELECT base_id,osm_id,nom,type_entite,f8_type,tier_defaut,temps_activite_min,"
            "acces_marche_min,valeur,COALESCE(cout_estime_eur,0),COALESCE(meteo_dependant,false),"
            "COALESCE(tc_mode,'') FROM mcda2.base_activite_candidate WHERE base_id = ANY(%s) "
            "ORDER BY base_id, valeur DESC NULLS LAST, temps_activite_min ASC",
            (bases,),
        )
        for r in cur.fetchall():
            by.setdefault(r[0], [])
            if len(by[r[0]]) < 40:
                by[r[0]].append({
                    "osm_id": r[1], "nom": r[2] or "", "ent": r[3], "f8": r[4], "tier": r[5],
                    "temps": int(r[6] or 0), "acces": int(r[7] or 0), "val": float(r[8] or 0),
                    "cout": float(r[9] or 0), "meteo": bool(r[10]), "tc": r[11] or "",
                })
    return by


def charger_noms_bases(bases: list[int]) -> dict[int, str]:
    if not bases:
        return {}
    with psycopg.connect(DSN) as c, c.cursor() as cur:
        cur.execute(
            "SELECT base_id, regexp_replace(nom,' - .*| Camping.*| aire.*| Bobil.*| bobil.*','','i') "
            "FROM mcda2.bases_v2 WHERE base_id = ANY(%s)",
            (bases,),
        )
        return {r[0]: (r[1] or f"base {r[0]}") for r in cur.fetchall()}


def _hhmm(m: int) -> str:
    return f"{int(m) // 60:02d}:{int(m) % 60:02d}"


_TIER_RANG: dict[str | None, int] = {"T": 4, "S": 3, "A": 2, "B": 1, "": 0, None: 0}


def _tsab_agg(tiers: list[str | None]) -> dict[str, Any] | None:
    """Anti-double-compte (M058) : meilleur tier + éventail (pas une somme)."""
    from collections import Counter
    ts = [t for t in tiers if t]
    if not ts:
        return None
    best = max(ts, key=lambda x: _TIER_RANG.get(x, 0))
    c = Counter(ts)
    return {"dominant": best, "detail": {k: c[k] for k in ("T", "S", "A", "B") if c.get(k)}}


def plan_jour(
    base_id: int,
    jour: int,
    date: str,
    nuit_type: str,
    cand: list[dict[str, Any]],
    ap: dict[str, int],
    exclude: set[Any] | None = None,
    base_nom: str | None = None,
) -> dict[str, Any]:
    """Journée CHRONOLOGIQUE : 1 seul repas midi (XOR picnic/resto), circuit nommé, TSAB jour."""
    exclude = exclude or set()
    lever = 7 * 60 + ap["lever_prep"]
    fin_activites = 18 * 60
    lunch_cible = 12 * 60
    cand = [c for c in cand if c["osm_id"] not in exclude]

    principal = next(
        (c for c in cand if c["ent"] == "rando" and 180 <= c["temps"] <= 8 * 60), None
    )
    picnic = principal is not None
    selection = [principal] if principal else []
    budget_restant = fin_activites - (lever + ap["pdej"]) - (ap["picnic_conso"] if picnic else ap["resto"])
    used: set[Any] = {c["osm_id"] for c in selection}
    depense = sum(c["acces"] + c["temps"] for c in selection)
    for c in cand:
        if c["osm_id"] in used or c["ent"] == "rando":
            continue
        if depense + c["acces"] + c["temps"] > budget_restant:
            continue
        selection.append(c)
        used.add(c["osm_id"])
        depense += c["acces"] + c["temps"]
        if len([s for s in selection if s["ent"] != "rando"]) >= 3:
            break

    segs: list[dict[str, Any]] = []
    ordre = [0]
    t = [lever]
    activites: list[Any] = []
    tiers: list[str | None] = []
    lunched = [False]

    def emit(mode: str, typ: str, ref: Any, duree: int, note: str = "", cout: float | None = None) -> None:
        ordre[0] += 1
        s: dict[str, Any] = {
            "ordre": ordre[0], "mode": mode, "type": typ, "ref": ref,
            "heure_debut": _hhmm(t[0]), "duree_min": int(duree), "note": note,
        }
        if cout is not None:
            s["cout_eur"] = cout
        segs.append(s)
        t[0] += int(duree)

    def dejeuner() -> None:
        if lunched[0]:
            return
        if picnic:
            emit("repas", "picnic", None, ap["picnic_conso"], "pique-nique sur le tracé", 0.0)
        else:
            emit("repas", "resto", None, ap["resto"], "déjeuner au restaurant", None)
        lunched[0] = True

    emit("repas", "petit_dej", None, ap["pdej"], "petit-déjeuner")
    for c in selection:
        if not lunched[0] and t[0] >= lunch_cible:
            dejeuner()
        if c["acces"] > 0:
            emit("marche", "acces", c["osm_id"], c["acces"], "accès à pied")
        typ = "rando" if c["ent"] == "rando" else "visite_poi"
        mode = "marche" if c["ent"] == "rando" else (
            "tc" if c["tc"] in ("train", "ferry", "tram", "metro") else "visite"
        )
        if c["ent"] == "rando" and picnic and not lunched[0] and t[0] < lunch_cible < t[0] + c["temps"]:
            emit(mode, typ, c["osm_id"], lunch_cible - t[0], c["nom"][:40])
            dejeuner()
            emit(mode, typ, c["osm_id"], c["temps"] - (lunch_cible - (t[0] - ap["picnic_conso"])), c["nom"][:40])
        else:
            emit(mode, typ, c["osm_id"], c["temps"], c["nom"][:40], c["cout"] if c["cout"] > 0 else None)
        activites.append(c["osm_id"])
        tiers.append(c["tier"])

    if not lunched[0]:
        dejeuner()
    if t[0] < ap["diner_ideal"]:
        t[0] = ap["diner_ideal"]
    emit("repas", "diner", None, ap["diner_duree"], "dîner (prépa -1h)")
    emit("repas", "tisane", None, ap["tisane"], "tisane + chocolat")
    circuit_nom = (
        f"Rando {principal['nom'][:32]}" if principal
        else f"Circuit de {base_nom or ('base ' + str(base_id))}"
    )
    return {
        "jour": jour, "date": date, "base_id": base_id, "nuitee_type": nuit_type,
        "lever": _hhmm(lever), "coucher": "22:30",
        "circuit": {"nom": circuit_nom, "segments": segs, "tsab": _tsab_agg(tiers)},
        "resume_jour": {
            "activites": activites, "picnic": picnic, "n_activites": len(activites),
            "tsab_jour": _tsab_agg(tiers), "circuit_nom": circuit_nom, "climax": False,
        },
    }


def _etape_depot(depot: int, jour: int, date: str, nom: str, sens: str) -> dict[str, Any]:
    """Nuit d'arrivée (aller ferry) ou de retour au dépôt (Kristiansand). Journée légère."""
    label = f"Arrivée à {nom} (ferry)" if sens == "arrivee" else f"Retour à {nom} (ferry)"
    note = "arrivée du ferry, installation" if sens == "arrivee" else "retour au port, veille du ferry retour"
    seg = [{
        "ordre": 1,
        "mode": "ferry" if sens == "arrivee" else "route",
        "type": "transit", "ref": None,
        "heure_debut": "18:40" if sens == "arrivee" else "16:00",
        "duree_min": 0, "note": label,
    }]
    return {
        "jour": jour, "date": date, "base_id": depot, "nuitee_type": "camping",
        "lever": "08:00", "coucher": "22:30",
        "circuit": {"nom": label, "segments": seg, "tsab": None},
        "resume_jour": {
            "activites": [], "picnic": False, "n_activites": 0,
            "tsab_jour": None, "circuit_nom": label, "note": note, "climax": False,
        },
    }


def build_agenda(
    route: list[int],
    nights_map: dict[int, int],
    ap: dict[str, int],
    cand_by: dict[int, list[dict[str, Any]]],
    base_noms: dict[int, str] | None = None,
    depot: int | None = None,
    depot_nom: str = "Kristiansand",
) -> list[dict[str, Any]]:
    """Agenda complet : distribue les jours sur les bases. Encadre aller/retour au dépôt (M221/M225)."""
    base_noms = base_noms or {}
    mids = route[1:-1]
    etapes: list[dict[str, Any]] = []
    jour = 1
    if depot is not None:
        etapes.append(_etape_depot(depot, jour, f"2027-08-{3 + jour:02d}", depot_nom, "arrivee"))
        jour += 1
    vus: dict[int, set[Any]] = {}
    for b in mids:
        seen = vus.setdefault(b, set())
        nuit = 0
        for _ in range(int(nights_map.get(b, 1))):
            date = f"2027-08-{3 + jour:02d}"
            e = plan_jour(b, jour, date, "camping", cand_by.get(b, []), ap, exclude=seen, base_nom=base_noms.get(b))
            if nuit > 0:
                e["resume_jour"]["note"] = "2e/3e jour même base : rayon élargi"
            seen.update(e["resume_jour"]["activites"])
            etapes.append(e)
            jour += 1
            nuit += 1
    if depot is not None:
        etapes.append(_etape_depot(depot, jour, f"2027-08-{3 + jour:02d}", depot_nom, "retour"))
    return etapes


# ---------------------------------------------------------------------------
# Persister — écrire le fige en DB2
# ---------------------------------------------------------------------------

def composer_et_persister(
    arch: dict[str, Any],
    bf: dict[int, dict[str, float]],
    cost: dict[tuple[int, int], float],
    vote: dict[int, float],
    prm: dict[str, Any],
    bbp: dict[tuple[int, int], list[int]],
    path_repli: dict[tuple[int, int], list[int]],
    extra: dict[str, Any],
    avec_agenda: bool = True,
    sup: dict[int, int] | None = None,
) -> dict[str, Any]:
    """Résout, construit la géométrie, construit l'agenda, persiste via api.fige_enregistrer_systeme."""
    r = resoudre_archetype(arch, bf, cost, vote, prm, _FORCE.get(arch["code"]), sup)
    if r is None:
        return {"ok": False, "error": "ortools sans solution (contraintes infaisables ?)"}

    gi: dict[str, Any] = {}
    try:
        gi = geom_par_astar(r["route"])  # A* live (production)
    except Exception as e1:
        log.warning("geom_par_astar: %s — repli geom_sequence", e1)
        try:
            seq = developper_chemin(r["route"], bbp, path_repli)
            gi = geom_par_sequence(seq)
        except Exception as e2:
            log.warning("geom_par_sequence: %s", e2)

    plan: dict[str, Any] = {
        **extra,
        "label": extra.get("label") or arch["code"],
        "km": gi.get("km"),
        "nuits": r["nuits"],
        "geom": gi.get("geom"),
        "fiche": {
            "n_bases": r["n_bases"], "nuits": r["nuits"], "value": r["value"],
            "drive_h": r["drive_h"], "leg_max_h": r["leg_max_h"],
            "ordre_bases": r["route"], "km": gi.get("km"),
            "nights_par_base": r.get("nights_par_base"),
            "continue": gi.get("continue"),
            "traversees": gi.get("traversees"),
            "n_troncons": gi.get("n_troncons"),
        },
    }
    n_etapes = 0
    if avec_agenda:
        try:
            ap = charger_params_agenda()
            mids = r["route"][1:-1]
            cand_by = charger_candidats(mids)
            depot = r["route"][0]
            base_noms = charger_noms_bases(mids + [depot])
            plan["etapes"] = build_agenda(
                r["route"], r.get("nights_par_base") or {}, ap, cand_by,
                base_noms, depot=depot, depot_nom=base_noms.get(depot, "Kristiansand"),
            )
            n_etapes = len(plan["etapes"])
        except Exception as e:
            plan["agenda_error"] = str(e)[:120]

    with psycopg.connect(DSN) as c, c.cursor() as cur:
        cur.execute("SELECT api.fige_enregistrer_systeme(%s::jsonb)", (json.dumps(plan),))
        res = cur.fetchone()[0]  # type: ignore[index]
        c.commit()

    return {
        "ok": True,
        "compose": {k: r.get(k) for k in ("n_bases", "nuits", "value", "drive_h")},
        "n_etapes": n_etapes,
        "fige": res,
    }


# ---------------------------------------------------------------------------
# Requêtes FastAPI
# ---------------------------------------------------------------------------

class ComposeReq(BaseModel):
    """Corps de POST /compose : liste de bases candidates + budget temps + options."""
    bases: list[int] = Field(..., description="Identifiants de bases candidates (base_id). Doit être non vide.")
    archetype_key: str | None = Field(None, description="Code d'archétype à utiliser comme signature. Si absent : signature neutre.")
    signature: dict[str, Any] | None = Field(
        None,
        description="Signature d'objectif INLINE (M513) : {w_nat..autonomie, biais_nord, cap_hard_h, cadence, themes}. "
        "Fournie par le BFF depuis le profil philosophie du voyageur (Mon voyage, profilVersSignature). "
        "Prioritaire sur archetype_key ; fusionnée sur la neutre (champs manquants tolérés).",
    )
    avec_agenda: bool = Field(True, description="Calculer l'agenda journée (micro-OP jour). False pour un aperçu rapide.")
    avec_geom: bool = Field(True, description="Calculer la géométrie continue (A* live ou fallback).")
    persister: bool = Field(False, description="Écrire le résultat dans fige (api.fige_enregistrer_systeme).")


@app.get("/health")
def health() -> dict[str, Any]:
    """État du service et de ses aides (DB2 atteignable, OR-Tools chargé, volumétries)."""
    try:
        bf, legs, archs, vote, _bbp, _sup = charger_aides()
        ortools_ver: str | None = None
        if ORTOOLS:
            import ortools as _ot
            ortools_ver = _ot.__version__  # type: ignore[attr-defined]
        return {
            "ok": True,
            "ortools": ortools_ver,
            "bases": len(bf),
            "legs_temps": len(legs),
            "archetypes": [a["code"] for a in archs],
            "votes_non_nuls": sum(1 for v in vote.values() if v),
            "solver_prod": "ortools-only",
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.post("/compose")
def compose(req: ComposeReq) -> dict[str, Any]:
    """Orienteering Problem sur les bases candidates.

    - Si `archetype_key` est fourni, utilise la signature correspondante.
    - Si non fourni, construit une signature neutre équilibrée.
    - Si `persister=True`, écrit le résultat dans le fige (api.fige_enregistrer_systeme).
    - Si `avec_agenda=False`, retourne uniquement la sélection et la géométrie (plus rapide).

    Retour :
        ok : bool
        compose : { n_bases, nuits, value, drive_h }
        n_etapes : int (si avec_agenda)
        fige : résultat de fige_enregistrer (si persister)
        route : liste des bases dans l'ordre (si non persisté)
        geom_sequence : séquence de bases pour la géométrie (si avec_geom et non persisté)
    """
    if not req.bases:
        raise HTTPException(status_code=400, detail="La liste de bases candidates est vide.")
    if not ORTOOLS:
        raise HTTPException(status_code=503, detail="OR-Tools indisponible — impossible de composer en production.")

    bf, legs, archs, vote, bbp, sup = charger_aides()
    prm = charger_params()
    cost, path_repli = apsp(legs)

    # Signature : neutre équilibrée par défaut, surchargée par archetype_key, PUIS par la signature inline (M513).
    # Ordre de priorité : signature (profil philosophie du voyageur) > archetype_key > neutre.
    neutre = {
        "code": "compose_ad_hoc",
        "w_nat": 1.0, "w_gra": 1.0, "w_tra": 1.0, "w_ran": 1.0, "w_biv": 1.0, "w_inc": 1.0,
        "biais_nord": 0.5, "cap_hard_h": 6.0, "cadence": 2.0,
        "anti_foule": 0.5, "autonomie": 0.5,
    }
    if req.signature is not None:
        # Fusion sur la neutre : les champs manquants gardent une valeur sûre (pas de KeyError dans reward_base).
        arch = {**neutre, **req.signature, "code": "philosophie"}
    elif req.archetype_key is not None:
        arch = next((a for a in archs if a["code"] == req.archetype_key), None)
        if arch is None:
            connus = [a["code"] for a in archs]
            raise HTTPException(
                status_code=404,
                detail=f"Archétype inconnu : {req.archetype_key}. Connus : {connus}",
            )
    else:
        arch = neutre

    # Filtrer bf sur les bases candidates (sous-ensemble de l'OP)
    bf_candidates = {b: v for b, v in bf.items() if b in req.bases}
    if not bf_candidates:
        raise HTTPException(status_code=400, detail="Aucune base candidate présente dans reward_inputs.")

    if req.persister:
        extra = {
            "archetype_key": req.archetype_key or "ad_hoc",
            "est_archetype": req.archetype_key is not None,
            "famille": "ad_hoc",
            "label": req.archetype_key or "composition personnalisée",
        }
        return composer_et_persister(
            arch, bf_candidates, cost, vote, prm, bbp, path_repli,
            extra, avec_agenda=req.avec_agenda, sup=sup,
        )

    # Aperçu (sans persistance)
    r = resoudre_archetype(arch, bf_candidates, cost, vote, prm, None, sup)
    if r is None:
        return {"ok": False, "error": "OR-Tools sans solution (contraintes infaisables ?)"}

    out: dict[str, Any] = {
        "ok": True,
        "compose": {k: r.get(k) for k in ("n_bases", "nuits", "value", "drive_h", "leg_max_h")},
        "route": r["route"],
        "nights_par_base": r.get("nights_par_base"),
        "nuits_deficit": r.get("nuits_deficit", 0),
    }
    if req.avec_geom:
        seq = developper_chemin(r["route"], bbp, path_repli)
        out["geom_sequence"] = seq
        try:
            out["geom"] = geom_par_astar(r["route"])
        except Exception as e:
            log.warning("geom_par_astar en aperçu: %s", e)
            try:
                out["geom"] = geom_par_sequence(seq)
            except Exception:
                pass
    if req.avec_agenda:
        try:
            ap = charger_params_agenda()
            mids = r["route"][1:-1]
            cand_by = charger_candidats(mids)
            depot = r["route"][0]
            base_noms = charger_noms_bases(mids + [depot])
            out["etapes"] = build_agenda(
                r["route"], r.get("nights_par_base") or {}, ap, cand_by,
                base_noms, depot=depot, depot_nom=base_noms.get(depot, "Kristiansand"),
            )
            out["n_etapes"] = len(out["etapes"])
        except Exception as e:
            out["agenda_error"] = str(e)[:120]
    return out
