# DewCode

**AI-Powered Developer Collaboration & Code Intelligence Platform**

DewCode is a full-stack, browser-based development environment that combines real-time collaborative coding, AI-assisted development, and integrated DevOps tooling into a single platform. It is designed to feel like a lightweight cloud IDE — write code, get AI help, run it safely in an isolated container, and collaborate with your team live.

---

## ✨ Key Features

- 🔐 **User Management** — JWT authentication with Admin / Developer / Viewer roles
- 📁 **Project & Repository Management** — create, update, delete, and version-track projects
- 🧠 **AI-Powered Code Assistant** — generation, bug detection, debugging help, and code explanation via a **local Ollama server** (no external API cost)
- 💻 **Online Code Editor** — Monaco Editor with syntax highlighting, multi-language support, and tab-based navigation
- 🔗 **GitHub Integration** — clone, commit, push, pull, and branch management
- 📂 **Project Import** — import local projects and browse the folder structure inside the editor
- 🖥️ **Built-in Terminal** — run shell commands with real-time output
- ⚡ **Real-Time Collaboration** — multi-user editing, live cursors, and instant sync via WebSockets
- ▶️ **Sandboxed Code Execution** — run code safely inside isolated **Docker containers**
- 📊 **Analytics Dashboard** — track project activity and contributions
- 📄 **PDF Report Generation** — export project summaries and analytics

---

## 🏗️ Architecture

```
Frontend (React + TypeScript + Tailwind + Redux)
        ↓
Backend API (Node.js + Express + TypeScript)
        ↓
Database (MongoDB + Mongoose)
        +
AI Module ───────► Ollama (local LLM server: CodeLlama / DeepSeek)
Execution Engine ─► Docker Sandbox (per-job isolated containers)
Git Layer ────────► GitHub API / simple-git
Real-Time Layer ──► Socket.IO (WebSockets)
```

DewCode never runs untrusted user code directly on the host machine. All code execution is delegated to short-lived, resource-limited Docker containers, and all AI inference runs against a locally hosted Ollama instance rather than a third-party API.

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Tailwind CSS, Redux |
| Backend | Node.js, Express.js, TypeScript |
| Database | MongoDB, Mongoose |
| Auth | JWT, bcryptjs |
| AI | Ollama (local LLMs — CodeLlama, DeepSeek, etc.) |
| Real-Time | Socket.IO (WebSockets) |
| Code Execution | Docker (sandboxed containers) |
| Deployment | Vercel (frontend), Render (backend), MongoDB Atlas (database) |

---

## ⚙️ Prerequisites

Make sure the following are installed on your machine before running DewCode:

- [Node.js](https://nodejs.org/) v18+
- [npm](https://www.npmjs.com/) or yarn
- [Docker](https://www.docker.com/) (Docker Desktop or Docker Engine) — **required** for sandboxed code execution
- [Ollama](https://ollama.com/) — **required** for the local AI assistant
- MongoDB (local instance or MongoDB Atlas connection string)

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Dewmi2004/DewCode
cd dewcode
```

### 2. Install dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 3. Configure environment variables

Create a `.env` file inside `backend/`:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/dewcode
JWT_SECRET=your_jwt_secret_here

# Ollama (local AI server)
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=codellama

# Docker sandbox
DOCKER_SOCKET=/var/run/docker.sock
EXECUTION_TIMEOUT_MS=10000
EXECUTION_MEMORY_LIMIT=256m
```

Create a `.env` file inside `frontend/`:

```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

### 4. Start Ollama (AI Assistant)

DewCode's AI assistant runs entirely on your machine through Ollama — no external API key required.

```bash
# Install Ollama: https://ollama.com/download

# Pull a code-capable model
ollama pull codellama
# or
ollama pull deepseek-coder

# Start the Ollama server
ollama serve
```

By default, Ollama listens on `http://localhost:11434`. The backend connects to this address to send code generation, review, and debugging requests to the local model.

### 5. Start Docker (Code Execution Sandbox)

DewCode executes all user-submitted code inside isolated, ephemeral Docker containers rather than on the host system. This keeps execution safe, language-agnostic, and resource-limited.

```bash
# Make sure the Docker daemon is running
docker --version
docker ps
```

Build the language runner images used by the execution engine (example for Python and Java):

```bash
cd backend/docker/runners

docker build -t dewcode-python-runner ./python
docker build -t dewcode-java-runner ./java
docker build -t dewcode-node-runner ./node
```

Each runner image is minimal and contains only the toolchain needed to compile/run that language. When a user clicks **Run**, the backend:

1. Spins up a fresh container from the relevant runner image
2. Mounts the submitted code as a read-only volume
3. Applies CPU, memory, and time limits (`EXECUTION_TIMEOUT_MS`, `EXECUTION_MEMORY_LIMIT`)
4. Streams stdout/stderr back to the editor's output console
5. Destroys the container immediately after execution

No code execution request ever runs directly via `child_process` on the host — Docker is mandatory for this feature.

### 6. Run the application

```bash
# Start backend (from /backend)
npm run dev

# Start frontend (from /frontend)
npm run dev
```

The app should now be available at `http://localhost:5173` (or your configured frontend port), with the API running at `http://localhost:5000`.

---

## 🐳 Docker Compose (optional, recommended)

For convenience, you can spin up MongoDB, the backend, and the frontend together with Docker Compose, while Ollama and the code-execution sandbox runners remain managed separately:

```bash
docker compose up --build
```

> Note: Ollama itself is typically run as a native host process (not inside Compose) so it can access GPU acceleration if available. The execution-sandbox runner images are built separately, as shown in step 5.

---

## 🧪 How AI Assistance Works

1. The frontend sends a prompt (e.g. "explain this function" or "fix this bug") to the backend.
2. The backend forwards the prompt, along with relevant code context, to the local Ollama server at `OLLAMA_HOST`.
3. Ollama runs inference using the configured local model (e.g. CodeLlama or DeepSeek-Coder) — entirely offline, with zero per-request API cost.
4. The response (code suggestion, explanation, or fix) is streamed back to the editor.

## 🛡️ How Sandboxed Execution Works

1. The user writes code in the Monaco editor and clicks **Run**.
2. The backend selects the appropriate Docker runner image for the chosen language.
3. A new, isolated container is created with strict CPU/memory/time limits and no network access by default.
4. The code runs inside the container; output is streamed back live to the console panel.
5. The container is torn down immediately after execution, leaving no residual state.

---

## 📂 Project Structure

```
dewcode/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   │   ├── ai/           # Ollama integration
│   │   │   └── execution/    # Docker sandbox engine
│   │   └── sockets/          # Real-time collaboration (Socket.IO)
│   ├── docker/
│   │   └── runners/          # Per-language Dockerfiles
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── store/             # Redux
│   │   └── editor/            # Monaco Editor integration
│   └── .env
└── README.md
```

---

## 🗺️ Roadmap

- [ ] Branch management UI for GitHub integration
- [ ] Multi-model selector for the Ollama assistant
- [ ] Analytics dashboard v2 with team-level insights
- [ ] Configurable per-language resource limits for the Docker sandbox
- [ ] Offline-first editing mode

---

## Demo Video

