"""
Audio ML Service
================
Pipeline:
  1. Load audio bytes → librosa array
  2. Extract features: MFCCs (40), chroma (12), ZCR, RMS, spectral centroid
  3. Classify: scream / distress / normal
  4. Return risk score 0–255

Model strategy:
  - Ships with a lightweight rule-based + trained RandomForest fallback
  - If models/audio/classifier.joblib exists → load it
  - Otherwise fall back to heuristic feature scoring
"""

from __future__ import annotations

import io
import logging
import os
from dataclasses import dataclass
from typing import Literal

import numpy as np

logger = logging.getLogger(__name__)

AudioClass = Literal["scream", "distress", "normal"]

MODEL_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "models", "audio", "classifier.joblib"
)

# Risk score mapping per class
CLASS_SCORE_MAP: dict[AudioClass, tuple[int, int]] = {
    "scream":   (210, 255),
    "distress": (130, 200),
    "normal":   (0,   40),
}


@dataclass
class AudioResult:
    audio_class: AudioClass
    confidence: float          # 0.0–1.0
    risk_score: int            # 0–255
    features: dict             # for debugging / logging


class AudioMLService:
    def __init__(self):
        self._model = self._load_model()

    # ── Model loading ─────────────────────────────────────────────────────

    def _load_model(self):
        if os.path.exists(MODEL_PATH):
            try:
                import joblib
                model = joblib.load(MODEL_PATH)
                logger.info("✅ Loaded trained audio classifier from %s", MODEL_PATH)
                return model
            except Exception as e:
                logger.warning("Could not load model (%s), using heuristic fallback", e)
        logger.info("ℹ️  Using heuristic audio classifier")
        return None

    # ── Public API ────────────────────────────────────────────────────────

    async def classify(self, audio_bytes: bytes, sample_rate: int = 22050) -> AudioResult:
        """Main classify entry point. Accepts raw WAV/MP3 bytes."""
        try:
            import librosa

            y, sr = librosa.load(io.BytesIO(audio_bytes), sr=sample_rate, mono=True)
            features = self._extract_features(y, sr)

            if self._model is not None:
                return self._model_predict(features)
            return self._heuristic_predict(features)

        except ImportError:
            logger.error("librosa not installed — returning neutral score")
            return AudioResult(
                audio_class="normal",
                confidence=0.5,
                risk_score=0,
                features={},
            )
        except Exception as e:
            logger.error("Audio classification error: %s", e)
            return AudioResult(
                audio_class="normal",
                confidence=0.0,
                risk_score=0,
                features={"error": str(e)},
            )

    # ── Feature extraction ────────────────────────────────────────────────

    def _extract_features(self, y: np.ndarray, sr: int) -> dict:
        import librosa

        # MFCCs — captures timbral texture
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=40)
        mfcc_mean = mfcc.mean(axis=1)
        mfcc_std  = mfcc.std(axis=1)

        # Chroma — pitch class distribution
        chroma = librosa.feature.chroma_stft(y=y, sr=sr)
        chroma_mean = chroma.mean(axis=1)

        # Zero-crossing rate — voiced/unvoiced, noise
        zcr = librosa.feature.zero_crossing_rate(y)
        zcr_mean = float(zcr.mean())

        # RMS energy — loudness
        rms = librosa.feature.rms(y=y)
        rms_mean = float(rms.mean())
        rms_max  = float(rms.max())

        # Spectral centroid — brightness
        centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
        centroid_mean = float(centroid.mean())

        # Spectral rolloff — energy distribution
        rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)
        rolloff_mean = float(rolloff.mean())

        # Spectral bandwidth
        bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)
        bandwidth_mean = float(bandwidth.mean())

        # Pitch via YIN
        try:
            f0 = librosa.yin(y, fmin=50, fmax=4000, sr=sr)
            pitch_mean = float(np.nanmean(f0[f0 > 0])) if np.any(f0 > 0) else 0.0
        except Exception:
            pitch_mean = 0.0

        return {
            "mfcc_mean": mfcc_mean.tolist(),
            "mfcc_std":  mfcc_std.tolist(),
            "chroma_mean": chroma_mean.tolist(),
            "zcr_mean": zcr_mean,
            "rms_mean": rms_mean,
            "rms_max":  rms_max,
            "centroid_mean": centroid_mean,
            "rolloff_mean":  rolloff_mean,
            "bandwidth_mean": bandwidth_mean,
            "pitch_mean": pitch_mean,
        }

    # ── Heuristic classifier ──────────────────────────────────────────────

    def _heuristic_predict(self, features: dict) -> AudioResult:
        """
        Rule-based classifier derived from acoustic signatures:
        - Screams: high RMS, high centroid, high pitch, high ZCR
        - Distress: elevated RMS, speech-range pitch, irregular rhythm
        - Normal: low-moderate energy, stable spectral features
        """
        rms_mean      = features["rms_mean"]
        rms_max       = features["rms_max"]
        centroid_mean = features["centroid_mean"]
        zcr_mean      = features["zcr_mean"]
        pitch_mean    = features["pitch_mean"]
        bandwidth_mean = features["bandwidth_mean"]

        # Normalised scores (heuristic thresholds from literature)
        energy_score    = min(1.0, rms_max / 0.5)           # 0.5 RMS ≈ loud scream
        pitch_score     = min(1.0, pitch_mean / 1500.0)     # screams ≈ 800–3000 Hz
        centroid_score  = min(1.0, centroid_mean / 4000.0)  # high centroid = bright = scream
        zcr_score       = min(1.0, zcr_mean / 0.3)          # high ZCR = noisy consonants
        bandwidth_score = min(1.0, bandwidth_mean / 3000.0)

        scream_score = (
            energy_score   * 0.35
            + pitch_score  * 0.25
            + centroid_score * 0.20
            + zcr_score    * 0.10
            + bandwidth_score * 0.10
        )

        distress_score = (
            energy_score   * 0.30
            + pitch_score  * 0.30
            + zcr_score    * 0.25
            + bandwidth_score * 0.15
        )

        # Classification decision
        if scream_score >= 0.65:
            cls: AudioClass = "scream"
            confidence = scream_score
        elif distress_score >= 0.45 or (rms_mean > 0.05 and pitch_mean > 200):
            cls = "distress"
            confidence = distress_score
        else:
            cls = "normal"
            confidence = 1.0 - max(scream_score, distress_score)

        risk_score = self._score_from_class(cls, confidence)
        return AudioResult(
            audio_class=cls,
            confidence=round(confidence, 3),
            risk_score=risk_score,
            features=features,
        )

    # ── Trained model predict ─────────────────────────────────────────────

    def _model_predict(self, features: dict) -> AudioResult:
        """Use a trained sklearn model (RandomForest / SVM)."""
        vec = self._features_to_vector(features)
        proba = self._model.predict_proba([vec])[0]
        classes: list[AudioClass] = self._model.classes_
        idx = int(np.argmax(proba))
        cls = classes[idx]
        confidence = float(proba[idx])
        risk_score = self._score_from_class(cls, confidence)
        return AudioResult(
            audio_class=cls,
            confidence=round(confidence, 3),
            risk_score=risk_score,
            features=features,
        )

    # ── Helpers ───────────────────────────────────────────────────────────

    def _features_to_vector(self, features: dict) -> list:
        return (
            features["mfcc_mean"]
            + features["mfcc_std"]
            + features["chroma_mean"]
            + [
                features["zcr_mean"],
                features["rms_mean"],
                features["rms_max"],
                features["centroid_mean"],
                features["rolloff_mean"],
                features["bandwidth_mean"],
                features["pitch_mean"],
            ]
        )

    def _score_from_class(self, cls: AudioClass, confidence: float) -> int:
        lo, hi = CLASS_SCORE_MAP[cls]
        score = int(lo + (hi - lo) * confidence)
        return max(0, min(255, score))


# ── Model training helper (run once offline) ──────────────────────────────

def train_and_save_model(dataset_dir: str, output_path: str = MODEL_PATH):
    """
    Train a RandomForest on labeled audio files.

    dataset_dir layout:
      dataset/
        scream/   *.wav
        distress/ *.wav
        normal/   *.wav

    Usage:
        python -c "from services.audio_ml import train_and_save_model; train_and_save_model('dataset/')"
    """
    import os, joblib
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import classification_report

    svc = AudioMLService()
    X, y_labels = [], []

    for label in ("scream", "distress", "normal"):
        folder = os.path.join(dataset_dir, label)
        if not os.path.exists(folder):
            continue
        for fname in os.listdir(folder):
            if not fname.lower().endswith((".wav", ".mp3", ".ogg")):
                continue
            fpath = os.path.join(folder, fname)
            with open(fpath, "rb") as f:
                audio_bytes = f.read()
            import librosa, io
            y_audio, sr = librosa.load(io.BytesIO(audio_bytes), sr=22050, mono=True)
            feats = svc._extract_features(y_audio, sr)
            X.append(svc._features_to_vector(feats))
            y_labels.append(label)

    X_train, X_test, y_train, y_test = train_test_split(X, y_labels, test_size=0.2, random_state=42)
    clf = RandomForestClassifier(n_estimators=200, random_state=42, n_jobs=-1)
    clf.fit(X_train, y_train)
    print(classification_report(y_test, clf.predict(X_test)))
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    joblib.dump(clf, output_path)
    print(f"Model saved to {output_path}")
