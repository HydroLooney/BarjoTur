#!/usr/bin/env python3
# scrape_bobilplassen.py — BarjoTur Worker A — M311/M314 #2 : scrape bobilplassen.no (robots OK).
# Par page : coords (google.maps.LatLng), services (tømmestasjon/vann/strøm/pris), VRAIE photo (og:image), nom.
# Respectueux : UA descriptif+contact, rate-limit 0.4s, perso, attribution. R1 : TYPE photo = og:image (vraie photo, pas icône).
import re, json, time, urllib.request
UA='barjotur-perso (personal roadtrip; contact guillaume.barjot.86@gmail.com)'
def get(url):
    return urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':UA}),timeout=25).read().decode('utf-8','ignore')
# 1) URLs des aires depuis le sitemap
sm=get("https://bobilplassen.no/page-sitemap.xml")
urls=[u for u in re.findall(r'<loc>([^<]+)</loc>', sm)
      if not re.search(r'/(kart-|annonser|welcome|willkommen|page-sitemap)|bobilplassen\.no/$', u)]
rows=[]
for i,u in enumerate(urls):
    try: h=get(u)
    except: continue
    m=re.search(r'google\.maps\.LatLng\(([\d.]+),\s*([\d.]+)\)', h)
    if not m: continue
    lat,lon=float(m.group(1)),float(m.group(2))
    if not (57<lat<72 and 4<lon<32): continue
    low=h.lower()
    img=re.search(r'<meta property="og:image"[^>]*content="([^"]+)"', h)
    slug=u.rstrip('/').split('/')[-1]
    ttl=re.search(r'<title>([^<]+)</title>', h)
    rows.append(dict(slug=slug, nom=(ttl.group(1).split('|')[0].strip() if ttl else slug), lat=lat, lon=lon,
        vidange=('tømmestasjon' in low or 'tommestasjon' in low),
        eau=('vann' in low or 'drikkevann' in low),
        electricite=('strøm' in low or 'strom' in low),
        dusj=('dusj' in low), toalett=('toalett' in low),
        gratis=('gratis' in low),
        photo_url=(img.group(1) if img else None), url=u))
    time.sleep(0.4)
    if i%100==0: print(f"... {i}/{len(urls)}")
json.dump(rows, open('/tmp/bobilplassen.json','w'), ensure_ascii=False)
from collections import Counter
print(f"bobilplassen scrapé : {len(rows)} aires (sud-Norvège) sur {len(urls)} pages")
print("  vidange:", sum(r['vidange'] for r in rows), "| eau:", sum(r['eau'] for r in rows),
      "| élec:", sum(r['electricite'] for r in rows), "| avec photo:", sum(1 for r in rows if r['photo_url']))
