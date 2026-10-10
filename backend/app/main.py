import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.app.config import DATA_DIR, UPLOAD_DIR, HEATMAP_DIR, PROJECT_ROOT
from backend.app.database import init_db, SessionLocal
from backend.app.seed_data import seed_database
from backend.app.api.endpoints import router as api_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("radiant_ai")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize tables and seed demo data if database is fresh
    logger.info("Initializing RadiantAI database schema...")
    init_db()
    
    db = SessionLocal()
    try:
        seed_database(db)
    except Exception as e:
        logger.warning(f"Seed database warning: {e}")
    finally:
        db.close()
        
    logger.info("RadiantAI backend initialized and ready.")
    yield
    logger.info("Shutting down RadiantAI backend.")

app = FastAPI(
    title="RadiantAI — Multimodal AI Radiology Copilot API",
    description=(
        "Production-oriented research prototype for chest radiograph multi-label abnormality classification, "
        "Grad-CAM visual explainability, and evidence-grounded structured report draft synthesis."
    ),
    version="1.0.0-research",
    lifespan=lifespan
)

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Router
app.include_router(api_router, prefix="/api")

@app.get("/api/health")
def health_check():
    import torch
    return {
        "status": "healthy",
        "service": "RadiantAI Backend",
        "version": "1.0.0-research",
        "pytorch_version": torch.__version__,
        "cuda_available": torch.cuda.is_available(),
        "device": "cuda" if torch.cuda.is_available() else "cpu"
    }

# Mount static frontend production build if available
frontend_dist = PROJECT_ROOT / "frontend" / "dist"
if frontend_dist.exists():
    from fastapi.responses import FileResponse
    assets_dir = frontend_dist / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api"):
            return None
        file_path = frontend_dist / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(frontend_dist / "index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)

