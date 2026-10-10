import difflib
import json
from datetime import datetime
from typing import Dict, Any, List, Tuple
from sqlalchemy.orm import Session
from backend.app.models.db_models import Report, AuditTrail

class ReviewWorkflowManager:
    """
    Stage F: Clinician Review & Audit Workflow.
    Manages acceptance, revisions, differential text auditing, and electronic sign-offs.
    """

    @staticmethod
    def compute_text_diff(ai_text: str, clinician_text: str) -> Dict[str, Any]:
        """
        Computes detailed word and line-level diffs between AI draft and clinician version.
        """
        ai_words = ai_text.split()
        clinician_words = clinician_text.split()
        
        matcher = difflib.SequenceMatcher(None, ai_words, clinician_words)
        similarity_ratio = round(matcher.ratio(), 4)
        
        diff_chunks = []
        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == 'equal':
                diff_chunks.append({"type": "equal", "text": " ".join(ai_words[i1:i2])})
            elif tag == 'replace':
                diff_chunks.append({
                    "type": "replaced",
                    "original": " ".join(ai_words[i1:i2]),
                    "revised": " ".join(clinician_words[j1:j2])
                })
            elif tag == 'delete':
                diff_chunks.append({"type": "deleted", "text": " ".join(ai_words[i1:i2])})
            elif tag == 'insert':
                diff_chunks.append({"type": "inserted", "text": " ".join(clinician_words[j1:j2])})

        return {
            "similarity_ratio": similarity_ratio,
            "has_modifications": similarity_ratio < 0.999,
            "word_count_ai": len(ai_words),
            "word_count_clinician": len(clinician_words),
            "diff_chunks": diff_chunks
        }

    @classmethod
    def apply_clinician_edits(
        cls,
        db: Session,
        report: Report,
        revised_findings: str,
        revised_impression: str,
        clinician_id: str,
        notes: str = ""
    ) -> Report:
        """
        Saves clinician modifications, generates diff summary, and logs audit trail.
        """
        prev_state = {
            "status": report.status,
            "findings": report.findings_clinician or report.findings_ai,
            "impression": report.impression_clinician or report.impression_ai
        }

        # Calculate diffs
        findings_diff = cls.compute_text_diff(report.findings_ai, revised_findings)
        impression_diff = cls.compute_text_diff(report.impression_ai, revised_impression)

        diff_summary = {
            "findings_diff": findings_diff,
            "impression_diff": impression_diff,
            "is_modified": findings_diff["has_modifications"] or impression_diff["has_modifications"]
        }

        report.findings_clinician = revised_findings
        report.impression_clinician = revised_impression
        report.is_clinician_modified = diff_summary["is_modified"]
        report.diff_summary_json = json.dumps(diff_summary)
        report.clinician_id = clinician_id
        report.status = "IN_REVIEW"
        report.updated_at = datetime.utcnow()

        # Append to audit trail
        audit = AuditTrail(
            report_id=report.id,
            action="EDITED_SECTION",
            actor=clinician_id,
            timestamp=datetime.utcnow(),
            previous_state_json=json.dumps(prev_state),
            new_state_json=json.dumps({
                "status": report.status,
                "findings": revised_findings,
                "impression": revised_impression,
                "diff_summary": diff_summary
            }),
            notes=notes or "Clinician edited report findings and/or impression."
        )
        db.add(audit)
        db.commit()
        db.refresh(report)
        return report

    @classmethod
    def sign_off_report(
        cls,
        db: Session,
        report: Report,
        clinician_id: str
    ) -> Report:
        """Finalizes and stamps electronic signature on radiology report."""
        report.status = "SIGNED_OFF"
        report.signed_at = datetime.utcnow()
        report.clinician_id = clinician_id
        report.updated_at = datetime.utcnow()

        audit = AuditTrail(
            report_id=report.id,
            action="SIGNED_OFF",
            actor=clinician_id,
            timestamp=datetime.utcnow(),
            notes="Authorized electronic signature appended. Report finalized for clinical record."
        )
        db.add(audit)
        db.commit()
        db.refresh(report)
        return report
