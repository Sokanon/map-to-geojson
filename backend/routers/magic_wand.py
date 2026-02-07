from fastapi import APIRouter, HTTPException

from magic_wand import magic_wand_select, mask_to_polygon, refine_mask, check_overlap
from ocr_service import (
    extract_text_from_polygon,
    extract_text_with_gemini,
    is_tesseract_available,
    is_gemini_available,
)
from schemas import MagicWandRequest, MagicWandResponse
from services.image_processing import decode_image

router = APIRouter()


@router.post("/api/magic-wand")
async def magic_wand(request: MagicWandRequest):
    """
    Magic wand selection endpoint.
    Click on the image to select a region using flood fill.
    Returns polygon coordinates and OCR text from the selected region.
    """
    try:
        img = decode_image(request.image_data)

        boundary_color = tuple(request.boundary_color[:3])
        mask, bbox = magic_wand_select(
            img,
            request.click_x,
            request.click_y,
            use_boundary_mode=request.use_boundary_mode,
            boundary_color=boundary_color,
            boundary_tolerance=request.boundary_tolerance,
            tolerance=request.tolerance
        )

        if bbox.get("error") == "selection_too_large":
            return MagicWandResponse(
                success=False,
                error="Selection too large - the boundary color may not be present in this area. Try adjusting the boundary color or tolerance."
            )

        refined_mask = refine_mask(mask)
        result = mask_to_polygon(refined_mask, request.simplify_tolerance)

        if result is None:
            return MagicWandResponse(
                success=False,
                error="No valid region selected. Try adjusting tolerance or clicking elsewhere."
            )

        if request.existing_polygons and result["polygon"]:
            new_ring = result["polygon"][0]
            if check_overlap(new_ring, request.existing_polygons):
                return MagicWandResponse(
                    success=False,
                    error="This area overlaps with an existing selection. Please select a different area."
                )

        ocr_text = ""
        ocr_confidence = 0.0

        if bbox["width"] > 0 and bbox["height"] > 0:
            polygon_coords = result["polygon"][0][:-1] if result["polygon"][0] else []

            if request.ocr_engine == "ai" and is_gemini_available():
                ocr_text, ocr_confidence = extract_text_with_gemini(
                    img, refined_mask, polygon_coords, model=request.ai_model
                )
            elif request.ocr_engine == "tesseract" and is_tesseract_available():
                ocr_text, ocr_confidence = extract_text_from_polygon(
                    img, refined_mask, polygon_coords
                )

            if not ocr_text:
                if request.ocr_engine == "ai" and is_tesseract_available():
                    ocr_text, ocr_confidence = extract_text_from_polygon(
                        img, refined_mask, polygon_coords
                    )
                elif request.ocr_engine == "tesseract" and is_gemini_available():
                    ocr_text, ocr_confidence = extract_text_with_gemini(
                        img, refined_mask, polygon_coords, model=request.ai_model
                    )

        return MagicWandResponse(
            success=True,
            polygon=result["polygon"],
            centroid=result["centroid"],
            bbox=bbox,
            ocr_text=ocr_text,
            ocr_confidence=ocr_confidence,
            area=result["area"]
        )

    except ValueError as e:
        return MagicWandResponse(success=False, error=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
