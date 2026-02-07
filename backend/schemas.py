from pydantic import BaseModel
from typing import List, Optional


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


class MagicWandRequest(BaseModel):
    image_data: str  # Base64 encoded image
    click_x: int  # X coordinate of click
    click_y: int  # Y coordinate of click
    use_boundary_mode: bool = True  # True = boundary color mode, False = tolerance mode
    boundary_color: List[int] = [152, 152, 152]  # RGB boundary color (default #989898)
    boundary_tolerance: int = 15  # How close to boundary color to be considered boundary
    tolerance: int = 32  # Color tolerance for non-boundary mode
    simplify_tolerance: float = 2.0  # Douglas-Peucker simplification
    ocr_engine: str = "ai"  # "ai" or "tesseract"
    ai_model: str = "google/gemini-2.0-flash-001"  # AI model to use when ocr_engine is "ai"
    existing_polygons: Optional[List[List[List[List[float]]]]] = None  # Existing polygon coords


class MagicWandResponse(BaseModel):
    success: bool
    polygon: Optional[List[List[List[float]]]] = None  # GeoJSON polygon coords
    centroid: Optional[List[float]] = None
    bbox: Optional[dict] = None
    ocr_text: str = ""
    ocr_confidence: float = 0.0
    area: float = 0.0
    error: Optional[str] = None
