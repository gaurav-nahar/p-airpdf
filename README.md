# LiquidText Clone

A full-stack web application replicating core LiquidText features — interactive PDF reading, text extraction, snippet creation, a freehand drawing workspace, and AI-powered summarization.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Konva/React-Konva, Lexical, pdfjs-dist, react-rnd |
| Backend | FastAPI, SQLAlchemy, Uvicorn/Gunicorn |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Containerization | Docker + Docker Compose |

---

## Project Structure

```
liquid-text/
├── frontend/          # React application (port 3001 in Docker, 3333 locally)
├── backend/           # FastAPI application (port 8005 in Docker, 8000 locally)
├── summary/           # AI summarization service
├── docker-compose.yml
└── README.md
```

---

## Running with Docker (Recommended)

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) installed
- [Docker Compose](https://docs.docker.com/compose/install/) installed (included with Docker Desktop)

### Steps

**1. Clone the repository and navigate to the project root:**
```bash
git clone <repo-url>
cd liquid-text
```

**2. Build and start all services:**
```bash
docker compose up --build
```

To run in the background (detached mode):
```bash
docker compose up --build -d
```

**3. Access the app:**

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3001 |
| Backend API | http://localhost:8005 |
| API Docs (Swagger) | http://localhost:8005/docs |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

### Useful Docker Commands

```bash
# View running containers
docker compose ps

# View logs (all services)
docker compose logs -f

# View logs for a specific service
docker compose logs -f backend
docker compose logs -f frontend

# Stop all containers
docker compose down

# Stop and remove volumes (resets the database)
docker compose down -v

# Rebuild a single service after code changes
docker compose up --build backend
docker compose up --build frontend
```

---

## Running Locally (Without Docker)

### Prerequisites
- Node.js 18+
- Python 3.11+
- PostgreSQL 16 running locally
- Redis running locally

---

### 1. Database Setup

Create the database in PostgreSQL:
```sql
CREATE DATABASE liquidtext;
```

---

### 2. Backend (FastAPI)

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate        # Mac/Linux
# venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and set your DATABASE_URL:
# DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/liquidtext
# REDIS_URL=redis://localhost:6379/0

# Run database migrations
yoyo apply --database postgresql://postgres:YOUR_PASSWORD@localhost/liquidtext ./src/yoyo

# Start the server
uvicorn main:app --reload
```

Backend runs at: http://localhost:8000
API docs at: http://localhost:8000/docs

---

### 3. Frontend (React)

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```

Frontend runs at: http://localhost:3333

---

## Environment Variables

The backend uses a `.env` file at `backend/.env`. Required variables:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/liquidtext
REDIS_URL=redis://localhost:6379/0
SUMMARY_SERVICE_URL=http://localhost:8010/summarize
```

> When running via Docker Compose, these are injected automatically — you do not need to edit `.env`.

---

## Core Features

- **PDF Viewer** — Render multi-page PDFs with text layer support
- **Snippet Extraction** — Select and extract text/regions from PDFs into the workspace
- **Interactive Workspace** — Freehand drawing, connectors, and annotation canvas (Konva)
- **Draggable Text Boxes** — Resize and reposition extracted content freely
- **AI Summarization** — Summarize documents or selections via the summary service
- **Persistence** — All snippets, connections, and workspaces saved to PostgreSQL

---

## Core Libraries

### Frontend
- `react` & `react-dom` — UI framework
- `pdfjs-dist` — PDF rendering and text extraction engine
- `konva` & `react-konva` — Interactive canvas for the workspace
- `lexical` — Rich text editor for notes
- `react-rnd` — Draggable and resizable components
- `axios` — HTTP client for API calls
- `uuid` — Unique ID generation

### Backend
- `fastapi` — Web framework
- `uvicorn` / `gunicorn` — ASGI server
- `sqlalchemy` — ORM for database access
- `psycopg2-binary` — PostgreSQL adapter
- `redis` — Cache client
- `python-dotenv` — Environment variable management
- `yoyo-migrations` — Database schema migrations
