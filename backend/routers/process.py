from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
import numpy as np

from schemas import ProcessRequest
from services.image_processing import (
    decode_image,
    preprocess_image,
    segment_by_color,
    extract_region_contours,
    contour_to_polygon,
)
from services.georeference import assign_zone_ids, transform_coordinates

router = APIRouter()


@router.post("/api/process")
async def process_image(request: ProcessRequest):
    """Main endpoint: process image and extract polygons"""
    try:
        img = decode_image(request.image_data)
        original_height, original_width = img.shape[:2]

        if request.crop:
            crop = request.crop
            img = img[
                crop.y: crop.y + crop.height,
                crop.x: crop.x + crop.width
            ]

        img_height, img_width = img.shape[:2]
        img_area = img_width * img_height

        processed = preprocess_image(img)
        labels = segment_by_color(processed, request.settings.color_clusters)

        all_polygons = []
        unique_labels = np.unique(labels)

        for label_id in unique_labels:
            contours = extract_region_contours(
                labels, label_id, request.settings, img_area
            )

            for contour in contours:
                poly = contour_to_polygon(contour)
                if poly:
                    all_polygons.append({"geometry": poly})

        features = assign_zone_ids(all_polygons)
        features = transform_coordinates(
            features,
            img_width,
            img_height,
            request.control_points,
            request.bounding_box
        )

        geojson = {
            "type": "FeatureCollection",
            "features": features,
            "metadata": {
                "image_width": img_width,
                "image_height": img_height,
                "original_width": original_width,
                "original_height": original_height,
                "georeferenced": bool(request.control_points or request.bounding_box),
                "coordinate_system": "EPSG:4326" if (request.control_points or request.bounding_box) else "pixel"
            }
        }

        return JSONResponse(content=geojson)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
