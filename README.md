# DirTera

[![Frontend CI](https://github.com/Uno-stark/DirTera/actions/workflows/frontend.yml/badge.svg)](https://github.com/Uno-stark/DirTera/actions/workflows/frontend.yml)
[![Backend CI](https://github.com/Uno-stark/DirTera/actions/workflows/backend.yml/badge.svg)](https://github.com/Uno-stark/DirTera/actions/workflows/backend.yml)

DirTera is an Ethiopian web directory — a place where local businesses and services can register their websites, get discovered, and grow their online presence.

Owners submit their site, pay a subscription fee using Telebirr or CBE (verified automatically via [links.et](https://links.et)), and go live after a quick admin review. Visitors can then browse, filter by category or domain, read reviews, and click through to any listed site. Premium subscribers get featured placement at the top of every listing page.

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite, React Router |
| Backend | Python 3.11, FastAPI, SQLAlchemy 2 (async) |
| Database | SQLite (dev) · PostgreSQL / Supabase (prod) |
| Auth | Google OAuth 2.0 |
| Payments | links.et receipt verification (Telebirr / CBE) |
| Images | Supabase Storage |

---

## Getting started

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
cp .env.dev .env             # fill in secrets
alembic upgrade head
uvicorn app.main:app --reload
```

API available at `http://localhost:8000`  
Swagger UI at `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App available at `http://localhost:5173`

---

## Docs

- [API reference](docs/api.md)
- [Architecture](docs/arch.md)
