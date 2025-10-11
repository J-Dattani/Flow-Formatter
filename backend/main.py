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


# Routers
from .api import auth_routes
from .api import document_merger_routes
from .api import template_routes
from .api import dashboard_routes
from .api import authors_routes
app.include_router(auth_routes.router, prefix="/api")
app.include_router(document_merger_routes.router, prefix="/api")
app.include_router(template_routes.router, prefix="/api")
app.include_router(dashboard_routes.router, prefix="/api")
app.include_router(authors_routes.router, prefix="/api")


if __name__ == "__main__":
	import uvicorn
	uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
