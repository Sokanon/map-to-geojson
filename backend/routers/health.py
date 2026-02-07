from fastapi import APIRouter

from ocr_service import is_tesseract_available, is_gemini_available

router = APIRouter()


@router.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "ocr_available": is_tesseract_available() or is_gemini_available(),
        "tesseract_available": is_tesseract_available(),
        "gemini_available": is_gemini_available(),
    }
