"""
Map Image to GeoJSON/TopoJSON Converter - Backend API
Handles image processing and polygon extraction
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import APP_TITLE
from routers.process import router as process_router
from routers.upload import router as upload_router
from routers.magic_wand import router as magic_wand_router
from routers.health import router as health_router

app = FastAPI(title=APP_TITLE)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(process_router)
app.include_router(upload_router)
app.include_router(magic_wand_router)
app.include_router(health_router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
