# VedaAI – AI Assessment Creator

A full-stack AI-powered platform for teachers to create, manage, and generate question papers using AI.

Built for the VedaAI Full Stack Engineering Assignment.

---

## 🚀 Live Demo

> Deploy using Docker Compose (see below) or run locally.

---

## 🏗 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                    │
│   ┌──────────┐  ┌──────────────┐  ┌───────────────────┐    │
│   │Assignments│  │Create Form   │  │Result / Output    │    │
│   │  List    │  │(2-step wizard)│  │(Question Paper)   │    │
│   └──────────┘  └──────────────┘  └───────────────────┘    │
│         Zustand state   │   WebSocket (real-time updates)   │
└──────────────────────────┼──────────────────────────────────┘
                           │ HTTP + WS
┌──────────────────────────▼──────────────────────────────────┐
│                      Backend (Node.js + Express)             │
│                                                              │
│  POST /api/assignments  ──► BullMQ Queue ──► Worker         │
│  GET  /api/assignments/:id/result                            │
│  POST /api/assignments/:id/regenerate                        │
│  WS   /ws  (subscribe to assignment updates)                 │
│                                                              │
│  Worker Flow:                                                │
│  1. Fetch assignment from MongoDB                            │
│  2. Build structured prompt                                  │
│  3. Call Anthropic Claude API                                │
│  4. Parse + validate JSON response                           │
│  5. Store Result in MongoDB                                  │
│  6. Notify frontend via WebSocket                            │
│                                                              │
│  MongoDB  │  Redis (BullMQ jobs)  │  WebSocket Server       │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠 Tech Stack

| Layer       | Technology                              |
|-------------|----------------------------------------|
| Frontend    | Next.js 16, TypeScript, Zustand, Axios |
| Styling     | Inline styles (pixel-perfect Figma)    |
| Backend     | Node.js, Express, TypeScript           |
| Database    | MongoDB + Mongoose                     |
| Queue       | BullMQ + Redis                         |
| Real-time   | WebSocket (ws library)                 |
| AI          | Anthropic Claude (claude-sonnet-4)     |

---

## 📦 Setup Instructions

### Prerequisites
- Node.js 20+
- Docker + Docker Compose (recommended)
- Anthropic API key

### Option 1: Docker Compose (Recommended)

```bash
# Clone the repo
git clone <your-repo-url>
cd vedaai

# Set your API key
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env

# Start everything
docker-compose up -d

# App is live at:
# Frontend: http://localhost:3000
# Backend:  http://localhost:3001
```

### Option 2: Local Development

**1. Start MongoDB and Redis**
```bash
# Using Docker
docker run -d -p 27017:27017 mongo:7
docker run -d -p 6379:6379 redis:7-alpine
```

**2. Backend**
```bash
cd backend
cp .env.example .env
# Edit .env with your ANTHROPIC_API_KEY
npm install
npm run dev
```

**3. Frontend**
```bash
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:3000  
Backend: http://localhost:3001

---

## 🔑 Environment Variables

**Backend (`backend/.env`)**
```
PORT=3001
MONGODB_URI=mongodb://localhost:27017/vedaai
REDIS_HOST=localhost
REDIS_PORT=6379
ANTHROPIC_API_KEY=sk-ant-your-key-here
FRONTEND_URL=http://localhost:3000
```

**Frontend (`frontend/.env.local`)**
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_WS_URL=ws://localhost:3001/ws
```

> **Note:** If no `ANTHROPIC_API_KEY` is set, the system falls back to intelligently-structured mock data so you can demo the full UI flow.

---

## ✨ Features Implemented

### Core Features
- ✅ **Assignment Creation** – 2-step wizard with file upload, due date, question types (with +/- controls)
- ✅ **AI Question Generation** – Structured prompt → Claude API → parsed JSON (never raw output)
- ✅ **Background Jobs** – BullMQ workers process generation asynchronously
- ✅ **Real-time Updates** – WebSocket notifies frontend when generation completes
- ✅ **MongoDB Storage** – Assignments + Results persisted
- ✅ **Redis Caching** – BullMQ job state via Redis
- ✅ **Output Page** – Structured question paper with sections, difficulty badges, marks
- ✅ **Answer Key** – Collapsible answer key section
- ✅ **Validation** – No empty/negative values, required fields enforced

### Bonus Features
- ✅ **Download as PDF** – Print-optimized HTML exported via browser print dialog
- ✅ **Regenerate** – One-click regeneration with new AI output
- ✅ **Difficulty Badges** – Color-coded Easy/Moderate/Hard tags
- ✅ **Demo Mode** – Works without backend (mock data fallback)
- ✅ **Delete Assignments** – With result cleanup
- ✅ **Search/Filter** – Client-side assignment search

---

## 🎨 Design Notes

The UI is a pixel-perfect replication of the provided Figma designs:
- **Empty State**: Illustration + "No assignments yet" with CTA
- **Filled State**: Grid cards with status indicators and context menu (View / Delete)
- **Create Form**: 2-step wizard with file upload drop zone, question type table with +/- stepper
- **Output Page**: Formal exam paper layout with school header, student info fields, sections, and difficulty badges

---

## 📡 API Reference

| Method | Endpoint                          | Description                    |
|--------|-----------------------------------|--------------------------------|
| GET    | `/api/assignments`                | List all assignments           |
| POST   | `/api/assignments`                | Create + queue generation      |
| GET    | `/api/assignments/:id`            | Get single assignment          |
| DELETE | `/api/assignments/:id`            | Delete assignment + result     |
| GET    | `/api/assignments/:id/result`     | Get generated question paper   |
| POST   | `/api/assignments/:id/regenerate` | Re-queue generation            |

WebSocket: `ws://localhost:3001/ws`  
Subscribe: `{ "type": "subscribe", "assignmentId": "<id>" }`  
Updates: `{ "type": "assignment_update", "status": "completed", "resultId": "..." }`

---

## 🧠 AI Prompt Strategy

The system builds a structured prompt that specifies:
- Subject, grade, school name
- Question breakdown by type (MCQ, Short, Long, etc.)
- Total questions and marks
- Optional reference material from uploaded files

The AI is instructed to return **only valid JSON** with a strict schema, which is then parsed and validated server-side before storing. This ensures:
- No raw AI text is ever rendered
- Consistent difficulty distribution (~30% Easy, 40% Moderate, 30% Hard)
- Proper section grouping
- Answer key generation

---

## 🏆 Extra Points

1. **Fallback Mock Data** – Full UI flow works even without an AI API key
2. **PDF Export** – Properly formatted print-ready HTML with answer key
3. **Zustand** for client state management
4. **Polling + WebSocket** dual approach for reliability
5. **Monorepo** with Docker Compose for one-command deployment
