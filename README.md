# VedaAI – AI Assessment Creator

VedaAI is a full-stack web application that helps teachers create and manage assessments using AI. Teachers can generate structured question papers, manage assignments, and view results in real time.

This project was built as part of the VedaAI Full Stack Engineering Assignment.

---

# Architecture Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                      │
│                                                             │
│  Assignments List   |   Create Assignment   |   Results    │
│                                                             │
│      Zustand state management + WebSocket updates           │
└────────────────────────────┬────────────────────────────────┘
                             │
                        HTTP + WebSocket
                             │
┌────────────────────────────▼────────────────────────────────┐
│                 Backend (Node.js + Express)                │
│                                                             │
│  POST /api/assignments  →  BullMQ Queue  →  Worker         │
│                                                             │
│  Worker Flow:                                               │
│  1. Fetch assignment from MongoDB                           │
│  2. Build AI prompt                                         │
│  3. Call Anthropic Claude API                               │
│  4. Parse and validate response                             │
│  5. Store generated result                                  │
│  6. Notify frontend using WebSocket                         │
│                                                             │
│  MongoDB   |   Redis   |   WebSocket Server                │
└─────────────────────────────────────────────────────────────┘
```

---

# Tech Stack

| Layer             | Technology                             |
| ----------------- | -------------------------------------- |
| Frontend          | Next.js 16, TypeScript, Zustand, Axios |
| Styling           | Inline styles                          |
| Backend           | Node.js, Express, TypeScript           |
| Database          | MongoDB with Mongoose                  |
| Queue System      | BullMQ with Redis                      |
| Real-time Updates | WebSocket (`ws`)                       |
| AI Integration    | Anthropic Claude (claude-sonnet-4)     |

---

# Setup Instructions

## Prerequisites

* Node.js 20+
* Docker and Docker Compose
* Anthropic API key

---

## Docker Setup

Clone the repository, add your Anthropic API key to the environment file, and start the application using Docker Compose.

```bash
npm install
ANTHROPIC_API_KEY=sk-ant-your-key-here npm run docker:up
```

Application URLs:

* Frontend: `http://localhost:3000`
* Backend: `http://localhost:3001`

---

## Local Development

Start MongoDB and Redis locally, then run the backend and frontend applications separately.

Backend:

* Copy `.env.example` to `.env`
* Add your Anthropic API key
* Install dependencies and start the development server

```bash
cd backend
npm install
npm run dev
```

Frontend:

* Install dependencies
* Start the development server

```bash
cd frontend
npm install
npm run dev
```

URLs:

* Frontend: `http://localhost:3000`
* Backend: `http://localhost:3001`

---

# Environment Variables

## Backend (`backend/.env`)

```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/vedaai
REDIS_HOST=localhost
REDIS_PORT=6379
ANTHROPIC_API_KEY=sk-ant-your-key-here
# Optional alternative provider
OPENAI_API_KEY=sk-your-openai-key-here
OPENAI_MODEL=gpt-4o-mini
FRONTEND_URL=http://localhost:3000
# Optional: use synchronous generation on serverless hosts
INLINE_GENERATION=false
```

## Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_WS_URL=ws://localhost:3001/ws
```

If no AI provider key is provided, or if the provider is temporarily unavailable, the app falls back to structured mock data so the full flow can still be demonstrated.

For Vercel-style serverless deployments, set `INLINE_GENERATION=true` if background workers or WebSocket upgrades are unavailable. Local and Docker runs still use Redis-backed BullMQ workers by default.

---

# Features

## Assignment Management

* Create assignments using a 2-step form flow
* Upload supporting files
* Add due dates and question type distribution
* View all assignments in a dashboard
* Delete assignments

## AI Question Generation

* Structured AI prompt generation
* Background processing using BullMQ workers
* Claude API integration
* JSON validation before storing responses
* Automatic answer key generation

## Real-time Updates

* WebSocket-based status updates
* Polling fallback for reliability
* Live completion notifications

## Output Generation

* Structured question paper layout
* Difficulty labels for questions
* Section-wise grouping
* Printable PDF-friendly format
* Regenerate question papers with one click

---

# API Reference

| Method | Endpoint                          | Description            |
| ------ | --------------------------------- | ---------------------- |
| GET    | `/api/assignments`                | Get all assignments    |
| POST   | `/api/assignments`                | Create assignment      |
| GET    | `/api/assignments/:id`            | Get assignment details |
| DELETE | `/api/assignments/:id`            | Delete assignment      |
| GET    | `/api/assignments/:id/result`     | Get generated paper    |
| POST   | `/api/assignments/:id/regenerate` | Regenerate paper       |

WebSocket endpoint:

```text
ws://localhost:3001/ws
```

Subscribe format:

```json
{
  "type": "subscribe",
  "assignmentId": "<id>"
}
```

Update format:

```json
{
  "type": "assignment_update",
  "status": "completed",
  "resultId": "..."
}
```

---

# AI Prompt Strategy

The backend creates structured prompts based on:

* Subject and grade
* School information
* Question distribution
* Marks allocation
* Uploaded reference material

The AI is instructed to return only valid JSON following a strict schema. Responses are parsed and validated before being stored.

This ensures:

* Consistent formatting
* Structured sections
* Difficulty balance
* Reliable answer key generation
* No raw AI output rendered directly

---

# Additional Notes

* The project is organized as a monorepo
* Docker Compose support allows one-command setup
* Zustand is used for lightweight frontend state management
* Mock mode allows frontend demos without an API key
* Both WebSocket updates and polling are implemented for reliability
