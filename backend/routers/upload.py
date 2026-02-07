from fastapi import APIRouter, UploadFile, File, HTTPException
from PIL import Image
import io
import base64

router = APIRouter()


@router.post("/api/upload")
async def upload_image(file: UploadFile = File(...)):
    """Upload and return image info"""
    try:
        contents = await file.read()

        if file.content_type == "application/pdf":
            try:
                from pdf2image import convert_from_bytes
                images = convert_from_bytes(contents)
                if images:
                    buffer = io.BytesIO()
                    images[0].save(buffer, format="PNG")
                    base64_data = base64.b64encode(buffer.getvalue()).decode()
                    width, height = images[0].size
                    return {
                        "success": True,
                        "image_data": f"data:image/png;base64,{base64_data}",
                        "width": width,
                        "height": height,
                        "pages": len(images)
                    }
            except ImportError:
                raise HTTPException(
                    status_code=400,
                    detail="PDF support requires poppler. Install with: apt-get install poppler-utils"
                )

        image = Image.open(io.BytesIO(contents))
        width, height = image.size

        buffer = io.BytesIO()
        if image.mode == "RGBA":
            image.save(buffer, format="PNG")
            mime = "image/png"
        else:
            image.save(buffer, format="PNG")
            mime = "image/png"

        base64_data = base64.b64encode(buffer.getvalue()).decode()

        return {
            "success": True,
            "image_data": f"data:{mime};base64,{base64_data}",
            "width": width,
            "height": height
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
