"""
Magic Wand Selection - Flood fill bounded by a specific color
"""

import cv2
import numpy as np
from typing import Tuple, Optional, List
from collections import deque
from shapely.geometry import Polygon as ShapelyPolygon


def magic_wand_select_boundary(
    image: np.ndarray,
    seed_x: int,
    seed_y: int,
    boundary_color: Tuple[int, int, int] = (152, 152, 152),  # #989898
    boundary_tolerance: int = 15
) -> Tuple[np.ndarray, dict]:
    """
    Perform magic wand selection using flood fill bounded by a specific color.

    Args:
        image: BGR image as numpy array
        seed_x: X coordinate of click point
        seed_y: Y coordinate of click point
        boundary_color: RGB color that acts as boundary (default grey #989898)
        boundary_tolerance: How close a pixel must be to boundary_color to be considered boundary

    Returns:
        Tuple of (mask, bbox_dict)
        mask: Binary mask of selected region
        bbox_dict: Bounding box {x, y, width, height}
    """
    h, w = image.shape[:2]

    # Validate seed point
    if not (0 <= seed_x < w and 0 <= seed_y < h):
        raise ValueError(f"Seed point ({seed_x}, {seed_y}) out of image bounds ({w}x{h})")

    # Convert boundary color from RGB to BGR (OpenCV uses BGR)
    boundary_bgr = np.array([boundary_color[2], boundary_color[1], boundary_color[0]], dtype=np.float32)

    # Create a mask of boundary pixels
    # A pixel is a boundary if it's within tolerance of the boundary color
    image_float = image.astype(np.float32)
    diff = np.sqrt(np.sum((image_float - boundary_bgr) ** 2, axis=2))
    boundary_mask = diff <= boundary_tolerance * np.sqrt(3)  # Scale tolerance for RGB distance

    # Create result mask
    result_mask = np.zeros((h, w), dtype=np.uint8)

    # Check if seed point is on a boundary - if so, return empty
    if boundary_mask[seed_y, seed_x]:
        return result_mask, {"x": 0, "y": 0, "width": 0, "height": 0}

    # Flood fill using BFS, stopping at boundary pixels
    visited = np.zeros((h, w), dtype=bool)
    queue = deque([(seed_x, seed_y)])
    visited[seed_y, seed_x] = True

    min_x, max_x = seed_x, seed_x
    min_y, max_y = seed_y, seed_y

    while queue:
        x, y = queue.popleft()

        # Mark as selected
        result_mask[y, x] = 255

        # Update bounding box
        min_x = min(min_x, x)
        max_x = max(max_x, x)
        min_y = min(min_y, y)
        max_y = max(max_y, y)

        # Check 4-connected neighbors
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = x + dx, y + dy

            # Skip if out of bounds
            if not (0 <= nx < w and 0 <= ny < h):
                continue

            # Skip if already visited
            if visited[ny, nx]:
                continue

            visited[ny, nx] = True

            # Skip if it's a boundary pixel
            if boundary_mask[ny, nx]:
                continue

            queue.append((nx, ny))

    # Check if selection is too large (likely boundary detection failure)
    selected_pixels = np.sum(result_mask > 0)
    total_pixels = h * w
    selection_ratio = selected_pixels / total_pixels

    if selection_ratio > 0.8:
        return np.zeros((h, w), dtype=np.uint8), {
            "x": 0, "y": 0, "width": 0, "height": 0,
            "error": "selection_too_large"
        }

    bbox = {
        "x": int(min_x),
        "y": int(min_y),
        "width": int(max_x - min_x + 1),
        "height": int(max_y - min_y + 1)
    }

    return result_mask, bbox


def magic_wand_select_tolerance(
    image: np.ndarray,
    seed_x: int,
    seed_y: int,
    tolerance: int = 32
) -> Tuple[np.ndarray, dict]:
    """
    Perform magic wand selection using traditional tolerance-based flood fill.

    Args:
        image: BGR image as numpy array
        seed_x: X coordinate of click point
        seed_y: Y coordinate of click point
        tolerance: Color tolerance (0-255)

    Returns:
        Tuple of (mask, bbox_dict)
        mask: Binary mask of selected region
        bbox_dict: Bounding box {x, y, width, height}
    """
    h, w = image.shape[:2]

    # Validate seed point
    if not (0 <= seed_x < w and 0 <= seed_y < h):
        raise ValueError(f"Seed point ({seed_x}, {seed_y}) out of image bounds ({w}x{h})")

    # Create mask (needs to be 2 pixels larger than image)
    mask = np.zeros((h + 2, w + 2), np.uint8)

    # Flood fill flags
    flags = 4  # 4-connectivity
    flags |= cv2.FLOODFILL_MASK_ONLY
    flags |= cv2.FLOODFILL_FIXED_RANGE
    flags |= (255 << 8)  # Fill mask with 255

    # Perform flood fill
    cv2.floodFill(
        image.copy(),
        mask,
        (seed_x, seed_y),
        (255, 255, 255),
        (tolerance, tolerance, tolerance),
        (tolerance, tolerance, tolerance),
        flags
    )

    # Extract the actual mask (remove 1-pixel border)
    result_mask = mask[1:-1, 1:-1]

    # Find bounding box
    points = np.where(result_mask > 0)
    if len(points[0]) == 0:
        return result_mask, {"x": 0, "y": 0, "width": 0, "height": 0}

    y_min, y_max = points[0].min(), points[0].max()
    x_min, x_max = points[1].min(), points[1].max()

    bbox = {
        "x": int(x_min),
        "y": int(y_min),
        "width": int(x_max - x_min + 1),
        "height": int(y_max - y_min + 1)
    }

    return result_mask, bbox


def magic_wand_select(
    image: np.ndarray,
    seed_x: int,
    seed_y: int,
    use_boundary_mode: bool = True,
    boundary_color: Tuple[int, int, int] = (152, 152, 152),
    boundary_tolerance: int = 15,
    tolerance: int = 32
) -> Tuple[np.ndarray, dict]:
    """
    Perform magic wand selection.

    Args:
        image: BGR image as numpy array
        seed_x: X coordinate of click point
        seed_y: Y coordinate of click point
        use_boundary_mode: If True, use boundary color mode; if False, use tolerance mode
        boundary_color: RGB color that acts as boundary (for boundary mode)
        boundary_tolerance: How close to boundary color to be considered boundary
        tolerance: Color tolerance for tolerance mode

    Returns:
        Tuple of (mask, bbox_dict)
    """
    if use_boundary_mode:
        return magic_wand_select_boundary(image, seed_x, seed_y, boundary_color, boundary_tolerance)
    else:
        return magic_wand_select_tolerance(image, seed_x, seed_y, tolerance)


def mask_to_polygon(
    mask: np.ndarray,
    simplify_tolerance: float = 2.0
) -> Optional[dict]:
    """
    Convert binary mask to polygon using contour detection.

    Args:
        mask: Binary mask (255 = selected, 0 = not selected)
        simplify_tolerance: Douglas-Peucker simplification tolerance

    Returns:
        Dict with polygon coordinates, centroid, and area, or None if no valid contour
    """
    # Find contours
    contours, _ = cv2.findContours(
        mask,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE
    )

    if not contours:
        return None

    # Get largest contour
    contour = max(contours, key=cv2.contourArea)
    area = cv2.contourArea(contour)

    if area < 10:  # Minimum area threshold
        return None

    # Simplify contour using Douglas-Peucker algorithm
    epsilon = simplify_tolerance
    simplified = cv2.approxPolyDP(contour, epsilon, True)

    if len(simplified) < 3:
        return None

    # Convert to coordinate list
    points = simplified.squeeze()
    if len(points.shape) == 1:
        return None

    # Create closed polygon (GeoJSON format: [[[x, y], [x, y], ...]])
    coords = [[float(p[0]), float(p[1])] for p in points]
    if coords[0] != coords[-1]:
        coords.append(coords[0])  # Close the polygon

    # Compute centroid
    M = cv2.moments(contour)
    if M["m00"] != 0:
        cx = M["m10"] / M["m00"]
        cy = M["m01"] / M["m00"]
    else:
        # Fallback to bounding box center
        x, y, w, h = cv2.boundingRect(contour)
        cx = x + w / 2
        cy = y + h / 2

    return {
        "polygon": [coords],  # GeoJSON polygon coordinates
        "centroid": [float(cx), float(cy)],
        "area": float(area)
    }


def refine_mask(mask: np.ndarray) -> np.ndarray:
    """
    Refine mask using morphological operations.

    Args:
        mask: Binary mask

    Returns:
        Refined mask
    """
    kernel = np.ones((3, 3), np.uint8)

    # Close small gaps
    refined = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)

    # Open to remove noise
    refined = cv2.morphologyEx(refined, cv2.MORPH_OPEN, kernel, iterations=1)

    return refined


def check_overlap(
    new_polygon: List[List[float]],
    existing_polygons: List[List[List[List[float]]]]
) -> bool:
    """
    Check if new polygon overlaps with any existing polygon.

    Args:
        new_polygon: List of [x, y] coordinates for the new polygon ring
        existing_polygons: List of GeoJSON polygon coordinates (each is [[[x,y], ...]])

    Returns:
        True if new polygon overlaps with any existing polygon
    """
    if not existing_polygons:
        return False

    try:
        new_shape = ShapelyPolygon(new_polygon)
        if not new_shape.is_valid:
            new_shape = new_shape.buffer(0)  # Fix invalid geometry

        for existing in existing_polygons:
            if not existing or not existing[0]:
                continue
            existing_ring = existing[0]  # First ring of GeoJSON polygon
            existing_shape = ShapelyPolygon(existing_ring)
            if not existing_shape.is_valid:
                existing_shape = existing_shape.buffer(0)

            if new_shape.intersects(existing_shape):
                return True

        return False
    except Exception:
        # If geometry operations fail, allow the selection
        return False
