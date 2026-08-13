"""calc.lib, module partagé du moteur de calcul BarjoTur.

But : une seule implémentation de l'APSP, du reward_base et du plan_jour,
importée par le calcul à cru (DB1) et référencée par le portage sidecar (DB2).
Supprime la cause racine de la dérive DB1/DB2 (audit R06.A) : deux copies
indépendantes du même modèle. Le test d'écart (calc/tests/ecart) garantit la
fidélité du portage.

Modules cibles (à porter depuis 00_CartoLooney/norvege-2027) :
- composeur : reward_base, apsp, solve, distribute_nights (a_op_archetypes.py)
- jour      : plan_jour, build_agenda (a_microop_jour.py)
- registre  : lecture single-source des paramètres (budget.parametre), zéro constante en dur
"""
