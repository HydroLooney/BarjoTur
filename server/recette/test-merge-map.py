#!/usr/bin/env python3
# test-merge-map.py (M339 #3) — test À BLANC, PUR (sans DB), de la garantie merge-map du CONTRAT-FLUX v3 :
# reporter photos/votes du perdant (osm_id_supprime) vers le gagnant (osm_id_conserve) AVANT l'assertion 0-orphelin, de
# sorte qu'AUCUNE photo/vote n'orpheline et qu'AUCUNE ne soit perdue. Modélise le report SQL de `sync-recompute-v3.sh`
# étape 4b (UPDATE ... poi_osm_id = gagnant WHERE = perdant) et le prouve sur une fusion synthétique. Garde anti-régression.


def reporter(refs, mmap):
    """Applique la merge-map : chaque référence sur un perdant devient une référence sur son gagnant. Pur."""
    return [mmap.get(r, r) for r in refs]


def orphelins(refs, valides):
    """Références qui ne pointent sur aucun osm_id valide du référentiel v3. Pur."""
    return [r for r in refs if r not in valides]


def main():
    # Scénario : UNE fusion LOSER -> WINNER ; le perdant porte 1 photo + 1 vote (le cas dangereux).
    photos = ["ok1", "LOSER"]
    votes = ["ok1", "LOSER"]
    valides_v3 = {"ok1", "WINNER"}  # après recompute : LOSER a disparu du référentiel, WINNER présent
    mmap = {"LOSER": "WINNER"}      # mcda2.merge_map_v3 : osm_id_supprime -> osm_id_conserve

    fails = 0

    # 1. SANS report : le perdant orphelinerait → prouve que le report est NÉCESSAIRE.
    if orphelins(photos, valides_v3) == ["LOSER"] and orphelins(votes, valides_v3) == ["LOSER"]:
        print("✅ sans report : LOSER orpheline (report merge-map nécessaire)")
    else:
        print("❌ scénario invalide : l'orphelinage sans report n'est pas démontré")
        fails += 1

    # 2. AVEC report : 0 orphelin.
    ph2, vo2 = reporter(photos, mmap), reporter(votes, mmap)
    if orphelins(ph2, valides_v3) == [] and orphelins(vo2, valides_v3) == []:
        print("✅ avec report : 0 orphelin (photos + votes reportés perdant→gagnant)")
    else:
        print(f"❌ orphelins après report : photos={orphelins(ph2, valides_v3)} votes={orphelins(vo2, valides_v3)}")
        fails += 1

    # 3. 0 perdu : comptes préservés.
    if len(ph2) == len(photos) and len(vo2) == len(votes):
        print("✅ 0 perdu (comptes photos/votes préservés)")
    else:
        print("❌ perte de photo/vote au report")
        fails += 1

    # 4. Report correct : le perdant pointe bien sur le gagnant, plus aucune trace du perdant.
    if "WINNER" in ph2 and "WINNER" in vo2 and "LOSER" not in ph2 and "LOSER" not in vo2:
        print("✅ perdant→gagnant : LOSER remplacé par WINNER partout")
    else:
        print("❌ report incomplet")
        fails += 1

    print("----")
    print("== MERGE-MAP (dry) : PASS — 0 orphelin, 0 perdu ==" if fails == 0 else "== MERGE-MAP (dry) : FAIL ==")
    return 1 if fails else 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
