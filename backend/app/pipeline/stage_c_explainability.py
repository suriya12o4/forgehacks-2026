import logging
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from PIL import Image
import numpy as np
import cv2
import torch
import torch.nn.functional as F

from backend.app.config import HEATMAP_DIR
from backend.app.pipeline.stage_b_classification import get_classifier

logger = logging.getLogger("radiant_ai.explainability")

DISCLAIMER_TEXT = (
    "Heatmaps are approximate model feature attribution explanations based on gradient activation maps "
    "and do not establish that a clinical abnormality is definitively present or clinically validated."
)

class GradCAMExplainer:
    """
    Grad-CAM: Visual Explanations from Deep Networks (Selvaraju et al., ICCV 2017)
    Targets final convolutional layer of DenseNet-121 features.
    """

    def __init__(self):
        self.classifier = get_classifier()
        self.model = self.classifier.model
        self.device = self.classifier.device
        self.target_layer = self.model.features.denseblock4.denselayer16.conv2
        
        self.gradients = None
        self.activations = None
        
        # Register hooks
        self._register_hooks()

    def _register_hooks(self):
        def forward_hook(module, input, output):
            self.activations = output.detach()

        def backward_hook(module, grad_in, grad_out):
            self.gradients = grad_out[0].detach()

        self.target_layer.register_forward_hook(forward_hook)
        self.target_layer.register_full_backward_hook(backward_hook)

    def generate_heatmap(
        self,
        image_path: Path,
        target_class_idx: int,
        output_dir: Path = HEATMAP_DIR,
        prefix: str = "run"
    ) -> Tuple[Path, Path, Dict[str, Any]]:
        """
        Computes Grad-CAM for target_class_idx.
        Returns: (heatmap_path, overlay_path, metadata)
        """
        output_dir.mkdir(parents=True, exist_ok=True)
        label_name = self.classifier.labels[target_class_idx]
        safe_label = label_name.replace(" ", "_").replace("/", "_")

        # Load original image
        orig_pil = Image.open(image_path).convert("RGB")
        orig_w, orig_h = orig_pil.size
        orig_cv = cv2.cvtColor(np.array(orig_pil), cv2.COLOR_RGB2BGR)

        # Preprocess for model
        input_tensor = self.classifier.transform(orig_pil).unsqueeze(0).to(self.device)
        input_tensor.requires_grad = True

        self.model.zero_grad()
        output_logits = self.model(input_tensor)
        target_score = output_logits[0, target_class_idx]
        
        # Backward pass
        target_score.backward(retain_graph=True)

        if self.gradients is None or self.activations is None:
            raise RuntimeError("Failed to capture gradients or activations for Grad-CAM.")

        # Global average pooling of gradients
        # alpha_k = (1/Z) * sum(gradients)
        pooled_gradients = torch.mean(self.gradients, dim=[0, 2, 3])

        # Weight activations by alpha
        activations = self.activations[0]
        for i in range(activations.size(0)):
            activations[i, :, :] *= pooled_gradients[i]

        # ReLU on weighted sum
        cam = torch.sum(activations, dim=0).cpu().numpy()
        cam = np.maximum(cam, 0) # ReLU

        # Normalize between 0 and 1
        cam_max = np.max(cam)
        if cam_max > 0:
            cam = cam / cam_max
        else:
            cam = np.zeros_like(cam)

        # Resize CAM to match original image dimensions
        cam_resized = cv2.resize(cam, (orig_w, orig_h), interpolation=cv2.INTER_LINEAR)

        # Locate peak intensity and coordinate
        peak_y, peak_x = np.unravel_index(np.argmax(cam_resized), cam_resized.shape)
        peak_intensity = float(np.max(cam_resized))

        # Colorize heatmap with TURBO / JET
        heatmap_uint8 = np.uint8(255 * cam_resized)
        heatmap_color = cv2.applyColorMap(heatmap_uint8, cv2.COLORMAP_TURBO)

        # Generate blended overlay (40% heatmap, 60% original radiograph)
        overlay_cv = cv2.addWeighted(heatmap_color, 0.45, orig_cv, 0.55, 0)

        # Save files
        heatmap_filename = f"{prefix}_{safe_label}_cam.png"
        overlay_filename = f"{prefix}_{safe_label}_overlay.png"
        
        heatmap_path = output_dir / heatmap_filename
        overlay_path = output_dir / overlay_filename

        cv2.imwrite(str(heatmap_path), heatmap_color)
        cv2.imwrite(str(overlay_path), overlay_cv)

        meta = {
            "finding_label": label_name,
            "peak_x": round(float(peak_x) / orig_w, 4), # Normalized [0, 1]
            "peak_y": round(float(peak_y) / orig_h, 4), # Normalized [0, 1]
            "peak_intensity": round(peak_intensity, 4),
            "method": "Grad-CAM (DenseNet-121 layer4.denselayer16)",
            "disclaimer": DISCLAIMER_TEXT
        }

        return heatmap_path, overlay_path, meta


_explainer_instance: Optional[GradCAMExplainer] = None

def get_explainer() -> GradCAMExplainer:
    global _explainer_instance
    if _explainer_instance is None:
        _explainer_instance = GradCAMExplainer()
    return _explainer_instance
