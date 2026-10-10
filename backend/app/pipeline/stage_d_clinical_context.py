import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger("radiant_ai.clinical_context")

class ClinicalContextIntegrator:
    """
    Stage D: Clinical Context Integration.
    Harmonizes patient clinical indication, history, and prior comparisons with AI visual inferences.
    Enforces strict distinction between observed patient history and model inferences.
    """

    @staticmethod
    def evaluate_clinical_concordance(
        indication: str,
        clinical_history: Optional[str],
        positive_findings: List[str]
    ) -> Dict[str, Any]:
        """
        Cross-analyzes structured clinical context against model findings to highlight
        clinical concordance, red flags, or areas requiring focused radiologist scrutiny.
        """
        concordance_notes: List[str] = []
        focused_scrutiny_areas: List[str] = []
        risk_tier = "STANDARD"

        full_text = f"{indication} {clinical_history or ''}".lower()

        # Cardiac / Fluid overload correlation
        has_cardiac_symptoms = any(w in full_text for w in ["dyspnea", "shortness of breath", "chf", "heart failure", "orthopnea", "edema", "chest pain"])
        has_cardiac_findings = any(f in positive_findings for f in ["Cardiomegaly", "Edema", "Pleural Effusion"])

        if has_cardiac_symptoms and has_cardiac_findings:
            matched = [f for f in positive_findings if f in ["Cardiomegaly", "Edema", "Pleural Effusion"]]
            concordance_notes.append(
                f"Clinical symptoms of cardiopulmonary compromise correlate with visual detection of: {', '.join(matched)}."
            )
            risk_tier = "ELEVATED"

        # Infectious / Consolidation correlation
        has_infection_symptoms = any(w in full_text for w in ["fever", "cough", "sputum", "pneumonia", "chills", "leukocytosis"])
        has_consolidation = any(f in positive_findings for f in ["Consolidation", "Pneumonia", "Lung Opacity", "Infiltration"])

        if has_infection_symptoms and has_consolidation:
            matched = [f for f in positive_findings if f in ["Consolidation", "Pneumonia", "Lung Opacity", "Infiltration"]]
            concordance_notes.append(
                f"Febrile respiratory presentation is concordant with visual parenchymal opacification: {', '.join(matched)}."
            )
            risk_tier = "ELEVATED"

        # Trauma / Pneumothorax correlation
        has_trauma_symptoms = any(w in full_text for w in ["trauma", "fall", "mva", "stab", "rib pain", "pleuritic", "biopsy", "line placement"])
        has_pneumo = "Pneumothorax" in positive_findings

        if has_trauma_symptoms or has_pneumo:
            if has_pneumo:
                focused_scrutiny_areas.append("Urgent review: Model identified feature attribution consistent with Pneumothorax.")
                risk_tier = "CRITICAL"
            elif has_trauma_symptoms:
                focused_scrutiny_areas.append("Trauma history noted: Scrutinize apical pleural line and thoracic cage despite negative AI screen.")

        # If patient has acute symptoms but AI detects "No Finding"
        if ("No Finding" in positive_findings or len(positive_findings) == 0) and (has_cardiac_symptoms or has_infection_symptoms):
            focused_scrutiny_areas.append(
                "Symptomatic patient with negative/low-score AI visual screen. Consider early-stage pathology or non-radiographic etiologies (e.g., CT pulmonary angiogram if PE suspected)."
            )

        return {
            "risk_tier": risk_tier,
            "concordance_notes": concordance_notes,
            "focused_scrutiny_areas": focused_scrutiny_areas,
            "clinical_indication_verbatim": indication,
            "clinical_history_verbatim": clinical_history or "None provided",
            "validation_passed": True
        }
