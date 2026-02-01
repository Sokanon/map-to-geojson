"""Test OCR functionality on sample map."""
import sys
sys.path.insert(0, '/home/so/bta/map-to-geojson/backend')

import cv2
import numpy as np
from magic_wand import magic_wand_select, mask_to_polygon, refine_mask
from ocr_service import extract_text_from_polygon, is_tesseract_available

# Load the sample map
img = cv2.imread('/home/so/bta/map-to-geojson/samples/map.png')
print(f'Image loaded: {img.shape}')
print(f'Image dimensions: {img.shape[1]}x{img.shape[0]} (WxH)')
print(f'Tesseract available: {is_tesseract_available()}')

# Try a few positions to find colored regions
test_points = [
    (img.shape[1] // 4, img.shape[0] // 4),  # top-left quadrant
    (img.shape[1] // 2, img.shape[0] // 2),  # center
    (3 * img.shape[1] // 4, img.shape[0] // 4),  # top-right quadrant
    (img.shape[1] // 4, 3 * img.shape[0] // 4),  # bottom-left quadrant
]

for i, (x, y) in enumerate(test_points):
    print(f'\n--- Test {i+1}: position ({x}, {y}) ---')

    # Get pixel color at this position
    pixel = img[y, x]
    print(f'Pixel BGR: {pixel}')

    try:
        # Test magic wand
        mask, bbox = magic_wand_select(img, x, y, tolerance=32)
        non_zero = np.count_nonzero(mask)
        print(f'Mask non-zero pixels: {non_zero}')
        print(f'Bbox: {bbox}')

        if non_zero < 100:
            print('Skipping - region too small')
            continue

        # Refine mask
        refined = refine_mask(mask)

        # Get polygon
        result = mask_to_polygon(refined, simplify_tolerance=2.0)
        if result:
            print(f'Polygon vertices: {len(result["polygon"][0])}')
            print(f'Area: {result["area"]:.0f}')

            # Try OCR
            polygon_coords = result['polygon'][0][:-1]
            text, conf = extract_text_from_polygon(img, refined, polygon_coords)
            print(f'OCR result: "{text}" (confidence: {conf:.1f})')
        else:
            print('No polygon found')
    except Exception as e:
        print(f'Error: {e}')

# Also let's look at what colors are in the image
print('\n--- Image color analysis ---')
# Sample the image at various points
unique_colors = set()
for y in range(0, img.shape[0], 50):
    for x in range(0, img.shape[1], 50):
        color = tuple(img[y, x])
        unique_colors.add(color)

print(f'Sampled {len(unique_colors)} unique colors')

# Find non-white/gray regions (likely building colors)
building_colors = []
for color in unique_colors:
    # Skip near-white and near-black
    if all(c > 200 for c in color) or all(c < 50 for c in color):
        continue
    # Skip near-gray (all channels similar)
    if max(color) - min(color) < 30:
        continue
    building_colors.append(color)

print(f'Potential building colors: {len(building_colors)}')
for c in building_colors[:10]:
    print(f'  BGR: {c}')
