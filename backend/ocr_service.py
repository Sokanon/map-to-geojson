"""
OCR Service - Text extraction from image regions using Tesseract or Gemini (via OpenRouter)
"""

import os
import cv2
import base64
import numpy as np
from typing import Tuple, List, Optional, Any

try:
    import pytesseract
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False

try:
    from openai import OpenAI
    OPENAI_SDK_AVAILABLE = True
except ImportError:
    OpenAI = None  # type: ignore
    OPENAI_SDK_AVAILABLE = False

# OpenRouter configuration
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")

# Initialize OpenRouter client
_openrouter_client: Optional[Any] = None

def get_openrouter_client() -> Optional[Any]:
    """Get or create OpenRouter client."""
    global _openrouter_client
    if _openrouter_client is None and OPENAI_SDK_AVAILABLE and OPENROUTER_API_KEY:
        _openrouter_client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=OPENROUTER_API_KEY,
        )
    return _openrouter_client


def is_gemini_available() -> bool:
    """Check if Gemini OCR via OpenRouter is available."""
    return bool(OPENAI_SDK_AVAILABLE and OPENROUTER_API_KEY)


def extract_text_with_gemini(
    image: np.ndarray,
    mask: np.ndarray,
    polygon_coords: List[List[float]],
    model: str = "google/gemini-2.0-flash-001"
) -> Tuple[str, float]:
    """
    Extract text from polygon region using Gemini vision via OpenRouter.

    Args:
        image: Full BGR image
        mask: Binary mask of the flood-filled region
        polygon_coords: List of [x, y] coordinates defining the polygon
        model: OpenRouter model ID to use for OCR

    Returns:
        Tuple of (extracted_text, confidence_score)
    """
    client = get_openrouter_client()
    if not client:
        return "", 0.0

    # Find bounding box of the polygon
    points = np.array(polygon_coords, dtype=np.int32)
    x, y, w, h = cv2.boundingRect(points)

    if w < 10 or h < 10:
        return "", 0.0

    # Add padding
    pad = 10
    img_h, img_w = image.shape[:2]
    x1 = max(0, x - pad)
    y1 = max(0, y - pad)
    x2 = min(img_w, x + w + pad)
    y2 = min(img_h, y + h + pad)

    # Crop the region
    region = image[y1:y2, x1:x2].copy()

    if region.size == 0:
        return "", 0.0

    # Scale up small regions for better visibility
    min_dim = 100
    scale = 1.0
    if w < min_dim or h < min_dim:
        scale = max(min_dim / w, min_dim / h)
        region = cv2.resize(region, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    # Convert to PNG and base64 encode
    success, buffer = cv2.imencode('.png', region)
    if not success:
        return "", 0.0

    base64_image = base64.b64encode(buffer).decode('utf-8')

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Extract the building label or code from this image. Return ONLY the text/label, nothing else. If there's no readable text, return an empty string. Do not add quotes or explanation."
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=50,
            temperature=0,
        )

        text = response.choices[0].message.content.strip()

        # Clean up common artifacts
        text = text.strip('"\'')
        if text.lower() in ['', 'none', 'n/a', 'empty', 'no text']:
            return "", 0.0

        # Gemini doesn't provide confidence, so use 95% for non-empty results
        return text, 95.0

    except Exception as e:
        print(f"Gemini OCR error: {e}")
        return "", 0.0


def preprocess_light(image: np.ndarray) -> np.ndarray:
    """
    Light preprocessing - just scale up for better OCR on small text.
    """
    # Scale up 2x for better OCR on small text
    scaled = cv2.resize(image, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    return scaled


def preprocess_for_ocr(image: np.ndarray, invert: bool = False) -> np.ndarray:
    """
    Heavy preprocessing for difficult cases.
    """
    # Convert to grayscale
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()

    # Scale up 2x for better OCR on small text
    scaled = cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)

    # Apply CLAHE for contrast enhancement
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(scaled)

    # Apply adaptive thresholding (better for varying lighting)
    binary = cv2.adaptiveThreshold(
        enhanced, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 11, 2
    )

    if invert:
        binary = cv2.bitwise_not(binary)

    return binary


def extract_text_from_polygon(
    image: np.ndarray,
    mask: np.ndarray,
    polygon_coords: List[List[float]]
) -> Tuple[str, float]:
    """
    Extract text from inside the polygon region.

    Args:
        image: Full BGR image
        mask: Binary mask of the flood-filled region
        polygon_coords: List of [x, y] coordinates defining the polygon

    Returns:
        Tuple of (extracted_text, confidence_score)
    """
    if not TESSERACT_AVAILABLE:
        return "", 0.0

    # Find bounding box of the polygon
    points = np.array(polygon_coords, dtype=np.int32)
    x, y, w, h = cv2.boundingRect(points)

    if w < 10 or h < 10:
        return "", 0.0

    # Add padding
    pad = 5
    img_h, img_w = image.shape[:2]
    x1 = max(0, x - pad)
    y1 = max(0, y - pad)
    x2 = min(img_w, x + w + pad)
    y2 = min(img_h, y + h + pad)

    # Crop the region
    region = image[y1:y2, x1:x2].copy()
    mask_region = mask[y1:y2, x1:x2].copy()

    if region.size == 0:
        return "", 0.0

    # Create white background and overlay the masked region
    # This isolates just the polygon content
    white_bg = np.ones_like(region) * 255

    # Apply mask - keep polygon content, make rest white
    mask_3ch = cv2.cvtColor(mask_region, cv2.COLOR_GRAY2BGR) if len(region.shape) == 3 else mask_region
    masked = np.where(mask_3ch > 0, region, white_bg)

    # Try multiple OCR approaches and pick best result
    results = []

    # Approach 1: Direct OCR on masked image (light scaling only)
    # This works best for clean, colored regions with text
    scaled_masked = preprocess_light(masked)
    text1, conf1 = run_ocr(scaled_masked, '--psm 7 --oem 3')  # Single line
    if text1:
        results.append((text1, conf1))

    # Approach 2: Direct on masked, block of text mode
    text2, conf2 = run_ocr(scaled_masked, '--psm 6 --oem 3')
    if text2:
        results.append((text2, conf2))

    # Approach 3: Sparse text mode on masked
    text3, conf3 = run_ocr(scaled_masked, '--psm 11 --oem 3')
    if text3:
        results.append((text3, conf3))

    # Approach 4: Heavy preprocessing (for low contrast)
    processed = preprocess_for_ocr(masked, invert=False)
    text4, conf4 = run_ocr(processed, '--psm 7 --oem 3')
    if text4:
        results.append((text4, conf4))

    # Approach 5: Inverted heavy preprocessing
    processed_inv = preprocess_for_ocr(masked, invert=True)
    text5, conf5 = run_ocr(processed_inv, '--psm 7 --oem 3')
    if text5:
        results.append((text5, conf5))

    # Pick result with highest confidence
    if results:
        results.sort(key=lambda x: x[1], reverse=True)
        return results[0]

    return "", 0.0


def run_ocr(image: np.ndarray, config: str) -> Tuple[str, float]:
    """Run OCR with given config and return text + confidence."""
    try:
        data = pytesseract.image_to_data(
            image,
            config=config,
            output_type=pytesseract.Output.DICT
        )

        texts = []
        confidences = []

        for i, text in enumerate(data['text']):
            conf = data['conf'][i]
            text = text.strip()
            # Filter out noise - require reasonable confidence and length
            if text and conf > 30 and len(text) >= 1:
                # Skip if it's just punctuation or single special char
                if text.isalnum() or len(text) > 1:
                    texts.append(text)
                    confidences.append(float(conf))

        if texts:
            combined_text = ' '.join(texts)
            avg_confidence = sum(confidences) / len(confidences)
            return combined_text, avg_confidence

        return "", 0.0

    except Exception as e:
        print(f"OCR error: {e}")
        return "", 0.0


def extract_text_from_region(
    image: np.ndarray,
    bbox: dict,
    padding: int = 10
) -> Tuple[str, float]:
    """
    Extract text from a bounding box region of the image.
    Legacy function - prefer extract_text_from_polygon.
    """
    if not TESSERACT_AVAILABLE:
        return "", 0.0

    h, w = image.shape[:2]

    x1 = max(0, bbox["x"] - padding)
    y1 = max(0, bbox["y"] - padding)
    x2 = min(w, bbox["x"] + bbox["width"] + padding)
    y2 = min(h, bbox["y"] + bbox["height"] + padding)

    if x2 <= x1 or y2 <= y1:
        return "", 0.0

    region = image[y1:y2, x1:x2]

    if region.size == 0:
        return "", 0.0

    processed = preprocess_for_ocr(region)
    return run_ocr(processed, '--psm 6 --oem 3')


def is_tesseract_available() -> bool:
    """Check if Tesseract is available."""
    if not TESSERACT_AVAILABLE:
        return False

    try:
        pytesseract.get_tesseract_version()
        return True
    except Exception:
        return False
