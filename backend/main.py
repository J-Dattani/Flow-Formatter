from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Merger Tool Backend", version="0.1.0")

# CORS for local file and localhost frontend
app.add_middleware(
	CORSMiddleware,
	allow_origins=["*"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)


@app.get("/health")
async def health():
	return {"status": "ok"}


# Optional: mount routers here when implemented
# from .api import auth_routes, authors_routes, dashboard_routes, document_routes
# app.include_router(auth_routes.router, prefix="/api/auth")
# ...


if __name__ == "__main__":
	import uvicorn
	uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
