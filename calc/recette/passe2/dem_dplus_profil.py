#!/usr/bin/env python3
# dem_dplus_profil.py — BarjoTur Worker A — M287/M314 #3 : D+/profil rando depuis le DEM CartoLooney.
# Echantillonne 1 pt/10 m le long de chaque sentier -> D+/D-/pente -> difficulte profil-familial.
# DEM = VRT temp /tmp/dtm10_z33.vrt (dalles 00_CartoLooney/sources/dtm10 in-place, jamais le cluster). R1 : altitude reelle.
import rasterio, psycopg2, numpy as np
from pyproj import Transformer
from shapely import wkb
from shapely.ops import transform as shp_transform

VRT='/tmp/dtm10_z33.vrt'
ds=rasterio.open(VRT)
to_utm=Transformer.from_crs(4326, 25833, always_xy=True).transform  # E-N metrique
conn=psycopg2.connect(host='localhost',port=5433,dbname='norvege_routing'); cur=conn.cursor(); up=conn.cursor()
cur.execute("SELECT rando_id, ST_AsBinary(ST_LineMerge(geom)) FROM poi.rando")
# params profil familial
up.execute("SELECT cle,valeur FROM staging.profil_familial"); prm={k:float(v) for k,v in up.fetchall()}
dmax=prm.get('dplus_max_jour',800); pmax=prm.get('pente_max_pct',25); lmax=prm.get('longueur_max_km',14); bonus=prm.get('bonus_boucle',0.15)
n=0; done=0
for rid, wkbin in cur.fetchall():
    geom=wkb.loads(bytes(wkbin))
    if geom.is_empty: continue
    g=shp_transform(to_utm, geom)  # -> metres
    # points tous les 10 m
    try: L=g.length
    except: continue
    if L<10: continue
    pts=[g.interpolate(d) for d in np.arange(0,L,10)]
    coords=[(p.x,p.y) for p in pts if not p.is_empty]
    if len(coords)<2: continue
    z=np.array([v[0] for v in ds.sample(coords)], dtype=float)
    z=z[np.isfinite(z)]; z=z[z>-100]  # nodata filter
    if len(z)<2: continue
    dz=np.diff(z)
    dplus=float(dz[dz>0].sum()); dmoins=float(-dz[dz<0].sum())
    slopes=np.abs(dz)/10.0*100  # pente % (delta / 10m)
    pmoy=float(slopes.mean()); pmx=float(slopes.max())
    lon_km=L/1000.0
    # difficulte familiale (base 1) + penalites profil, bonus boucle applique en SQL (est_boucle deja la)
    diff=1 + 1.2*max(dplus/dmax-1,0) + 0.8*max(pmx/pmax-1,0) + 0.5*max(lon_km/lmax-1,0)
    up.execute("""UPDATE staging.rando_profil SET dplus_m=%s,dmoins_m=%s,pente_moy_pct=%s,pente_max_pct=%s,
       difficulte_familiale=round((%s - %s*(CASE WHEN est_boucle THEN 1 ELSE 0 END))::numeric,3)
       WHERE rando_id=%s""",(round(dplus),round(dmoins),round(pmoy,1),round(pmx,1),diff,bonus,rid))
    done+=1
    if done%500==0: conn.commit()
conn.commit()
# stats
up.execute("SELECT count(*) FILTER (WHERE dplus_m IS NOT NULL), round(avg(dplus_m)) , round(max(dplus_m)) FROM staging.rando_profil")
print("D+/profil calcule:", up.fetchone(), "sur", done, "randos")
