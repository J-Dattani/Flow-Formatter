# Merger Tool Backend (FastAPI)

Quick start (Windows, cmd):

1. Create a virtual environment and activate it
	- python -m venv .venv
	- .venv\Scripts\activate

2. Install dependencies
	- pip install -r requirements.txt

3. Run the API
	- uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

4. Health check
	- Open http://localhost:8000/health

You can later wire real routers under backend/api and include them in backend/main.py.
