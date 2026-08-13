# Tests composeur — logique pure, sans DB ni OR-Tools.
# Les fonctions testées sont pures (aucune dépendance externe) : reward_base, distribuer_nuits,
# developper_chemin, _tmin, _tsab_agg.

import sys
import os
import types

# --- Patch de l'environnement pour éviter l'import psycopg/fastapi au chargement ---
# On injecte les stubs AVANT l'import du module composeur.
os.environ.setdefault("DATABASE_URL", "postgresql://stub/stub")

# Stub psycopg (connexion jamais appelée dans les tests purs)
psycopg_stub = types.ModuleType("psycopg")
sys.modules.setdefault("psycopg", psycopg_stub)

# Stub fastapi
fastapi_stub = types.ModuleType("fastapi")
class _FakeApp:
    def get(self, *a, **kw):
        return lambda f: f
    def post(self, *a, **kw):
        return lambda f: f
class _FakeHTTPException(Exception):
    def __init__(self, status_code=500, detail=""):
        self.status_code = status_code
        self.detail = detail
fastapi_stub.FastAPI = lambda **kw: _FakeApp()  # type: ignore[attr-defined]
fastapi_stub.HTTPException = _FakeHTTPException  # type: ignore[attr-defined]
sys.modules.setdefault("fastapi", fastapi_stub)

# Stub pydantic
pydantic_stub = types.ModuleType("pydantic")
class _BaseModel:
    def __init_subclass__(cls, **kw): pass
pydantic_stub.BaseModel = _BaseModel  # type: ignore[attr-defined]
def _Field(*a, **kw): return None  # type: ignore[return-value]
pydantic_stub.Field = _Field  # type: ignore[attr-defined]
sys.modules.setdefault("pydantic", pydantic_stub)

# Stub ortools
ort_stub = types.ModuleType("ortools")
ort_cs = types.ModuleType("ortools.constraint_solver")
ort_stub.constraint_solver = ort_cs  # type: ignore[attr-defined]
sys.modules.setdefault("ortools", ort_stub)
sys.modules.setdefault("ortools.constraint_solver", ort_cs)

# Ajouter le répertoire sidecar/ dans le path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import composeur  # noqa: E402  (import après les stubs)


# ---------------------------------------------------------------------------
# Tests reward_base
# ---------------------------------------------------------------------------

def _bf_simple(base_id: int) -> dict:
    return {base_id: {"f1": 0.5, "f2": 0.5, "f3": 0.5, "f4": 0.5, "f5": 0.5, "f6": 0.5,
                       "hf": 1.0, "rtop": 0.8, "latn": 0.5, "cout": 20.0,
                       "th_paysage": 1.0, "th_rando": 0.5, "th_nautique": 0.0, "th_culturel": 0.0}}


def _arch_neutre(code: str = "equilibre") -> dict:
    return {"code": code, "w_nat": 1.0, "w_gra": 1.0, "w_tra": 1.0, "w_ran": 1.0, "w_biv": 1.0,
            "w_inc": 1.0, "biais_nord": 0.5, "cap_hard_h": 6.0, "cadence": 2.0,
            "anti_foule": 0.0, "autonomie": 0.5}


def test_reward_base_positif():
    bf = _bf_simple(42)
    arch = _arch_neutre()
    prm = dict(composeur._DEF)
    r = composeur.reward_base(arch, 42, bf, {}, 1.0, prm)
    assert r > 0, f"Reward doit être positif, obtenu {r}"


def test_reward_base_vote_amplifie():
    bf = _bf_simple(42)
    arch = _arch_neutre()
    prm = dict(composeur._DEF)
    r_sans = composeur.reward_base(arch, 42, bf, {}, 1.0, prm)
    r_avec = composeur.reward_base(arch, 42, bf, {42: 0.3}, 1.0, prm)
    assert r_avec > r_sans, "Un vote positif doit augmenter le reward"


def test_reward_base_vote_negatif_reduit():
    bf = _bf_simple(42)
    arch = _arch_neutre()
    prm = dict(composeur._DEF)
    r_sans = composeur.reward_base(arch, 42, bf, {}, 1.0, prm)
    r_neg = composeur.reward_base(arch, 42, bf, {42: -0.3}, 1.0, prm)
    assert r_neg < r_sans, "Un vote négatif doit réduire le reward"


def test_reward_base_plancher_0_05():
    # Quand le reward brut est négatif (prix très élevé, facteurs nuls), le résultat doit rester ≥ 0.05
    bf = {1: {"f1": 0.0, "f2": 0.0, "f3": 0.0, "f4": 0.0, "f5": 0.0, "f6": 0.0,
               "hf": 0.0, "rtop": 0.0, "latn": 0.0, "cout": 1000.0,
               "th_paysage": 0.0, "th_rando": 0.0, "th_nautique": 0.0, "th_culturel": 0.0}}
    arch = _arch_neutre()
    prm = dict(composeur._DEF)
    prm["SENS_PRIX"] = 10.0
    r = composeur.reward_base(arch, 1, bf, {}, 1.0, prm)
    assert r >= 0.05, f"Reward plancher 0.05, obtenu {r}"


# ---------------------------------------------------------------------------
# Tests distribuer_nuits
# ---------------------------------------------------------------------------

def test_distribuer_nuits_total_exact():
    mids = [1, 2, 3]
    per, deficit = composeur.distribuer_nuits(mids, 6, {1: 2, 2: 2, 3: 3})
    assert sum(per) == 6, f"Somme attendue 6, obtenue {sum(per)}"
    assert deficit == 0


def test_distribuer_nuits_deficit():
    # 3 bases, max 1 chacune (supply pauvre), mais on veut 5 nuits : déficit = 2
    mids = [1, 2, 3]
    per, deficit = composeur.distribuer_nuits(mids, 5, {1: 1, 2: 1, 3: 1})
    # Le repli lève le cap ≤3, donc on doit atteindre 5 au final ou avoir un déficit honnête
    assert sum(per) <= 5
    assert sum(per) + deficit == 5 or sum(per) == 5


def test_distribuer_nuits_liste_vide():
    per, deficit = composeur.distribuer_nuits([], 5, {})
    assert per == []
    assert deficit == 5


def test_distribuer_nuits_cap_max_3():
    mids = [1]
    per, deficit = composeur.distribuer_nuits(mids, 4, {1: 10})
    # Max 3/base (cap dur M101) même si supply > 3
    assert per[0] <= 3


# ---------------------------------------------------------------------------
# Tests developper_chemin
# ---------------------------------------------------------------------------

def test_developper_chemin_chemin_direct():
    bbp = {(1, 2): [1, 2], (2, 3): [2, 3]}
    path_repli = {}
    seq = composeur.developper_chemin([1, 2, 3], bbp, path_repli)
    assert seq == [1, 2, 3], f"Séquence inattendue : {seq}"


def test_developper_chemin_repli_inverse():
    # La paire (2, 1) est absente mais (1, 2) est là → repli inversé
    bbp = {(1, 2): [1, 100, 2]}
    path_repli = {}
    seq = composeur.developper_chemin([2, 1], bbp, path_repli)
    assert seq[0] == 2 and seq[-1] == 1, f"Doit aller de 2 à 1, obtenu {seq}"


def test_developper_chemin_repli_apsp():
    # Ni (a, b) ni (b, a) dans bbp → repli sur path_repli
    bbp: dict = {}
    path_repli = {(5, 6): [5, 99, 6]}
    seq = composeur.developper_chemin([5, 6], bbp, path_repli)
    assert seq[0] == 5 and seq[-1] == 6


# ---------------------------------------------------------------------------
# Tests _tmin
# ---------------------------------------------------------------------------

def test_tmin_format_hhmm():
    assert composeur._tmin("07:30", 0) == 7 * 60 + 30


def test_tmin_entier():
    assert composeur._tmin("45", 0) == 45


def test_tmin_none_retourne_defaut():
    assert composeur._tmin(None, 99) == 99


# ---------------------------------------------------------------------------
# Tests _tsab_agg
# ---------------------------------------------------------------------------

def test_tsab_agg_meilleur_tier():
    res = composeur._tsab_agg(["B", "S", "A"])
    assert res is not None
    assert res["dominant"] == "S"


def test_tsab_agg_liste_vide():
    assert composeur._tsab_agg([]) is None


def test_tsab_agg_seulement_none():
    assert composeur._tsab_agg([None, None]) is None
