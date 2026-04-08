# 🛡️ Women Safety Threat Detection System

A production-ready full-stack web application for real-time threat detection and safety monitoring.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + Tailwind)               │
│  Dashboard │ Risk Viz │ Threat Indicator │ Alerts │ Logs     │
└─────────────────────────┬───────────────────────────────────┘
                          │ REST API / WebSocket
┌─────────────────────────▼───────────────────────────────────┐
│                    BACKEND (FastAPI)                         │
│  /analyze-risk │ /audio-detect │ /trigger-alert             │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ Threat      │  │ Audio ML     │  │ Alert Service    │   │
│  │ Engine (FSM)│  │ (librosa)    │  │ Twilio + Email   │   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Frontend  | React 18, Tailwind CSS, Recharts    |
| Backend   | FastAPI, Python 3.11               |
| ML Audio  | librosa, scikit-learn, numpy        |
| Alerts    | Twilio SMS, SMTP Email              |
| Deploy    | Vercel (frontend), Railway/Render (backend) |

## Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env  # Fill in credentials
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

## Folder Structure
```
women-safety-system/
├── frontend/          # React app
├── backend/           # FastAPI server
├── models/            # ML model files
├── utils/             # Shared utilities
└── README.md
```
