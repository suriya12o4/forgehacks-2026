import io
import os
import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

try:
    import pydicom
    from pydicom.dataset import FileDataset, FileMetaDataset
    from pydicom.uid import ExplicitVRLittleEndian, generate_uid
    HAS_PYDICOM = True
except ImportError:
    HAS_PYDICOM = False

from backend.app.config import DATA_DIR, SYNTHETIC_DIR, CHEST_XRAY_LABELS

logger = logging.getLogger("radiant_ai.dataset")

class DatasetAdapter:
    """
    Dataset adapter for medical imaging research benchmarks.
    Supports CheXpert, MIMIC-CXR, VinDr-CXR manifests with strict patient-level splitting.
    """

    @staticmethod
    def validate_patient_splits(
        records: List[Dict[str, Any]],
        train_ratio: float = 0.7,
        val_ratio: float = 0.15,
        test_ratio: float = 0.15,
        random_seed: int = 42
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Partitions records strictly by unique patient_id to prevent data leakage.
        Verifies that no patient appears in both train and validation or test splits.
        """
        import random
        random.seed(random_seed)

        patient_map: Dict[str, List[Dict[str, Any]]] = {}
        for r in records:
            pid = str(r.get("patient_id", "unknown"))
            if pid not in patient_map:
                patient_map[pid] = []
            patient_map[pid].append(r)

        unique_pids = list(patient_map.keys())
        random.shuffle(unique_pids)

        n_total = len(unique_pids)
        n_train = int(n_total * train_ratio)
        n_val = int(n_total * val_ratio)

        train_pids = set(unique_pids[:n_train])
        val_pids = set(unique_pids[n_train:n_train + n_val])
        test_pids = set(unique_pids[n_train + n_val:])

        # Assert zero patient intersection
        assert len(train_pids.intersection(val_pids)) == 0, "Patient leakage detected between train and val!"
        assert len(train_pids.intersection(test_pids)) == 0, "Patient leakage detected between train and test!"
        assert len(val_pids.intersection(test_pids)) == 0, "Patient leakage detected between val and test!"

        split_results = {
            "train": [r for pid in train_pids for r in patient_map[pid]],
            "val": [r for pid in val_pids for r in patient_map[pid]],
            "test": [r for pid in test_pids for r in patient_map[pid]],
        }

        logger.info(
            f"Patient split verified: {len(train_pids)} train patients, "
            f"{len(val_pids)} val patients, {len(test_pids)} test patients."
        )
        return split_results


def generate_synthetic_chest_xray(
    finding_type: str,
    output_path: Path,
    width: int = 512,
    height: int = 512
) -> Tuple[Path, Optional[Path]]:
    """
    Synthesizes an anatomically realistic chest radiograph simulation with
    rib cage contours, lung fields, mediastinum, diaphragmatic domes,
    and simulated pathology manifestations.
    Outputs both PNG and valid DICOM format.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # 1. Base dark background
    img = Image.new("L", (width, height), color=18)
    draw = ImageDraw.Draw(img)

    # 2. Thoracic cavity contours (soft grayscale tissue)
    # Outer body ellipse
    draw.ellipse([width * 0.08, height * 0.05, width * 0.92, height * 0.95], fill=45)
    
    # Left and right lung fields (radiolucent = darker air)
    # Right lung (anatomical right = viewer's left)
    draw.ellipse([width * 0.16, height * 0.15, width * 0.44, height * 0.82], fill=14)
    # Left lung (anatomical left = viewer's right)
    draw.ellipse([width * 0.56, height * 0.15, width * 0.84, height * 0.82], fill=14)

    # 3. Mediastinum & Cardiac Silhouette
    heart_scale = 1.35 if finding_type == "Cardiomegaly" else 1.0
    # Central spine & mediastinum
    draw.rectangle([width * 0.42, height * 0.10, width * 0.58, height * 0.88], fill=65)
    # Cardiac apex (displaces into anatomical left)
    draw.ellipse(
        [width * 0.38, height * 0.45, width * (0.52 + 0.18 * heart_scale), height * 0.80],
        fill=80
    )
    # Aortic knob
    draw.ellipse([width * 0.44, height * 0.28, width * 0.54, height * 0.38], fill=70)

    # 4. Rib cage arcs (radiopaque bone densities)
    for y_rib in range(int(height * 0.22), int(height * 0.78), int(height * 0.08)):
        # Right ribs
        draw.arc([width * 0.14, y_rib - 20, width * 0.48, y_rib + 35], start=180, end=360, fill=65, width=5)
        # Left ribs
        draw.arc([width * 0.52, y_rib - 20, width * 0.86, y_rib + 35], start=180, end=360, fill=65, width=5)

    # 5. Clavicles
    draw.line([width * 0.15, height * 0.18, width * 0.46, height * 0.23], fill=95, width=8)
    draw.line([width * 0.85, height * 0.18, width * 0.54, height * 0.23], fill=95, width=8)

    # 6. Specific Pathology simulation
    if finding_type in ["Pneumonia", "Consolidation"]:
        # Right lower lobe consolidation / opacity
        for r in range(40, 10, -5):
            draw.ellipse(
                [width * 0.22 - r, height * 0.65 - r, width * 0.36 + r, height * 0.76 + r],
                fill=90 + r
            )
    elif finding_type == "Pleural Effusion":
        # Blunting of right costophrenic angle meniscus
        draw.polygon(
            [
                (int(width * 0.16), int(height * 0.82)),
                (int(width * 0.35), int(height * 0.82)),
                (int(width * 0.16), int(height * 0.68)),
            ],
            fill=110
        )
    elif finding_type == "Pneumothorax":
        # Apical visceral pleural line and peripheral hyperlucency on left lung
        draw.line([width * 0.74, height * 0.18, width * 0.76, height * 0.42], fill=120, width=3)
        draw.rectangle([width * 0.77, height * 0.16, width * 0.85, height * 0.45], fill=4)
    elif finding_type == "Edema":
        # Perihilar bat-wing haziness
        draw.ellipse([width * 0.32, height * 0.38, width * 0.68, height * 0.62], fill=55)

    # 7. Apply subtle gaussian blur to mimic analog X-ray scattering
    img = img.filter(ImageFilter.GaussianBlur(radius=1.8))
    
    # Save standard PNG
    png_path = output_path.with_suffix(".png")
    img.save(png_path, format="PNG")

    # Save authentic DICOM format if pydicom is available
    dcm_path = output_path.with_suffix(".dcm")
    if HAS_PYDICOM:
        try:
            arr = np.array(img).astype(np.uint16) * 16 # Scale to 12-bit
            file_meta = FileMetaDataset()
            file_meta.MediaStorageSOPClassUID = '1.2.840.10008.5.1.4.1.1.1' # CR Image Storage
            file_meta.MediaStorageSOPInstanceUID = generate_uid()
            file_meta.TransferSyntaxUID = ExplicitVRLittleEndian

            ds = FileDataset(str(dcm_path), {}, file_meta=file_meta, preamble=b"\0" * 128)
            ds.Modality = 'CR'
            ds.PatientName = 'ANONYMOUS^RESEARCH'
            ds.PatientID = 'ANON-SYNTH-99'
            ds.StudyDescription = f'Chest AP/PA - Simulated {finding_type}'
            ds.SeriesDescription = 'Chest Radiograph'
            ds.ViewPosition = 'PA'
            ds.Rows = height
            ds.Columns = width
            ds.BitsAllocated = 16
            ds.BitsStored = 12
            ds.HighBit = 11
            ds.PixelRepresentation = 0
            ds.PhotometricInterpretation = 'MONOCHROME2'
            ds.SamplesPerPixel = 1
            ds.PixelSpacing = [0.143, 0.143]
            ds.PixelData = arr.tobytes()
            ds.save_as(str(dcm_path))
        except Exception as e:
            logger.warning(f"Could not write synthetic DICOM: {e}")
            dcm_path = None
    else:
        dcm_path = None

    return png_path, dcm_path
