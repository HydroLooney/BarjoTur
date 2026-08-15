#!/usr/bin/env python3
# build_phototheque.py — photothèque de dev par POI pour la revue de Guillaume (M194 + M197).
# LECTURE SEULE base + écriture FICHIERS seulement dans BarjoTur/photos/ (gitignoré). Rien en base.
# Corpus d'octets réconciliés : media_v2/<poi_id> (a_verifier) + cache trash v2 guide/photos (osm_id crosswalk,
# licences via wikimedia_rapatriees.json). Balaie les 2 caches trash (M197), rapatrie le NOUVEAU seulement (dédup sha256).
# Non-POI (van/sites/ferry) + non rattachable → photos/_a_trier/ avec provenance. N'invente aucune licence (R1).
import json, os, re, hashlib, subprocess, shutil, unicodedata

ROOT = "/Volumes/Disque USB 2 To/00_DevLooney/BarjoTur"
SRC = f"{ROOT}/data/source"
OUT = f"{ROOT}/photos"
TRASH1 = "/Volumes/Disque USB 2 To/00_DevLooney/.trash/norvege-carte-obsolete-20260813/public"
TRASH2 = "/Volumes/Disque USB 2 To/00_CartoLooney/.trash/norvege-2027"
WM_MANIFEST = f"{TRASH1}/data/_photo_manifests/wikimedia_rapatriees.json"

def q(sql):
    r = subprocess.run(["psql","-h","localhost","-p","5433","-d","norvege_routing","-tAF\t","-c",sql],
                       capture_output=True, text=True)
    return [l.split("\t") for l in r.stdout.strip().split("\n") if l.strip()]

def slugify(nom, poi_id):
    s = unicodedata.normalize("NFKD", nom or f"poi-{poi_id}").encode("ascii","ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+","-",s).strip("-").lower()
    return (s or f"poi-{poi_id}")[:60]

def sha(p):
    h = hashlib.sha256()
    with open(p,"rb") as f:
        for c in iter(lambda: f.read(65536), b""): h.update(c)
    return h.hexdigest()

# --- données base : POI scorés + crosswalk osm_id→poi_id (scorés) + métadonnées poi.photo ---
pois = q("""SELECT p.poi_id, coalesce(p.nom,''), coalesce(p.region_libelle,p.region_id,''), coalesce(p.osm_id,'')
            FROM poi.poi p JOIN mcda2.reward_poi_v3 r ON r.poi_id=p.poi_id ORDER BY p.poi_id""")
osm2poi = {r[3]: int(r[0]) for r in pois if r[3]}
photo_rows = q("""SELECT poi_id, coalesce(credit,''), coalesce(source,''), coalesce(url_source,''),
                  coalesce(sha256,'') FROM poi.photo ORDER BY poi_id, ordre""")
meta, known_sha = {}, set()
for r in photo_rows:
    meta.setdefault(int(r[0]),[]).append(dict(credit=r[1], source=r[2], url_source=r[3], sha256=r[4]))
    if r[4]: known_sha.add(r[4])

# --- wikimedia manifest : osm_id(str) → licence par fichier ---
wm = {}
if os.path.exists(WM_MANIFEST):
    for x in json.load(open(WM_MANIFEST)):
        fich = os.path.basename(x.get("local") or x.get("fichier",""))
        wm[fich] = dict(credit=x.get("credit",""), licence=x.get("licence",""),
                        libre=x.get("libre"), a_verifier=x.get("a_verifier", True),
                        source_url=x.get("source_originale",""))

slugs, seen = {}, {}
for r in pois:
    pid = int(r[0]); s = slugify(r[1], pid)
    if s in seen: s = f"{s}-{pid}"
    seen[s] = True; slugs[pid] = s
poi_dir_sha = {}  # pid -> set(sha) pour dédup intra-POI

os.makedirs(OUT, exist_ok=True)
stat = dict(scored=len(pois), couverts=0, trous=0, copies=0, nouveaux=0, doublons=0,
            a_trier=0, trous_combles=0, trous_par_region={})
had_before = set(pid for pid in meta) | set(int(f) for f in os.listdir(f"{SRC}/media_v2") if f.isdigit())

def add_file(pid, srcpath, prefix):
    h = sha(srcpath)
    s = poi_dir_sha.setdefault(pid, set())
    if h in s: return "dup_local"
    isnew = h not in known_sha
    s.add(h)
    dst = f"{OUT}/{slugs[pid]}/{prefix}-{os.path.basename(srcpath)}"
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(srcpath, dst)
    stat["copies"] += 1
    stat["nouveaux" if isnew else "doublons"] += 1
    return "new" if isnew else "known"

# --- 1. media_v2/<poi_id> (a_verifier) ---
for pid in list(slugs):
    mv2 = f"{SRC}/media_v2/{pid}"
    if os.path.isdir(mv2):
        for fn in sorted(os.listdir(mv2)):
            fp = f"{mv2}/{fn}"
            if os.path.isfile(fp): add_file(pid, fp, "media_v2")

# --- 2. cache trash guide/photos (osm_id crosswalk + licences wm) ---
IMG = (".jpg",".jpeg",".png",".webp")
def sweep_guide(gdir, tag):
    if not os.path.isdir(gdir): return
    for fn in sorted(os.listdir(gdir)):
        if not fn.lower().endswith(IMG): continue
        m = re.match(r"^(?:poi-)?(-?\d+)-\d+\.", fn)
        if not m: continue
        osmid = m.group(1)
        pid = osm2poi.get(osmid)
        if pid is None: continue  # rattaché à un osm_id non scoré → ignoré ici (peut finir en _a_trier via sweep global)
        add_file(pid, f"{gdir}/{fn}", tag)
sweep_guide(f"{TRASH1}/guide/photos", "cache1guide")
sweep_guide(f"{SRC}/guide/photos", "guide")

# --- 3. balayage _a_trier : non-POI + non rattachable, dédup sha256, provenance ---
def sweep_trier(base, subdirs, tag):
    for sub in subdirs:
        d = f"{base}/{sub}" if sub else base
        if not os.path.isdir(d): continue
        for dp,_,fns in os.walk(d):
            for fn in fns:
                if not fn.lower().endswith(IMG): continue
                fp = f"{dp}/{fn}"
                try: h = sha(fp)
                except OSError: continue
                if h in known_sha: stat["doublons"] += 1; continue
                known_sha.add(h)
                rel = os.path.relpath(fp, base).replace("/","__")
                dst = f"{OUT}/_a_trier/{tag}/{rel}"
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                if not os.path.exists(dst):
                    shutil.copy2(fp, dst); stat["a_trier"] += 1; stat["nouveaux"] += 1
sweep_trier(TRASH1, ["van","sites","ferry","docs"], "cache1")
sweep_trier(TRASH2, [""], "cache2_cartolooney")

# --- 4. manifestes par POI + couverture ---
for r in pois:
    pid = int(r[0]); slug = slugs[pid]; d = f"{OUT}/{slug}"; os.makedirs(d, exist_ok=True)
    local = []
    for fn in sorted(os.listdir(d)) if os.path.isdir(d) else []:
        if fn.startswith("_") or not fn.lower().endswith(IMG): continue
        lic = wm.get(re.sub(r"^(media_v2|cache1guide|guide)-","",fn), {})
        local.append(dict(fichier=fn, sha256=sha(f"{d}/{fn}"),
                          credit=lic.get("credit",""), licence=lic.get("licence",""),
                          libre=lic.get("libre"), a_verifier=lic.get("a_verifier", True),
                          source_url=lic.get("source_url","")))
    remote = meta.get(pid, [])
    json.dump(dict(poi_id=pid, nom=r[1], region=r[2], osm_id=r[3], slug=slug,
                   fichiers_locaux=local, photos_base=remote, n_local=len(local), n_base=len(remote)),
              open(f"{d}/_manifest.json","w"), ensure_ascii=False, indent=1)
    if local or remote:
        stat["couverts"] += 1
        if pid not in had_before and local: stat["trous_combles"] += 1
    else:
        stat["trous"] += 1
        stat["trous_par_region"][r[2] or "∅"] = stat["trous_par_region"].get(r[2] or "∅",0)+1

# --- 5. _orphelins + _couverture.md ---
scored_ids = set(int(r[0]) for r in pois)
orph = sorted(int(f) for f in os.listdir(f"{SRC}/media_v2") if f.isdigit() and int(f) not in scored_ids)
os.makedirs(f"{OUT}/_orphelins", exist_ok=True)
json.dump(dict(dossiers_media_v2_non_scores=orph), open(f"{OUT}/_orphelins/_liste.json","w"), indent=1)
L = ["# Photothèque de dev par POI (revue Guillaume) — M194/M197","",
     f"- POI scorés : **{stat['scored']}**  · couverts **{stat['couverts']}** · trous **{stat['trous']}**",
     f"- Fichiers copiés : **{stat['copies']}** (nouveaux **{stat['nouveaux']}**, doublons écartés **{stat['doublons']}**)",
     f"- À trier (non-POI / non rattachable) : **{stat['a_trier']}**  · trous comblés par le balayage : **{stat['trous_combles']}**",
     f"- Dossiers media_v2 non scorés (`_orphelins/`) : **{len(orph)}**","",
     "> Catalogue Wikimedia = URL-only (manifeste porte crédit+url). media_v2 = licence `a_verifier`.",
     "> Guide/cache1 = licences via wikimedia_rapatriees.json (CC BY-SA 4.0, libre/a_verifier). Aucune licence inventée (R1).","",
     "## Trous par région"]
for reg,n in sorted(stat["trous_par_region"].items(), key=lambda x:-x[1]):
    L.append(f"- {reg} : {n}")
open(f"{OUT}/_couverture.md","w").write("\n".join(L)+"\n")
print(json.dumps({k:v for k,v in stat.items() if k!="trous_par_region"}, ensure_ascii=False))
print("PHOTOTHEQUE DONE")
