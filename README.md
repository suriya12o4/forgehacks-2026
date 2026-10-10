# RadiantAI

RadiantAI is a research-focused radiology AI workstation for chest X-ray analysis. It combines image validation, multi-label abnormality classification, explainability heatmaps, clinical context integration, and structured report generation in a single workflow designed for radiology review.

The application is built as a full-stack prototype with a FastAPI backend and a React + TypeScript frontend. It supports both synthetic demo studies and real uploaded chest radiograph images, making it suitable for experimentation, demonstration, and iterative evaluation.

## Why this project exists

Medical imaging AI is most useful when it fits into a clinician-facing workflow. This project aims to simulate that workflow by connecting:

- image upload and validation,
- AI-assisted abnormality detection,
- heatmap-based explainability,
- contextualized report drafting,
- and clinician review/edit workflows.

The goal is not to replace radiologists, but to provide a structured, explainable AI assistant that can help accelerate review and documentation.

## Core features

- Chest X-ray upload and validation
  - Accepts common image inputs such as PNG/JPG and DICOM-like studies
  - Validates whether the image is a clinically plausible chest radiograph
  - Stores original and processed artifacts for downstream review

- Multi-label abnormality classification
  - Uses a chest radiograph taxonomy covering common findings such as atelectasis, cardiomegaly, consolidation, edema, pleural effusion, pneumonia, pneumothorax, and more
  - Produces severity-aware predictions with threshold-based decisioning

- Explainability with heatmaps
  - Generates Grad-CAM-style overlays to highlight regions contributing to abnormality predictions
  - Helps radiologists see where the model is focusing its attention

- Clinical context integration
  - Incorporates patient age, sex, indication, prior study reference, and clinical history into the report-generation workflow

- Structured report generation
  - Drafts findings and impression sections from AI predictions and available patient data
  - Allows clinician edits and sign-off

- Review workflow management
  - Tracks report status and supports clinician modifications for approval workflows

- Evaluation dashboard
  - Displays benchmark metrics for model performance and report quality comparisons

## Architecture overview

The project follows a modular pipeline pattern:

1. Stage A — Ingestion and validation
   - Uploads images
   - Checks file validity and converts/normalizes image data

2. Stage B — Classification
   - Runs chest radiograph abnormality detection

3. Stage C — Explainability
   - Produces heatmap overlays tied to model predictions

4. Stage D — Clinical context integration
   - Adds patient and study context before report drafting

5. Stage E — Report generation
   - Synthesizes findings and impression text

6. Stage F — Review workflow
   - Supports review, revision, and sign-off before finalization

## Tech stack

### Backend
- Python
- FastAPI
- SQLAlchemy
- SQLite (default local database)
- PyTorch / Torchvision
- OpenCV
- Pillow
- Pydantic

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS

## Repository structure

```text
Forgehacks/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── main.py
│   │   ├── seed_data.py
│   │   ├── dataset/
│   │   ├── evaluation/
│   │   ├── models/
│   │   └── pipeline/
│   └── tests/
├── data/
│   ├── heatmaps/
│   ├── processed/
│   ├── synthetic/
│   └── uploads/
├── frontend/
│   ├── src/
│   ├── package.json
│   ├── vite.config.ts
│   └── README.md
├── requirements.txt
├── .gitignore
└── README.md
```

## Prerequisites

Before running the app, ensure you have:

- Python 3.10+
- Node.js 18+
- npm
- A terminal environment with internet access for installing dependencies

## Getting started

### 1. Clone the repository

```bash
git clone <repository-url>
cd Forgehacks
```

### 2. Set up the Python backend

```bash
python -m venv .venv
source .venv/bin/activate   # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Set up the frontend

```bash
cd frontend
npm install
```

## Run the application

### Start the backend

From the project root:

```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

The backend will expose the API at:

- http://localhost:8000
- Health check: http://localhost:8000/api/health

### Start the frontend

In a separate terminal:

```bash
cd frontend
npm run dev
```

The frontend will typically run on:

- http://localhost:5173

## Demo workflow

On first startup, the backend seeds a set of realistic synthetic chest radiology cases into the local database. This allows the app to demonstrate a complete workflow without requiring external uploads.

A typical flow is:

1. Open the application in the browser
2. Select a study from the archive or workstation
3. Upload a chest image or use the seeded demo cases
4. Run AI inference
5. Review predicted findings and heatmaps
6. Generate a report draft
7. Edit findings or impression text
8. Sign off the final report

## API overview

The backend exposes REST endpoints under `/api` for study management, inference, report generation, and evaluation. Common endpoints include:

- `GET /api/studies` — list studies
- `POST /api/studies` — create a study
- `GET /api/studies/{study_id}` — retrieve study details
- `POST /api/studies/{study_id}/upload` — upload an image
- `POST /api/studies/{study_id}/analyze` — run AI analysis
- `GET /api/studies/{study_id}/heatmaps` — retrieve explanation overlays
- `POST /api/studies/{study_id}/generate-report` — generate a report draft
- `PUT /api/studies/{study_id}/report` — update clinician-edited findings or impression
- `POST /api/studies/{study_id}/report/sign-off` — sign off a report
- `GET /api/evaluation/metrics` — fetch benchmark metrics

## Data and demo assets

The project stores temporary and generated data under the `data/` folder:

- `data/uploads/` — uploaded and processed image files
- `data/heatmaps/` — generated explanation overlays
- `data/processed/` — intermediate processed images
- `data/synthetic/` — synthetic demo image and benchmark assets

## Evaluation and validation

The project includes a benchmark evaluation layer that tracks model performance estimates and report-generation quality metrics. These can be viewed from the evaluation panel in the interface or accessed through the backend evaluation endpoints.

## Notes

This project is intended as a prototype and research tool. It is not a production clinical decision support system and should not be used for patient care without formal validation, regulatory review, and operational controls.

The frontend currently points to a hosted API URL in `frontend/src/api.ts` for the deployed environment. If you are running the backend locally, update the `API_BASE` constant to your local FastAPI server address, such as `http://localhost:8000/api`.

## License

This project is currently distributed without a formal license file. If you plan to reuse or extend it, confirm the licensing terms with the project owner before distribution or deployment.

## Contribution

Contributions are welcome if you are improving:

- model behavior,
- explainability quality,
- user workflow design,
- report generation logic,
- or documentation clarity.

For changes, follow the standard Git workflow and keep the documentation current as the project evolves.
