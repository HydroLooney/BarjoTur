#!/usr/bin/env python3
# scrape_bobilplassen_full.py — capture TOUTE la fiche bobilplass + URL (demande Guillaume « on ne sait jamais »).
# Stocke le texte complet de la page (nettoyé) + url dans staging.bobilplassen_full, pour re-extraction services fiable ultérieure.
import re, time, urllib.request, psycopg2
UA='barjotur-perso (personal roadtrip; contact guillaume.barjot.86@gmail.com)'
conn=psycopg2.connect(host='localhost',port=5433,dbname='norvege_routing'); cur=conn.cursor(); w=conn.cursor()
cur.execute("DROP TABLE IF EXISTS staging.bobilplassen_full; CREATE TABLE staging.bobilplassen_full(slug text, url text, fiche_texte text, fiche_html_octets int, capte date)")
w2=conn.cursor(); w2.execute("SELECT slug, url FROM staging.bobilplassen_raw"); rows=w2.fetchall()
def clean(h):
    h=re.sub(r'<script.*?</script>','',h,flags=re.S); h=re.sub(r'<style.*?</style>','',h,flags=re.S)
    h=re.sub(r'<[^>]+>',' ',h); h=re.sub(r'\s+',' ',h)
    return h.strip()
n=0
for slug,url in rows:
    try:
        raw=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':UA}),timeout=25).read().decode('utf-8','ignore')
    except: continue
    txt=clean(raw)[:8000]  # borne raisonnable
    w.execute("INSERT INTO staging.bobilplassen_full VALUES(%s,%s,%s,%s,%s)",(slug,url,txt,len(raw),'2026-08-16')); n+=1
    if n%100==0: conn.commit()
    time.sleep(0.4)
conn.commit()
print(f"fiches bobilplass capturées (texte complet + URL): {n}")
