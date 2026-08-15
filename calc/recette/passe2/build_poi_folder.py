#!/usr/bin/env python3
# build_poi_folder.py — BarjoTur Worker A — finalise le dossier canonique poi/ (M292/M296).
# Etape (a) STRUCTURE : reclasser a-classer + generer les POI manquants + aménités services-van.
# DRY-RUN par defaut (compte + valide les chemins) ; --apply pour ecrire. R1 : jamais ecraser une fiche existante.
import os, re, sys, glob, unicodedata, psycopg2, json

ROOT = os.getcwd()  # lance depuis BarjoTur/ (cwd)
POI = os.path.join(ROOT, 'poi')
assert os.path.isdir(POI), f"poi/ introuvable sous {ROOT} — lancer depuis BarjoTur/"
APPLY = '--apply' in sys.argv

REGION_SLUG = {'Sorlandet':'sorlandet','Vestlandet':'vestlandet','Ostlandet':'ostlandet','Trondelag':'trondelag'}
CAT_CALQUE = {  # 17 buckets (repris de 80_)
 'point de vue':'point-de-vue','belvedere':'point-de-vue','repere':'point-de-vue','paroi':'point-de-vue','point-interet':'point-de-vue',
 'cascade':'cascade','glacier':'glacier','fjord':'fjord','nature':'nature','vallee':'nature','lac':'nature',
 'parc national':'parc-national','plage':'plage','ile':'ile','rando':'rando','ville':'ville','village':'ville','quartier':'ville',
 'musee':'culture','eglise':'culture','monument':'culture','patrimoine':'culture',
 'manger':'restauration','cafe':'restauration','brasserie':'restauration','sortir':'restauration',
 'dormir':'hebergement','activite':'activite','sauna':'activite','festival':'activite','shopping':'activite',
 'route panoramique':'route','route_touristique':'route','route':'route','train-panoramique':'route','itineraire-velo':'route','circuit_ville':'route',
 'aire_design':'aire','phare':'phare'}
def calque(c): return CAT_CALQUE.get((c or '').strip().lower(),'autre')
def slug(s):
    s=unicodedata.normalize('NFKD',(s or '')).encode('ascii','ignore').decode()
    s=re.sub(r'[^a-zA-Z0-9]+','-',s).strip('-').lower()
    return s or 'sans-nom'

conn=psycopg2.connect(host='localhost',port=5433,dbname='norvege_routing'); cur=conn.cursor()

# osm_ids deja presents dans poi/ (pour ne pas doublonner)
def existing_osm():
    s=set()
    for f in glob.glob(os.path.join(POI,'**','*.md'),recursive=True):
        if '_audit' in f or 'README' in f: continue
        try: t=open(f,encoding='utf-8').read()
        except: continue
        m=re.search(r'^osm_id:\s*(.+)$',t,re.M)
        if m and m.group(1).strip().strip('"'): s.add(m.group(1).strip().strip('"'))
    return s
have=existing_osm()

def uniq_dir(base):
    d=base; i=2
    while os.path.exists(d): d=f"{base}-{i}"; i+=1
    return d

# --- 1) POI scorés sans dossier -> generer ---
# region/zone : de poi.poi si presents, sinon jointure spatiale sur decoupage.zones (169 sans region/zone)
cur.execute("""SELECT p.osm_id,p.nom,p.categorie,
     COALESCE(NULLIF(p.region_id,''), zj.region_id) AS region_id,
     COALESCE(NULLIF(p.zone_id,''),   zj.zone_id)   AS zone_id,
     round(ST_Y(p.geom)::numeric,5),round(ST_X(p.geom)::numeric,5),
     coalesce(rp.tier,''), coalesce(p.presentation,''), coalesce(p.description,''), coalesce(p.votable,false)
   FROM poi.poi p JOIN mcda2.reward_poi rp ON rp.poi_id=p.poi_id
   LEFT JOIN LATERAL (SELECT z.region_id, z.id AS zone_id FROM decoupage.zones z
                      WHERE ST_Contains(ST_MakeValid(z.geom), p.geom) LIMIT 1) zj ON true""")
gen_poi=0; skip=0; noreg=0
for osm,nom,cat,reg,zone,lat,lon,tier,pres,desc,vot in cur.fetchall():
    if osm in have: skip+=1; continue
    if not reg or reg not in REGION_SLUG or not zone:
        # hors des 22 zones (nord Trondheim / îles hors emprise) -> dossier _hors-emprise (un POI = un dossier, M292)
        d=os.path.join(POI,'_hors-emprise',calque(cat),slug(nom)); noreg+=1
        reg=reg or ''; zone=zone or ''
    else:
        d=os.path.join(POI,REGION_SLUG[reg],zone,calque(cat),slug(nom))
    gen_poi+=1
    if APPLY:
        d=uniq_dir(d); os.makedirs(d,exist_ok=True)
        body=f"""---
type: fiche-poi
nom: "{(nom or '').replace('"',"'")}"
lat: {lat}
lon: {lon}
region_id: {reg}
zone_id: {zone}
categorie: "{cat or ''}"
categorie_calque: {calque(cat)}
osm_id: {osm}
tier_defaut: "{tier}"
votable: {str(vot).lower()}
---

## Présentation
{pres or '_(à compléter — catalogue/Wemap/vault)_'}

## Description
{desc or ''}

## Sources
_(provenance par champ à consolider en 90_ : vault > catalogue > Wemap > guide_enrichi)_
"""
        open(os.path.join(d,slug(nom)+'.md'),'w',encoding='utf-8').write(body)

# --- 2) Aménités services-van assignables -> generer ---
cur.execute("""SELECT a.amenite_id,a.type,a.nom, round(ST_Y(a.geom)::numeric,5),round(ST_X(a.geom)::numeric,5),
   z.region_id,z.id, a.plein_eau,a.vidange_grises,a.electricite,a.provenance::text
   FROM amenites.amenite a JOIN decoupage.zones z ON ST_Contains(ST_MakeValid(z.geom),a.geom)
   WHERE a.nom IS NOT NULL""")
SUBCAT={'aire_repos':'aire-repos','camping':'camping','bobilplass':'bobilplass'}
gen_am=0; am_noreg=0
for aid,typ,nom,lat,lon,reg,zone,eau,vid,elec,prov in cur.fetchall():
    if reg not in REGION_SLUG: am_noreg+=1; continue
    d=os.path.join(POI,REGION_SLUG[reg],zone,'services-van',slug(nom))
    gen_am+=1
    if APPLY:
        d=uniq_dir(d); os.makedirs(d,exist_ok=True)
        def b(v): return 'null' if v is None else str(v).lower()
        body=f"""---
type: fiche-amenite
categorie: services-van
sous_categorie: {SUBCAT.get(typ,typ)}
nom: "{(nom or '').replace('"',"'")}"
lat: {lat}
lon: {lon}
region_id: {reg}
zone_id: {zone}
amenite_id: {aid}
plein_eau: {b(eau)}
vidange_grises: {b(vid)}
electricite: {b(elec)}
provenance: {prov}
---

## Services
- Plein d'eau : {b(eau)} · Vidange grises : {b(vid)} · Électricité : {b(elec)}
- Laverie/douche/wc/wifi : inconnu _(à compléter annuaires)_

## Photo
_(à scraper : bobilavisen/bobilplassen)_
"""
        open(os.path.join(d,slug(nom)+'.md'),'w',encoding='utf-8').write(body)

print(f"[{'APPLY' if APPLY else 'DRY'}] POI a generer: {gen_poi} (deja present {skip}, sans region/zone {noreg})")
print(f"[{'APPLY' if APPLY else 'DRY'}] aménités services-van a generer: {gen_am} (sans region {am_noreg})")
