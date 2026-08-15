#!/usr/bin/env python3
# build_staging_poi_v3.py — BarjoTur Worker A — 90_ fondation : parse poi/ (autorité) -> staging.poi_v3.
# Extrait frontmatter + Présentation/Synthèse + ## Sources multilingues (confiance R5b). NON destructif (crée staging).
import os, re, glob, psycopg2
ROOT=os.getcwd(); POI=os.path.join(ROOT,'poi')
LANGS={'FR','EN','NO','SV','DA','NL','DE','RU','IT','ES'}
def fm(t):
    d={}; m=re.match(r'^---\n(.*?)\n---',t,re.S)
    if m:
        for l in m.group(1).splitlines():
            mm=re.match(r'^(\w+):\s*(.*)$',l)
            if mm: d[mm.group(1)]=mm.group(2).strip().strip('"')
    return d
def sec(body,name):
    m=re.search(r'##\s*'+name+r'\s*\n(.*?)(?=\n## |\Z)',body,re.S|re.I)
    return (m.group(1).strip() if m else '')
def sources_ml(body):
    m=re.search(r'## Sources multilingues\s*\n(.*?)(?=\n## |\Z)',body,re.S)
    if not m: return 0,0
    langs=set(); n=0
    for line in m.group(1).splitlines():
        c=[x.strip() for x in line.strip('|').split('|')]
        if len(c)>=2 and c[0].upper() in LANGS: langs.add(c[0].upper()); n+=1
    return n,len(langs)

conn=psycopg2.connect(host='localhost',port=5433,dbname='norvege_routing'); cur=conn.cursor()
cur.execute("""DROP TABLE IF EXISTS staging.poi_v3;
CREATE TABLE staging.poi_v3(
  osm_id text, nom text, categorie text, categorie_calque text, region_id text, zone_id text,
  lat double precision, lon double precision, tier_defaut text, votable boolean,
  a_presentation boolean, a_description boolean, desc_len int,
  n_sources_ml int, n_langues_ml int, chemin text)""")
rows=[]
for f in glob.glob(os.path.join(POI,'**','*.md'),recursive=True):
    if '_audit' in f or 'README' in os.path.basename(f) or '/services-van/' in f or os.path.basename(f).startswith('_'): continue
    t=open(f,encoding='utf-8').read(); d=fm(t); body=t[t.find('---',3)+3:] if t.startswith('---') else t
    pres=sec(body,'Présentation'); desc=sec(body,'Description')+sec(body,'Synthèse')
    ns,nl=sources_ml(body)
    try: lat=float(d.get('lat')); lon=float(d.get('lon'))
    except: lat=lon=None
    rows.append((d.get('osm_id') or None, d.get('nom'), d.get('categorie'), d.get('categorie_calque'),
        d.get('region_id') or None, d.get('zone_id') or None, lat, lon, d.get('tier_defaut') or None,
        (str(d.get('votable','')).lower()=='true'), bool(pres), bool(desc), len(pres)+len(desc),
        ns, nl, f.replace(ROOT+'/','')))
cur.executemany("""INSERT INTO staging.poi_v3 VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""", rows)
conn.commit()
cur.execute("""SELECT count(*), count(*) FILTER (WHERE a_presentation), count(*) FILTER (WHERE a_description),
  count(*) FILTER (WHERE n_sources_ml>0), round(avg(n_langues_ml) FILTER (WHERE n_langues_ml>0),1) FROM staging.poi_v3""")
r=cur.fetchone()
print(f"staging.poi_v3 : {r[0]} POI | présentation {r[1]} | description/synthèse {r[2]} | avec Sources multilingues {r[3]} (moy {r[4]} langues)")
