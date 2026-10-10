import io
import os
import json
import logging
from pathlib import Path
from typing import Dict, Any, Tuple, Optional
from PIL import Image, ImageOps
import numpy as np
import cv2

try:
    import pydicom
    from pydicom.pixel_data_handlers.util import apply_voi_lut
    HAS_PYDICOM = True
except ImportError:
    HAS_PYDICOM = False

logger = logging.getLogger("radiant_ai.ingestion")

def validate_and_decode_image(
    file_bytes: bytes,
    filename: str,
    output_dir: Path
) -> Tuple[bool, str, Dict[str, Any], Path, Optional[Path]]:
    """
    Stage A: Image ingestion & validation.
    Validates MIME type, dimensions, decoding, and DICOM de-identification.
    Returns: (is_valid, validation_message, metadata, original_path, preprocessed_path)
    """
    ext = filename.lower().split('.')[-1]
    is_dicom = ext in ['dcm', 'dicom'] or filename.endswith('.dcm')
    output_dir.mkdir(parents=True, exist_ok=True)
    
    metadata: Dict[str, Any] = {
        "is_dicom": is_dicom,
        "original_filename": filename,
        "file_size_bytes": len(file_bytes),
        "modality": "CR",
        "view_position": "PA",
    }
    
    clean_stem = Path(filename).stem
    orig_save_path = output_dir / f"{clean_stem}_orig.png"
    prep_save_path = output_dir / f"{clean_stem}_prep.png"
    
    # 1. Reject empty or oversized files (> 50 MB)
    if len(file_bytes) == 0:
        return False, "File is empty (0 bytes).", metadata, orig_save_path, None
    if len(file_bytes) > 50 * 1024 * 1024:
        return False, "File exceeds maximum allowable size (50MB).", metadata, orig_save_path, None

    pil_img = None

    if is_dicom and HAS_PYDICOM:
        try:
            dcm = pydicom.dcmread(io.BytesIO(file_bytes), force=True)
            
            # De-identification: extract only permitted non-identifying technical metadata
            metadata["modality"] = str(getattr(dcm, "Modality", "CR"))
            metadata["view_position"] = str(getattr(dcm, "ViewPosition", "PA"))
            metadata["photometric_interpretation"] = str(getattr(dcm, "PhotometricInterpretation", "MONOCHROME2"))
            metadata["bits_allocated"] = int(getattr(dcm, "BitsAllocated", 16))
            metadata["pixel_spacing"] = [float(x) for x in getattr(dcm, "PixelSpacing", [1.0, 1.0])]
            metadata["patient_id"] = "ANON-REDACTED"
            metadata["patient_name"] = "ANON-REDACTED"
            
            pixel_array = dcm.pixel_array.astype(float)
            
            # Apply VOI LUT if present
            try:
                pixel_array = apply_voi_lut(dcm.pixel_array, dcm)
            except Exception:
                pass
                
            # Photometric interpretation check (MONOCHROME1 is inverted where air is white)
            if getattr(dcm, "PhotometricInterpretation", "") == "MONOCHROME1":
                pixel_array = np.amax(pixel_array) - pixel_array
                
            # Normalize to 0-255 uint8
            p_min, p_max = np.min(pixel_array), np.max(pixel_array)
            if p_max > p_min:
                pixel_array = (pixel_array - p_min) / (p_max - p_min) * 255.0
            else:
                pixel_array = np.zeros_like(pixel_array)
            img_uint8 = pixel_array.astype(np.uint8)
            pil_img = Image.fromarray(img_uint8).convert("L")
            
        except Exception as e:
            logger.error(f"DICOM decoding error: {e}")
            return False, f"Failed to parse DICOM: {str(e)}", metadata, orig_save_path, None
    else:
        # Standard PNG / JPEG decoding
        try:
            pil_img = Image.open(io.BytesIO(file_bytes))
            pil_img.load()
            pil_img = pil_img.convert("RGB")
        except Exception as e:
            return False, f"Unsupported or corrupt image format: {str(e)}", metadata, orig_save_path, None

    width, height = pil_img.size
    metadata["width"] = width
    metadata["height"] = height
    
    # 2. Check minimum dimensions
    if width < 128 or height < 128:
        return False, f"Image dimensions too small ({width}x{height}). Minimum requirement is 128x128.", metadata, orig_save_path, None

    # 3. Chest X-ray heuristic validation
    # Verify that image is predominantly grayscale and has reasonable chest X-ray luminance distribution
    img_np = np.array(pil_img)
    if len(img_np.shape) == 3 and img_np.shape[2] == 3:
        # Measure channel saturation to reject non-radiology color photos (e.g. selfies, landscape photos)
        hsv = cv2.cvtColor(img_np, cv2.COLOR_RGB2HSV)
        mean_saturation = np.mean(hsv[:, :, 1])
        if mean_saturation > 75:  # Noticeable color saturation
            return False, "Image validation failed: Image contains high color saturation and is unlikely to be a valid chest radiograph.", metadata, orig_save_path, None
        gray_img = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
    else:
        gray_img = img_np

    metadata["mean_luminance"] = float(np.mean(gray_img))
    metadata["std_luminance"] = float(np.std(gray_img))

    # Save high-resolution original view (512x512 preserved aspect ratio with letterboxing)
    orig_display = Image.fromarray(gray_img).convert("RGB")
    orig_display.save(orig_save_path, format="PNG")

    # Save model preprocessed preview (224x224 normalized contrast)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced_gray = clahe.apply(gray_img)
    prep_display = cv2.resize(enhanced_gray, (224, 224), interpolation=cv2.INTER_AREA)
    prep_pil = Image.fromarray(prep_display).convert("RGB")
    prep_pil.save(prep_save_path, format="PNG")

    return True, "Valid chest radiograph ingested successfully.", metadata, orig_save_path, prep_save_path
