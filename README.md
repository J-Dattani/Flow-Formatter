![Flow-Formatter Logo](frontend/assets/logo_white.png)

> Generate structured, professional PDFs from dynamic templates with auto Table of Contents, clean pagination, and a unified A4 renderer—powered by a minimal FastAPI backend and a lightweight, framework‑free frontend.


## 📘 Overview

Flow-Formatter lets teams design templates (chapters, headings, paragraphs, images, tables), preview them in true A4, and export production‑ready PDFs with:

- Auto‑generated TOC with dot leaders and right‑aligned page numbers
- A guaranteed hard page break after TOC so content starts at the top of the next page
- Stable text wrapping (no mid‑word breaks) and constrained media/tables
- Optional Supabase storage and authentication

---

## ✨ Features

- 🧱 Advanced template editor with quick actions (TOC + chapter skeleton)
- 🧭 Auto TOC injection at the top of the document
- ✂️ Hard page break after TOC (no bleed, no phantom gaps)
- 🧵 Smart wrapping and hyphenation; clean typography defaults
- 🖼 Media/table constraints to avoid layout bursts
- 🧬 Public form mode to render templates with user inputs
- 🔐 Optional Supabase + RLS for persistence

---

## 🧠 Tech Stack

| Layer     | Tech / Library                                   | Notes |
|----------:|:--------------------------------------------------|:------|
| Frontend  | HTML5, CSS3, Vanilla JS                           | Lightweight, no heavy framework |
| UI        | Bootstrap 5, Font Awesome                         | Styling and icons |
| Rendering | html2pdf.js (jsPDF + html2canvas)                 | Client-side PDF export |
| Backend   | Python, FastAPI, Uvicorn                          | REST API + CORS |
| Data      | Supabase (optional)                               | Auth + storage |
| Packaging | pip + requirements.txt                            | Backend dependencies |

---

## 📂 Folder Structure

```bash
Flow-Formatter/
├─ README.md
├─ backend/
│  ├─ main.py                # FastAPI app + CORS + /health
│  ├─ requirements.txt       # fastapi, uvicorn, dotenv
│  ├─ api/                   # (auth, templates, documents, ...)
│  ├─ services/              # business logic
│  ├─ models/                # pydantic/data models
│  └─ generators/            # html/pdf utils (if extended)
├─ frontend/
│  ├─ admin/                 # admin UI (templates, authors, dashboard, ...)
│  ├─ assets/                # logos and icons
│  ├─ components/            # shared HTML fragments (sidebar, etc)
│  ├─ css/                   # variables + components
│  ├─ js/
│  │  ├─ preview-renderer.js # A4 layout, TOC, pagebreaks, PDF prep
│  │  ├─ templates.js        # admin template flows + export
│  │  ├─ form-generator.js   # public form preview + PDF export
│  │  ├─ supabase-client.js  # Supabase wiring
│  │  └─ api.js              # REST + local prototype data
│  ├─ form.html              # public form UI
│  └─ user/                  # public login/landing
└─ ...
```

---

## ⚙ Installation & Setup

> Prerequisites: Python 3.10+, pip. Any static server (or VS Code Live Server) for frontend.

### 1) Clone the repository

```bash
git clone https://github.com/J-Dattani/Flow-Formatter.git
cd Flow-Formatter
```

### 2) Backend (FastAPI)

Windows (cmd):

```cmd
python -m venv .venv
.venv\Scripts\activate
pip install -r backend\requirements.txt

uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Health check: http://localhost:8000/health → `{ "status": "ok" }`

### 3) Frontend

Option A: VS Code “Live Server”
- Open `frontend/` → Right‑click `admin/templates.html` → “Open with Live Server”

Option B: Python simple server

```cmd
cd frontend
python -m http.server 3000
```

Open:
- Admin: http://127.0.0.1:3000/admin/templates.html
- Public Form: http://127.0.0.1:3000/form.html

---

## 🔐 Environment Variables

Backend `.env` (create `backend/.env`):

```ini
# FastAPI / Uvicorn
HOST=0.0.0.0
PORT=8000
ENV=development

# Supabase (optional)
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
SUPABASE_SERVICE_ROLE=YOUR_SERVICE_ROLE_KEY  # (do not commit)
```

Frontend options:
- Provide Supabase creds via query params (demo): `?supaUrl=...&supaAnon=...`
- Or define globals (before `supabase-client.js`):

```html
<script>
	window.SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
	window.SUPABASE_ANON_KEY = "YOUR_PUBLIC_ANON_KEY";
	// optional: window.SUPABASE_SERVICE_ROLE (never expose in production!)
	// optional: window.API_BASE_URL
</script>
```

---

## 💻 Usage

### Admin workflow
1. Create a new template in Admin → Templates
2. Insert TOC and chapter skeleton (quick actions)
3. Preview and export as A4 PDF (TOC page is isolated; content starts at top of next page)

### Public form workflow
1. Share a link to `form.html` (optionally with embedded template JSON)
2. Users fill fields → Preview → Download PDF

Example export flow:

```js
const container = PreviewRenderer.buildContainer(template, { includeTitle: false });
PreviewRenderer.prepareForPdf(container);
html2pdf().set({
	margin: [10,10,10,10],
	image: { type: 'jpeg', quality: 0.98 },
	html2canvas: { scale: 2, useCORS: true, logging: false },
	jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
	pagebreak: { mode: ['css', 'legacy'] }
}).from(container).save('document.pdf');
```

---

## 📸 Screenshots / Demo

Add assets under `docs/screenshots/` and reference them:

```md
![Admin Templates](docs/screenshots/admin-templates.png)
![A4 Preview with TOC](docs/screenshots/a4-preview-toc.png)
![Public Form](docs/screenshots/public-form.png)
```

---

## 🧩 API Reference (Current)

| Method | Endpoint  | Description    | Auth |
|------:|:---------- |:---------------|:----:|
| GET    | `/health` | Service status |  ❌  |

> Extend by mounting routers in `backend/api` and `app.include_router(...)` within `backend/main.py`.

---

## 🗂 Database Schema (Supabase‑friendly)

> Minimal schema designed for template management and document generation. Adjust names/constraints per your org.

### Entity Overview

| Entity     | Purpose                                  |
|-----------:|:------------------------------------------|
| users      | Authenticated users/admins                |
| templates  | Template metadata + editor content JSON   |
| documents  | Generated documents from templates        |

### Tables

#### users

| Column       | Type        | Constraints                 |
|-------------:|:------------|:----------------------------|
| id           | uuid        | pk, default gen_random_uuid()|
| email        | text        | unique, not null            |
| name         | text        |                              |
| role         | text        | default 'admin'             |
| created_at   | timestamptz | default now()               |

#### templates

| Column       | Type        | Constraints                                   |
|-------------:|:------------|:----------------------------------------------|
| id           | uuid        | pk, default gen_random_uuid()                 |
| owner_id     | uuid        | references users(id)                          |
| name         | text        | not null                                      |
| description  | text        |                                              |
| category     | text        | e.g., 'document','report','research'         |
| metadata     | jsonb       | stores editor.content + layout settings       |
| version      | int         | default 1                                     |
| status       | text        | 'draft' | 'active'                            |
| updated_at   | timestamptz | default now()                                 |

Recommended `metadata` shape:

```json
{
	"editor": {
		"content": [
			{ "id": "...", "type": "title|subtitle|paragraph|image|table|...", "content": "...", "properties": {"fontSize": 16} }
		]
	},
	"typography": {"fontFamily": "Inter", "lineHeight": 1.6},
	"margins": {"top": 10, "right": 10, "bottom": 10, "left": 10},
	"options": {"includeToc": true}
}
```

#### documents

| Column       | Type        | Constraints                           |
|-------------:|:------------|:--------------------------------------|
| id           | uuid        | pk, default gen_random_uuid()         |
| template_id  | uuid        | references templates(id)              |
| author_id    | uuid        | references users(id) (optional)       |
| payload      | jsonb       | resolved fields used in generation    |
| created_at   | timestamptz | default now()                         |

Row Level Security (RLS): enable and scope by `owner_id` (templates) and `author_id` (documents) as needed.

---

## 🧱 Architecture

- Frontend
	- `preview-renderer.js` unifies preview and PDF, injecting TOC, enforcing break‑after on TOC, and adding dynamic breaks before headings that would orphan at page ends.
- Backend
	- FastAPI base with `/health`; expand with `backend/api/*` routers.

---

## 🧑‍💻 Contributing

1. Fork the repo
2. Create a branch: `git checkout -b feat/your-change`
3. Commit: `feat(renderer): add H3 pagination`
4. Push and open a PR

**Guidelines**: Keep PRs small, comment tricky logic (pagination), and follow semantic commits.

---

## 🚀 Deployment

**Backend** (Render/Railway/Fly):

```bash
pip install -r backend/requirements.txt
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

**Frontend** (Vercel/Netlify/Static): deploy `frontend/` and set API/Supabase envs.

---

## 📅 Roadmap

- Accurate TOC page numbers (two‑pass render)
- Cross‑references and figure/table captions
- Collaborative editing
- DOCX export

---

## 💬 Feedback & Support

Open an issue: https://github.com/J-Dattani/Flow-Formatter/issues

---

## 📄 License

MIT © Contributors

---

## ❤ Acknowledgements

FastAPI • html2pdf.js • Supabase • Bootstrap

---

> If you like this project, don’t forget to ⭐ star the repository!

