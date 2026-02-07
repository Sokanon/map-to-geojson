from typing import List, Optional, Tuple
import cv2
import numpy as np

from schemas import BoundingBox, GeoreferencePoint


def compute_centroid(coords: List[List[float]]) -> Tuple[float, float]:
    """Compute centroid of polygon coordinates"""
    ring = coords[0] if coords and coords[0] else []
    if not ring:
        return (0.0, 0.0)

    x_sum = sum(p[0] for p in ring[:-1])
    y_sum = sum(p[1] for p in ring[:-1])
    n = len(ring) - 1

    return (x_sum / n, y_sum / n) if n > 0 else (0.0, 0.0)


def assign_zone_ids(polygons: List[dict]) -> List[dict]:
    """
    Assign deterministic zone IDs based on centroid position.
    Sort by Y (top to bottom), then X (left to right).
    """
    polygon_data = []
    for poly in polygons:
        centroid = compute_centroid(poly["geometry"]["coordinates"])
        polygon_data.append({
            "polygon": poly,
            "centroid_x": centroid[0],
            "centroid_y": centroid[1]
        })

    polygon_data.sort(key=lambda p: (p["centroid_y"], p["centroid_x"]))

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
        for feature in features:
            coords = feature["geometry"]["coordinates"][0]
            transformed = []
            for point in coords:
                norm_x = point[0] / img_width
                norm_y = point[1] / img_height

                lng = bounding_box.top_left_lng + norm_x * (
                    bounding_box.bottom_right_lng - bounding_box.top_left_lng
                )
                lat = bounding_box.top_left_lat + norm_y * (
                    bounding_box.bottom_right_lat - bounding_box.top_left_lat
                )
                transformed.append([lng, lat])

            feature["geometry"]["coordinates"] = [transformed]

    elif control_points and len(control_points) >= 4:
        src_points = np.array([
            [cp.image_x, cp.image_y] for cp in control_points
        ], dtype=np.float32)
        dst_points = np.array([
            [cp.geo_lng, cp.geo_lat] for cp in control_points
        ], dtype=np.float32)

        if len(control_points) == 4:
            matrix = cv2.getPerspectiveTransform(src_points[:4], dst_points[:4])

            for feature in features:
                coords = feature["geometry"]["coordinates"][0]
                points = np.array([[p] for p in coords], dtype=np.float32)
                transformed = cv2.perspectiveTransform(points, matrix)
                feature["geometry"]["coordinates"] = [
                    [[float(p[0][0]), float(p[0][1])] for p in transformed]
                ]
        else:
            matrix, _ = cv2.findHomography(src_points, dst_points)

            for feature in features:
                coords = feature["geometry"]["coordinates"][0]
                points = np.array([[p] for p in coords], dtype=np.float32)
                transformed = cv2.perspectiveTransform(points, matrix)
                feature["geometry"]["coordinates"] = [
                    [[float(p[0][0]), float(p[0][1])] for p in transformed]
                ]

    return features
