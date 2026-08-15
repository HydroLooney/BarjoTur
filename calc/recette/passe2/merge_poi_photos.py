#!/usr/bin/env python3
# merge_poi_photos.py — BarjoTur Worker A — M301 : merge photothèque photos/ DANS poi/ par osm_id.
# DRY-RUN par defaut ; --apply pour deplacer. Non destructif : move (jamais rm), provenance conservee.
import os, re, sys, glob, json, shutil, hashlib
ROOT=os.getcwd(); POI=os.path.join(ROOT,'poi'); PH=os.path.join(ROOT,'photos')
APPLY='--apply' in sys.argv
IMG=('.jpg','.jpeg','.png','.webp','.gif')

# index osm_id -> dossier poi/
poi_osm={}
for f in glob.glob(os.path.join(POI,'**','*.md'),recursive=True):
    if '_audit' in f or 'README' in f: continue
    m=re.search(r'^osm_id:\s*(.+)$',open(f,encoding='utf-8').read(),re.M)
    if m and m.group(1).strip().strip('"'): poi_osm[m.group(1).strip().strip('"')]=os.path.dirname(f)

moved=0; imgs_moved=0; no_match=0; empty=0
for man in glob.glob(os.path.join(PH,'*','_manifest.json')):
    folder=os.path.dirname(man)
    d=json.load(open(man)); osm=str(d.get('osm_id') or '')
    imgs=[x for x in os.listdir(folder) if x.lower().endswith(IMG)]
    if not imgs: empty+=1; continue
    tgt_poi=poi_osm.get(osm)
    if not tgt_poi: no_match+=1; continue
    dest=os.path.join(tgt_poi,'photos')
    moved+=1; imgs_moved+=len(imgs)
    if APPLY:
        os.makedirs(dest,exist_ok=True)
        for x in imgs+['_manifest.json']:
            src=os.path.join(folder,x)
            if os.path.exists(src): shutil.move(src, os.path.join(dest,x))

print(f"[{'APPLY' if APPLY else 'DRY'}] dossiers photo mergés: {moved} ({imgs_moved} images) -> poi/<…>/photos/")
print(f"  vides (rien à déplacer): {empty} | sans poi/ correspondant: {no_match}")
