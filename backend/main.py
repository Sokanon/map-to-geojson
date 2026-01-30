"""
Map Image to GeoJSON/TopoJSON Converter - Backend API
Handles image processing and polygon extraction
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Tuple
import cv2
import numpy as np
from PIL import Image
import io
import base64
from shapely.geometry import Polygon, MultiPolygon
from shapely.ops import unary_union
from scipy import ndimage
import json

app = FastAPI(title="Map to GeoJSON Converter")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CropArea(BaseModel):
    x: int
    y: int
    width: int
    height: int


class ExtractionSettings(BaseModel):
    min_area_percent: float = 0.1  # Minimum polygon area as % of image
    simplify_tolerance: float = 2.0  # Douglas-Peucker simplification
    color_clusters: int = 32  # Number of color clusters for segmentation
    morph_kernel_size: int = 3  # Morphological operations kernel
    fill_holes: bool = True
    smooth_contours: bool = True


class GeoreferencePoint(BaseModel):
    image_x: float
    image_y: float
    geo_lng: float
    geo_lat: float


class BoundingBox(BaseModel):
    top_left_lat: float
    top_left_lng: float
    bottom_right_lat: float
    bottom_right_lng: float


class ProcessRequest(BaseModel):
    image_data: str  # Base64 encoded image
    crop: Optional[CropArea] = None
    settings: ExtractionSettings = ExtractionSettings()
    control_points: Optional[List[GeoreferencePoint]] = None
    bounding_box: Optional[BoundingBox] = None


def decode_image(base64_data: str) -> np.ndarray:
    """Decode base64 image to OpenCV format"""
    if "," in base64_data:
        base64_data = base64_data.split(",")[1]

    image_bytes = base64.b64decode(base64_data)
    image = Image.open(io.BytesIO(image_bytes))

    if image.mode == "RGBA":
        # Convert RGBA to RGB with white background
        background = Image.new("RGB", image.size, (255, 255, 255))
        background.paste(image, mask=image.split()[3])
        image = background
    elif image.mode != "RGB":
        image = image.convert("RGB")

    return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)


def preprocess_image(img: np.ndarray) -> np.ndarray:
    """Preprocess image: denoise and improve contrast"""
    # Denoise
    denoised = cv2.fastNlMeansDenoisingColored(img, None, 10, 10, 7, 21)

    # Convert to LAB for better contrast
    lab = cv2.cvtColor(denoised, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)

    # Apply CLAHE to L channel
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)

    enhanced = cv2.merge([l, a, b])
    return cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)


def segment_by_color(img: np.ndarray, n_clusters: int = 32) -> np.ndarray:
    """Segment image by color using k-means clustering"""
    # Convert to LAB color space for better color differentiation
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)

    # Reshape for k-means
    pixels = lab.reshape(-1, 3).astype(np.float32)

    # K-means clustering
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.2)
    _, labels, centers = cv2.kmeans(
        pixels, n_clusters, None, criteria, 10, cv2.KMEANS_PP_CENTERS
    )

    # Reshape labels back to image shape
    return labels.reshape(img.shape[:2])


def extract_region_contours(
    labels: np.ndarray,
    label_id: int,
    settings: ExtractionSettings,
    img_area: int
) -> List[np.ndarray]:
    """Extract contours for a specific label/color region"""
    # Create binary mask for this label
    mask = (labels == label_id).astype(np.uint8) * 255

    # Morphological operations to clean up
    kernel = np.ones((settings.morph_kernel_size, settings.morph_kernel_size), np.uint8)

    # Close small gaps
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)

    # Open to remove noise
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)

    # Fill holes if requested
    if settings.fill_holes:
        mask = ndimage.binary_fill_holes(mask).astype(np.uint8) * 255

    # Find contours
    contours, hierarchy = cv2.findContours(
        mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )

    # Filter by area
    min_area = img_area * (settings.min_area_percent / 100)
    valid_contours = []

    for contour in contours:
        area = cv2.contourArea(contour)
        if area >= min_area:
            # Simplify contour
            if settings.smooth_contours:
                epsilon = settings.simplify_tolerance
                contour = cv2.approxPolyDP(contour, epsilon, True)

            if len(contour) >= 3:  # Valid polygon needs at least 3 points
                valid_contours.append(contour)

    return valid_contours


def contour_to_polygon(contour: np.ndarray) -> Optional[dict]:
    """Convert OpenCV contour to GeoJSON-style polygon coordinates"""
    points = contour.squeeze()
    if len(points.shape) == 1:
        return None

    # Close the polygon
    coords = [[float(p[0]), float(p[1])] for p in points]
    if coords[0] != coords[-1]:
        coords.append(coords[0])

    if len(coords) < 4:  # Need at least 3 unique points + closing point
        return None

    return {"type": "Polygon", "coordinates": [coords]}


def compute_centroid(coords: List[List[float]]) -> Tuple[float, float]:
    """Compute centroid of polygon coordinates"""
    ring = coords[0] if coords and coords[0] else []
    if not ring:
        return (0.0, 0.0)

    x_sum = sum(p[0] for p in ring[:-1])  # Exclude closing point
    y_sum = sum(p[1] for p in ring[:-1])
    n = len(ring) - 1

    return (x_sum / n, y_sum / n) if n > 0 else (0.0, 0.0)


def assign_zone_ids(polygons: List[dict]) -> List[dict]:
    """
    Assign deterministic zone IDs based on centroid position.
    Sort by Y (top to bottom), then X (left to right).
    """
    # Compute centroids and sort
    polygon_data = []
    for poly in polygons:
        centroid = compute_centroid(poly["geometry"]["coordinates"])
        polygon_data.append({
            "polygon": poly,
            "centroid_x": centroid[0],
            "centroid_y": centroid[1]
        })

    # Sort: Y ascending (top to bottom), then X ascending (left to right)
    polygon_data.sort(key=lambda p: (p["centroid_y"], p["centroid_x"]))

    # Assign IDs
    result = []
    for i, data in enumerate(polygon_data, start=1):
        zone_id = f"ZONE_{i:04d}"
        feature = {
            "type": "Feature",
            "properties": {"zone_id": zone_id},
            "geometry": data["polygon"]["geometry"]
        }
        result.append(feature)

    return result


def transform_coordinates(
    features: List[dict],
    img_width: int,
    img_height: int,
    control_points: Optional[List[GeoreferencePoint]] = None,
    bounding_box: Optional[BoundingBox] = None
) -> List[dict]:
    """Transform pixel coordinates to geographic coordinates"""

    if bounding_box:
        # Simple linear interpolation for bounding box
        for feature in features:
            coords = feature["geometry"]["coordinates"][0]
            transformed = []
            for point in coords:
                # Normalize to 0-1
                norm_x = point[0] / img_width
                norm_y = point[1] / img_height

                # Interpolate to geographic coordinates
                lng = bounding_box.top_left_lng + norm_x * (
                    bounding_box.bottom_right_lng - bounding_box.top_left_lng
                )
                lat = bounding_box.top_left_lat + norm_y * (
                    bounding_box.bottom_right_lat - bounding_box.top_left_lat
                )
                transformed.append([lng, lat])

            feature["geometry"]["coordinates"] = [transformed]

    elif control_points and len(control_points) >= 4:
        # Compute affine transformation from control points
        src_points = np.array([
            [cp.image_x, cp.image_y] for cp in control_points
        ], dtype=np.float32)
        dst_points = np.array([
            [cp.geo_lng, cp.geo_lat] for cp in control_points
        ], dtype=np.float32)

        # Use perspective transform for 4+ points
        if len(control_points) == 4:
            M = cv2.getPerspectiveTransform(src_points[:4], dst_points[:4])

            for feature in features:
                coords = feature["geometry"]["coordinates"][0]
                points = np.array([[p] for p in coords], dtype=np.float32)
                transformed = cv2.perspectiveTransform(points, M)
                feature["geometry"]["coordinates"] = [
                    [[float(p[0][0]), float(p[0][1])] for p in transformed]
                ]
        else:
            # Use homography for more points
            M, _ = cv2.findHomography(src_points, dst_points)

            for feature in features:
                coords = feature["geometry"]["coordinates"][0]
                points = np.array([[p] for p in coords], dtype=np.float32)
                transformed = cv2.perspectiveTransform(points, M)
                feature["geometry"]["coordinates"] = [
                    [[float(p[0][0]), float(p[0][1])] for p in transformed]
                ]

    # If no georeferencing, keep pixel coordinates
    return features


@app.post("/api/process")
async def process_image(request: ProcessRequest):
    """Main endpoint: process image and extract polygons"""
    try:
        # Decode image
        img = decode_image(request.image_data)
        original_height, original_width = img.shape[:2]

        # Apply crop if specified
        if request.crop:
            crop = request.crop
            img = img[
                crop.y : crop.y + crop.height,
                crop.x : crop.x + crop.width
            ]

        img_height, img_width = img.shape[:2]
        img_area = img_width * img_height

        # Preprocess
        processed = preprocess_image(img)

        # Segment by color
        labels = segment_by_color(processed, request.settings.color_clusters)

        # Extract polygons from each color region
        all_polygons = []
        unique_labels = np.unique(labels)

        # Identify background (usually the most common label or white regions)
        # We'll extract all regions and let area filtering handle background

        for label_id in unique_labels:
            contours = extract_region_contours(
                labels, label_id, request.settings, img_area
            )

            for contour in contours:
                poly = contour_to_polygon(contour)
                if poly:
                    all_polygons.append({"geometry": poly})

        # Assign deterministic zone IDs
        features = assign_zone_ids(all_polygons)

        # Transform coordinates if georeferencing provided
        features = transform_coordinates(
            features,
            img_width,
            img_height,
            request.control_points,
            request.bounding_box
        )

        # Build GeoJSON
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


@app.post("/api/upload")
async def upload_image(file: UploadFile = File(...)):
    """Upload and return image info"""
    try:
        contents = await file.read()

        # Handle PDF
        if file.content_type == "application/pdf":
            try:
                from pdf2image import convert_from_bytes
                images = convert_from_bytes(contents)
                if images:
                    # Convert first page to base64
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

        # Handle regular images
        image = Image.open(io.BytesIO(contents))
        width, height = image.size

        # Convert to base64
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


@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
