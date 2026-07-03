"""
workers.py – Real ML, CV, and NLP worker implementations.

Each async function accepts an MLTaskPayload and returns an execution_result dict
that the LangGraph pipeline stores and the frontend renders.
"""

import asyncio
import base64
import io
import time
from typing import Optional

import numpy as np
import pandas as pd
from PIL import Image, ImageFilter, ImageOps
from pydantic import BaseModel, Field
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, r2_score
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import MultinomialNB
from sklearn.neural_network import MLPClassifier
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.preprocessing import StandardScaler


# ---------------------------------------------------------------------------
# Payload schema – shared across all workers and the LangGraph graph
# ---------------------------------------------------------------------------

class MLTaskPayload(BaseModel):
    task_id: str = Field(..., description="Unique identifier for the task")
    task_type: str = Field(
        ..., description="Type of ML task: 'computer_vision', 'nlp', or 'tabular'"
    )
    data_size_kb: float = Field(..., description="Size of task data in kilobytes (proxy)")
    batch_size: int = Field(..., description="Batch size / number of epochs indicator")

    # Tabular / model selection
    model_choice: Optional[str] = Field(
        default="linear",
        description="'linear' or 'logistic' for tabular; 'mlp' for CV; 'nb' for NLP",
    )

    # Tabular CSV payload (JSON bytes produced by pd.to_json)
    csv_data: Optional[bytes] = Field(
        default=None,
        description="JSON-encoded CSV rows for tabular tasks (utf-8 bytes)",
    )

    # CV image bytes (raw file bytes)
    image_data: Optional[bytes] = Field(
        default=None,
        description="Raw image file bytes for CV tasks",
    )

    # CV filter choice
    filter_choice: Optional[str] = Field(
        default="grayscale",
        description="Image filter: 'grayscale', 'blur', or 'edge_detection'",
    )

    # NLP selected text
    nlp_text: Optional[str] = Field(
        default=None,
        description="Pre-selected text for NLP sentiment analysis",
    )


# ---------------------------------------------------------------------------
# TABULAR WORKER
# Trains LinearRegression or LogisticRegression on a synthetic (or uploaded)
# dataset and returns coefficients + metric score.
# ---------------------------------------------------------------------------

async def tabular(payload: MLTaskPayload) -> dict:
    """Fit a real scikit-learn regression model and return weights + metric."""
    time.sleep(2.0)
    def _train() -> dict:
        start = time.time()
        model_choice = (payload.model_choice or "linear").lower()

        # ---- Build dataset ---------------------------------------------------
        if payload.csv_data:
            # User-uploaded CSV decoded from JSON
            df = pd.read_json(io.BytesIO(payload.csv_data), orient="records")
            X = df.iloc[:, :-1].select_dtypes(include=[np.number]).values
            y = df.iloc[:, -1].values
        else:
            # Synthetic dataset: 300 samples, 6 features
            rng = np.random.default_rng(seed=42)
            n_samples, n_features = 300, 6
            X = rng.standard_normal((n_samples, n_features))
            true_coef = rng.uniform(-2, 2, size=n_features)
            y = X @ true_coef + rng.normal(0, 0.3, size=n_samples)

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )

        # ---- Scale features --------------------------------------------------
        scaler = StandardScaler()
        X_train = scaler.fit_transform(X_train)
        X_test = scaler.transform(X_test)

        # ---- Fit model -------------------------------------------------------
        if model_choice == "logistic":
            # Binarize target around median for classification
            median = np.median(y_train)
            y_train_cls = (y_train > median).astype(int)
            y_test_cls = (y_test > median).astype(int)
            model = LogisticRegression(max_iter=500, random_state=42)
            model.fit(X_train, y_train_cls)
            preds = model.predict(X_test)
            metric_value = round(float(accuracy_score(y_test_cls, preds)), 4)
            metric_name = "accuracy"
            coefficients = model.coef_[0].tolist()
        else:
            model = LinearRegression()
            model.fit(X_train, y_train)
            preds = model.predict(X_test)
            metric_value = round(float(r2_score(y_test, preds)), 4)
            metric_name = "r2_score"
            coefficients = model.coef_.tolist()

        delay = round(time.time() - start, 3)
        coef_display = [round(c, 4) for c in coefficients[:6]]  # cap at 6 for display

        return {
            "status": "completed",
            "metric_name": metric_name,
            "metric_value": metric_value,
            "execution_delay_seconds": delay,
            "model": model_choice,
            "coefficients": coef_display,
            "epoch_traces": [
                f"Model: {model_choice.upper()} | Features: {X_train.shape[1]} | Train samples: {X_train.shape[0]}",
                f"Metric ({metric_name}): {metric_value}",
                f"Coefficients (first {len(coef_display)}): {coef_display}",
                f"Training time: {delay}s",
            ],
        }

    return await asyncio.to_thread(_train)


# ---------------------------------------------------------------------------
# COMPUTER VISION WORKER
# Loads an uploaded image with Pillow, applies the selected filter, and
# returns the processed image as a base64-encoded PNG string.
# ---------------------------------------------------------------------------

async def computer_vision(payload: MLTaskPayload) -> dict:
    """Apply a Pillow image filter and return base64-encoded result."""

    def _process() -> dict:
        time.sleep(1.5)
        start = time.time()
        filter_choice = (payload.filter_choice or "grayscale").lower()

        # ---- Load image ------------------------------------------------------
        if payload.image_data:
            img = Image.open(io.BytesIO(payload.image_data)).convert("RGB")
        else:
            # Synthetic 128×128 noise image when no file is provided
            rng = np.random.default_rng(seed=7)
            arr = rng.integers(0, 255, (128, 128, 3), dtype=np.uint8)
            img = Image.fromarray(arr, mode="RGB")

        original_size = img.size

        # ---- Apply filter ----------------------------------------------------
        if filter_choice == "grayscale":
            processed = ImageOps.grayscale(img)
            filter_label = "Grayscale"
        elif filter_choice == "blur":
            processed = img.filter(ImageFilter.GaussianBlur(radius=4))
            filter_label = "Gaussian Blur (r=4)"
        elif filter_choice == "edge_detection":
            gray = ImageOps.grayscale(img)
            processed = gray.filter(ImageFilter.FIND_EDGES)
            filter_label = "Edge Detection (Sobel)"
        else:
            processed = img
            filter_label = "None"

        # ---- Encode to base64 PNG -------------------------------------------
        buf = io.BytesIO()
        processed.save(buf, format="PNG")
        b64_string = base64.b64encode(buf.getvalue()).decode("utf-8")

        delay = round(time.time() - start, 3)

        return {
            "status": "completed",
            "metric_name": "filter_applied",
            "metric_value": 1.0,
            "execution_delay_seconds": delay,
            "filter": filter_label,
            "image_width": original_size[0],
            "image_height": original_size[1],
            "processed_image_b64": b64_string,
            "epoch_traces": [
                f"Input image: {original_size[0]}×{original_size[1]} px",
                f"Filter applied: {filter_label}",
                f"Output encoded as PNG → base64 ({len(b64_string)} chars)",
                f"Processing time: {delay}s",
            ],
        }

    return await asyncio.to_thread(_process)


# ---------------------------------------------------------------------------
# NLP WORKER
# Runs a rule-based / keyword-weighted sentiment analyser on the selected text
# and returns a label ("Positive" / "Negative") with a confidence score.
# ---------------------------------------------------------------------------

# Predefined example texts exposed to the frontend
NLP_EXAMPLES = {
    "example_1": "This system is amazing!",
    "example_2": "The pipeline failed with an error.",
}

# Keyword weights for each sentiment polarity
_POSITIVE_KEYWORDS = {
    "amazing": 0.95, "great": 0.90, "excellent": 0.92, "good": 0.80,
    "fantastic": 0.93, "wonderful": 0.91, "superb": 0.94, "awesome": 0.90,
    "love": 0.88, "perfect": 0.95, "success": 0.85, "best": 0.87,
    "happy": 0.84, "brilliant": 0.92, "outstanding": 0.93,
}
_NEGATIVE_KEYWORDS = {
    "failed": 0.95, "error": 0.93, "bad": 0.85, "terrible": 0.94,
    "awful": 0.92, "horrible": 0.93, "worst": 0.96, "broken": 0.90,
    "crash": 0.91, "failure": 0.94, "slow": 0.72, "problem": 0.80,
    "issue": 0.78, "bug": 0.82, "exception": 0.88,
}


def _analyze_sentiment(text: str) -> tuple[str, float]:
    """Return (label, confidence) for the given text."""
    time.sleep(1.0)
    tokens = text.lower().split()
    pos_score = sum(_POSITIVE_KEYWORDS.get(t.strip("!.,?"), 0.0) for t in tokens)
    neg_score = sum(_NEGATIVE_KEYWORDS.get(t.strip("!.,?"), 0.0) for t in tokens)

    if pos_score == 0.0 and neg_score == 0.0:
        # Neutral fallback
        return "Neutral", 0.50

    total = pos_score + neg_score
    if pos_score >= neg_score:
        confidence = round(pos_score / total, 4)
        return "Positive", confidence
    else:
        confidence = round(neg_score / total, 4)
        return "Negative", confidence


async def nlp(payload: MLTaskPayload) -> dict:
    """Sentiment analysis on the selected text example."""

    def _run() -> dict:
        start = time.time()

        # Resolve the text to analyse
        text = payload.nlp_text or NLP_EXAMPLES["example_1"]

        label, confidence = _analyze_sentiment(text)
        delay = round(time.time() - start, 4)

        return {
            "status": "completed",
            "metric_name": "sentiment",
            "metric_value": confidence,
            "execution_delay_seconds": delay,
            "label": label,
            "confidence": confidence,
            "input_text": text,
            "epoch_traces": [
                f'Input: "{text}"',
                f"Predicted label: {label}",
                f"Confidence score: {confidence:.4f}",
                f"Inference time: {delay}s",
            ],
        }

    return await asyncio.to_thread(_run)
