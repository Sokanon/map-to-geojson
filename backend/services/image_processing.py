from typing import List, Optional
import base64
import io

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage

from schemas import ExtractionSettings


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
    denoised = cv2.fastNlMeansDenoisingColored(img, None, 10, 10, 7, 21)
    lab = cv2.cvtColor(denoised, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)

    enhanced = cv2.merge([l, a, b])
    return cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)


def segment_by_color(img: np.ndarray, n_clusters: int = 32) -> np.ndarray:
    """Segment image by color using k-means clustering"""
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    pixels = lab.reshape(-1, 3).astype(np.float32)

    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.2)
    _, labels, _ = cv2.kmeans(
        pixels, n_clusters, None, criteria, 10, cv2.KMEANS_PP_CENTERS
    )

    return labels.reshape(img.shape[:2])


def extract_region_contours(
    labels: np.ndarray,
    label_id: int,
    settings: ExtractionSettings,
    img_area: int
) -> List[np.ndarray]:
    """Extract contours for a specific label/color region"""
    mask = (labels == label_id).astype(np.uint8) * 255

    kernel = np.ones((settings.morph_kernel_size, settings.morph_kernel_size), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)

    if settings.fill_holes:
        mask = ndimage.binary_fill_holes(mask).astype(np.uint8) * 255

    contours, _ = cv2.findContours(
        mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )

    min_area = img_area * (settings.min_area_percent / 100)
    valid_contours = []

    for contour in contours:
        area = cv2.contourArea(contour)
        if area >= min_area:
            if settings.smooth_contours:
                epsilon = settings.simplify_tolerance
                contour = cv2.approxPolyDP(contour, epsilon, True)

            if len(contour) >= 3:
                valid_contours.append(contour)

    return valid_contours


def contour_to_polygon(contour: np.ndarray) -> Optional[dict]:
    """Convert OpenCV contour to GeoJSON-style polygon coordinates"""
    points = contour.squeeze()
    if len(points.shape) == 1:
        return None

    coords = [[float(p[0]), float(p[1])] for p in points]
    if coords[0] != coords[-1]:
        coords.append(coords[0])

    if len(coords) < 4:
        return None

    return {"type": "Polygon", "coordinates": [coords]}
