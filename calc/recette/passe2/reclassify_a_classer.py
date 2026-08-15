#!/usr/bin/env python3
# reclassify_a_classer.py — BarjoTur Worker A — M292 : reclasse poi/a-classer/ -> region/zone.
# DRY par defaut ; --apply. Move (jamais rm). region/zone par osm_id (poi.poi) sinon jointure spatiale (decoupage.zones).
import os, re, sys, glob, shutil, psycopg2
ROOT=os.getcwd(); POI=os.path.join(ROOT,'poi'); AC=os.path.join(POI,'a-classer')
APPLY='--apply' in sys.argv
REGION_SLUG={'Sorlandet':'sorlandet','Vestlandet':'vestlandet','Ostlandet':'ostlandet','Trondelag':'trondelag'}
cur=psycopg2.connect(host='localhost',port=5433,dbname='norvege_routing').cursor()
def fm(t):
    d={}; m=re.match(r'^---\n(.*?)\n---',t,re.S)
    if m:
        for l in m.group(1).splitlines():
            mm=re.match(r'^(\w+):\s*(.*)$',l)
            if mm: d[mm.group(1)]=mm.group(2).strip().strip('"')
    return d
def uniq(base):
    d=base; i=2
    while os.path.exists(d): d=f"{base}-{i}"; i+=1
    return d
moved=0; hors=0
for md in glob.glob(os.path.join(AC,'**','*.md'),recursive=True):
    slugdir=os.path.dirname(md)                    # .../a-classer/a-classer/<cat>/<slug>
    cat=os.path.basename(os.path.dirname(slugdir)) # <cat>
    d=fm(open(md,encoding='utf-8').read()); osm=d.get('osm_id','').strip(); lat=d.get('lat',''); lon=d.get('lon','')
    reg=zone=None
    if osm:
        cur.execute("SELECT region_id,zone_id FROM poi.poi WHERE osm_id=%s AND zone_id<>'' LIMIT 1",(osm,))
        r=cur.fetchone()
        if r and r[1]: reg,zone=r
    if not zone and lat and lon:
        cur.execute("""SELECT z.region_id,z.id FROM decoupage.zones z
           WHERE ST_Contains(ST_MakeValid(z.geom),ST_SetSRID(ST_MakePoint(%s,%s),4326)) LIMIT 1""",(float(lon),float(lat)))
        r=cur.fetchone()
        if r: reg,zone=r
    if reg in REGION_SLUG and zone:
        tgt=os.path.join(POI,REGION_SLUG[reg],zone,cat,os.path.basename(slugdir)); moved+=1
    else:
        tgt=os.path.join(POI,'_hors-emprise',cat,os.path.basename(slugdir)); hors+=1
    if APPLY:
        tgt=uniq(tgt); os.makedirs(os.path.dirname(tgt),exist_ok=True); shutil.move(slugdir,tgt)
print(f"[{'APPLY' if APPLY else 'DRY'}] a-classer reclasses: {moved} region/zone | {hors} hors-emprise")
