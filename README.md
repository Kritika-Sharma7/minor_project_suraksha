# 🛡️ SURAKSHA v3 — Safety Intelligence Platform

> **The next generation of real-time, explainable, and probabilistic threat detection.**

Suraksha v3 is an advanced, edge-computing safety platform designed to provide human-centric, explainable threat detection and automated emergency dispatch. By fusing high-fidelity sensor telemetry from acoustics, kinematics, and geo-spatial data, the system employs a deterministic Finite State Machine (FSM) combined with probabilistic scoring to generate stable and actionable safety assessments.

---

## ✨ Core Pillars of Intelligence

### 🧬 Explainable System Protocol (X-AI)
Moving beyond "black-box" heuristics, Suraksha v3 provides natural language "reasoning" for every state transition. This ensures that users and first responders understand exactly *why* a threat level was escalated.

### 🛰️ Multi-Sensor Fusion Matrix
The system synthesizes data from three primary vectors:
- **Acoustic Intelligence**: Real-time spectral analysis (ZCR, RMS) and ML-driven distress classification.
- **Kinematic IMU**: 6-axis motion tracking for advanced fall and struggle detection.
- **Geodesic Engine**: Continuous GPS isolation and velocity variance monitoring.

### 🕰️ Temporal Reasoning & Persistence
Threat detection is temporal, not instantaneous. The engine maintains a memory of recent states, calculating trends (UP/DOWN/STABLE) and using hysteresis to eliminate false positives from transient sensor noise.

### 🎭 Multi-Domain Adaptive Modes
The system dynamically swaps its weighting matrices for different contexts:
- **Women Safety**: Focuses on isolation and acoustic distress.
- **Elderly Monitoring**: High-sensitivity vertical acceleration drops.
- **Industrial Safety**: Filters machinery ambient noise for chaotic kinetic patterns.

---

## 🖥️ Platform Modules

### 📊 Safety Intelligence Matrix (Analytics)
Visualize the live "Heartbeat" of the system. Monitor sensor fusion health, risk probability distributions, and longitudinal safety trends.

### 🏛️ Intelligence Bureau (Incidents)
A centralized log of all detected safety incidents with deep-dive explainability, geo-tagged locations, and status tracking (Safe vs. Responding).

### 🛠️ Hardware Diagnostics (Devices)
Monitor the health of connected IoT nodes and local sensors. Real-time telemetry visualization for accelerometers, gyroscopes, and microphones.

### 🧪 Simulation Lab (Academic Mode)
Designed for researchers and evaluators. Inject scenario-based sensor vectors and manually trigger edge-case scenarios to calibrate the engine's sensitivity.

---

## 🛠 Tech Stack

- **Frontend**: React 18, TailwindCSS (Glassmorphism UI), Lucide Icons, Framer Motion.
- **Backend**: FastAPI (Python 3.10+), WebSocket for real-time telemetry.
- **ML Engine**: Scikit-Learn (RandomForest) for acoustic classification, Librosa for feature extraction.
- **Database**: SQLite / SQLAlchemy for persistent incident logging.
- **Deployment**: Ready for Vercel (Frontend) and Dockerized Cloud instances.

---

## 🚀 Quick Start

### 1. Prerequisites
- Python 3.10+
- Node.js 18+
- ffmpeg (for audio processing)

### 2. Backend Setup
```bash
# Clone the repository
git clone https://github.com/Kritika-Sharma7/minor_project_suraksha.git
cd minor_project_suraksha

# Setup virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# (Optional) Generate Training Data & Train ML Model
python generate_data_and_train.py

# Start the API & WebSocket Server
python main.py
```

### 3. Frontend Setup
```bash
# Navigate to project root
npm install
npm run dev
```

---

## 📂 Project Architecture

```
suraksha/
├── audio_ml.py        # ML Model definition and feature extraction
├── threat_engine.py   # Core FSM and Probabilistic Risk Logic
├── main.py            # FastAPI Entry point & WebSocket handling
├── alerts.py          # Notification services (Twilio/Email)
├── ...                # Modular Backend Services (storage, sensors, etc)
├── App.jsx            # React Dashboard Hub
├── components/        # Specialized Vista Components (Analytics, Alerts, etc)
└── ...
```

---

## 🎓 Academic Contribution
Suraksha v3 was developed as a finalized, professional-grade solution for the Minor Project evaluation. It demonstrates the integration of **Signal Processing, Machine Learning, and Real-time Distributed Systems** in a mission-critical safety application.

*Build: v3.2.4-Gold • Cryptographic Audit Trail Active • Proudly developed for Advanced Safety Intelligence.*
