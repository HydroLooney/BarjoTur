# Sidecar composeur OR-Tools (M272 §2, C06) — image de déploiement Bomp4rd.
# Python 3.12 : ortools>=9.9 s'y installe (le local est en 3.14/PEP668, d'où le CP-SAT non exécutable hors conteneur).
# L'image porte le composeur FastAPI + le cœur allocation.py (CP-SAT couplé + leximin M255, validé par leximin_ref).
FROM python:3.12-slim

WORKDIR /app

# Dépendances d'abord (couche cache) : fastapi/uvicorn/psycopg/ortools/httpx.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Code du sidecar (composeur.py, allocation.py, agenda.py, horaires.py, leximin_ref.py, tests).
COPY . ./

EXPOSE 8001
ENV PORT=8001
# DATABASE_URL (DSN DB2) fourni au runtime par l'environnement (secret hors image, R2). Jamais en dur.
# Santé applicative : /health (sans curl dans l'image slim → urllib).
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8001/health').status==200 else 1)"

CMD ["uvicorn", "composeur:app", "--host", "0.0.0.0", "--port", "8001"]
