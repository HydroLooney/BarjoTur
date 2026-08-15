#!/usr/bin/env python3
# M405 : manifeste photos par POI pour le hero carrousel (C) + endpoint détail POI (B).
# Agrège les _manifest.json de poi/**/photos/ -> data/echantillon-web/photos-manifest.json
# R1 : seulement les images RÉELLEMENT présentes sur disque (fichiers_locaux), TYPE≠icône (Wemap déjà retiré, M310).
#      Chaque image porte crédit/licence/sha256/source ; 'verifie' = licence connue et a_verifier=False.
import json, os, glob

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
POI_DIR = os.path.join(ROOT, 'poi')
OUT_DIR = os.path.join(ROOT, 'data', 'echantillon-web')
os.makedirs(OUT_DIR, exist_ok=True)

pois = []
n_images = n_verif = n_a_verifier = 0
for mpath in glob.glob(os.path.join(POI_DIR, '**', 'photos', '_manifest.json'), recursive=True):
    try:
        with open(mpath, encoding='utf-8') as f:
            m = json.load(f)
    except Exception:
        continue
    photos_dir = os.path.dirname(mpath)
    osm_id = str(m.get('osm_id') or '').strip()
    if not osm_id:
        continue
    imgs = []
    ordre = 0
    for e in (m.get('fichiers_locaux') or []):
        fichier = e.get('fichier')
        if not fichier:
            continue
        # R1 : le binaire doit exister sur disque
        if not os.path.isfile(os.path.join(photos_dir, fichier)):
            continue
        licence = (e.get('licence') or '').strip()
        a_verifier = bool(e.get('a_verifier'))
        verifie = (not a_verifier) and bool(licence)
        ordre += 1
        rel = os.path.relpath(os.path.join(photos_dir, fichier), ROOT)
        imgs.append({
            'fichier': fichier,
            'chemin': rel,                       # chemin de service média (relatif au repo)
            'ordre': ordre,
            'credit': (e.get('credit') or '').strip(),
            'licence': licence,
            'libre': e.get('libre'),
            'verifie': verifie,
            'sha256': e.get('sha256') or '',
            'source_url': e.get('source_url') or '',
        })
        n_images += 1
        n_verif += 1 if verifie else 0
        n_a_verifier += 0 if verifie else 1
    if not imgs:
        continue
    osm_valide = osm_id.lstrip('-').isdigit() and osm_id not in ('-1', '0', '')
    pois.append({
        'osm_id': osm_id,
        'cle': osm_id if osm_valide else ('poi:' + str(m.get('poi_id'))),  # clé stable pour l'endpoint B
        'osm_id_valide': osm_valide,
        'poi_id': m.get('poi_id'),
        'nom': m.get('nom'),
        'slug': m.get('slug'),
        'n_photos': len(imgs),
        'photos': imgs,
    })

pois.sort(key=lambda p: (p['osm_id']))
out = {
    'genere': '2026-08-16',
    'source': 'poi/**/photos/_manifest.json (fichiers_locaux présents sur disque)',
    'note_r1': 'Vraies photos uniquement (icônes Wemap retirées, M310). verifie=false => licence/crédit à confirmer avant hero.',
    'n_poi': len(pois),
    'n_images': n_images,
    'n_images_verifiees': n_verif,
    'n_images_a_verifier': n_a_verifier,
    'pois': pois,
}
outpath = os.path.join(OUT_DIR, 'photos-manifest.json')
with open(outpath, 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
print(f'écrit {outpath}')
print(f'POI avec photo : {len(pois)} | images : {n_images} (vérifiées {n_verif} / à vérifier {n_a_verifier})')
# répartition des licences (vérifiées)
from collections import Counter
lic = Counter(i['licence'] for p in pois for i in p['photos'] if i['verifie'])
print('licences (vérifiées) :', dict(lic))
