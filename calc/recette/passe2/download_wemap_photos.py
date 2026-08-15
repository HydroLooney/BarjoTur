#!/usr/bin/env python3
# download_wemap_photos.py — BarjoTur Worker A — M308 : telecharge les photos Wemap dans poi/.
# Nearest wemap image par POI scoré (<150m) -> poi/<…>/<slug>/photos/wemap-<id>.<ext> + sidecar provenance/licence/sha256.
# Respectueux : timeout, rate-limit doux, skip erreurs. Flag licence communautaire (pas de republication).
import os, re, sys, glob, json, hashlib, time, urllib.request, psycopg2
ROOT=os.getcwd(); POI=os.path.join(ROOT,'poi')
# index osm_id -> dossier poi/
poi_osm={}
for f in glob.glob(os.path.join(POI,'**','*.md'),recursive=True):
    if '_audit' in f or 'README' in f: continue
    m=re.search(r'^osm_id:\s*(.+)$',open(f,encoding='utf-8').read(),re.M)
    if m and m.group(1).strip().strip('"'): poi_osm[m.group(1).strip().strip('"')]=os.path.dirname(f)
cur=psycopg2.connect(host='localhost',port=5433,dbname='norvege_routing').cursor()
# nearest wemap image par POI scoré (<150m)
cur.execute("""
SELECT DISTINCT ON (p.osm_id) p.osm_id, w.wemap_id, w.image_url, w.page_url
FROM poi.poi p JOIN mcda2.reward_poi r ON r.poi_id=p.poi_id
JOIN staging.wemap_img w ON ST_DWithin(w.geom::geography, p.geom::geography, 150)
WHERE w.image_url ~ '^https?://'
ORDER BY p.osm_id, ST_Distance(w.geom::geography, p.geom::geography)""")
rows=cur.fetchall()
ok=0; skip=0; err=0
for osm,wid,url,page in rows:
    d=poi_osm.get(osm)
    if not d: skip+=1; continue
    ph=os.path.join(d,'photos'); os.makedirs(ph,exist_ok=True)
    ext=os.path.splitext(url.split('?')[0])[1].lower()
    if ext not in ('.jpg','.jpeg','.png','.webp'): ext='.jpg'
    dest=os.path.join(ph, f'wemap-{wid}{ext}')
    if os.path.exists(dest): skip+=1; continue
    try:
        req=urllib.request.Request(url, headers={'User-Agent':'barjotur-perso'})
        data=urllib.request.urlopen(req, timeout=15).read()
        if len(data)<1000: err+=1; continue
        open(dest,'wb').write(data)
        sha=hashlib.sha256(data).hexdigest()
        json.dump({'source':'wemap','wemap_id':wid,'url_source':url,'page_url':page,
                   'licence':'communautaire-a-verifier','licence_flag':True,'sha256':sha,
                   'octets':len(data),'date':'2026-08-15','republication':False},
                  open(dest+'.json','w'), ensure_ascii=False)
        ok+=1
        time.sleep(0.25)  # rate-limit doux
    except Exception as e:
        err+=1
print(f"Wemap download : ok {ok} | skip {skip} | err {err} | candidats {len(rows)}")
