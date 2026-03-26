# while-true-ai

An autonomous AI agent that runs on your local machine. It connects to your LLM provider of choice and can manage tasks, goals, schedules, and integrations — all from your terminal or a web dashboard.

## Quick Start

```bash
git clone https://github.com/mikedicarlo/while-true-ai.git
cd while-true-ai
./install.sh
```

The install script will:
1. Detect your OS and package manager
2. Install Node.js 20+ (via nvm, fnm, or your package manager) if missing
3. Install pnpm if missing
4. Install project dependencies
5. Build native modules (better-sqlite3)
6. Build all packages
7. Run the setup wizard (first time only)
8. Launch the web dashboard at `http://localhost:4200`

### Manual Install

```bash
# Prerequisites: Node.js 20+, pnpm
pnpm install
pnpm build

# First run — setup wizard
pnpm start --setup

# Start the web dashboard
pnpm start --web
```

## Run Modes

| Command | Description |
|---------|-------------|
| `pnpm start` | Interactive CLI with chat, status bar, and slash commands |
| `pnpm start --web` | Web dashboard at `http://localhost:4200` |
| `pnpm start --web --port 3000` | Web dashboard on a custom port |
| `pnpm start --headless` | Agent loop only, no UI (background operation) |
| `pnpm start --setup` | Re-run the setup wizard |
| `pnpm start --version` | Show version |

## Setup Wizard

On first run, the setup wizard walks you through:

1. **Choose an LLM provider** — OpenAI, Anthropic, Google, Kimi K2.5, or Ollama (local)
2. **Select a model** — e.g. Claude Sonnet 4, GPT-4o, Gemini 2.5 Pro
3. **Enter your API key** — stored securely in `~/.while-true-ai/credentials.yaml`

The wizard creates `~/.while-true-ai/config.yaml` with your provider configuration.

### Supported LLM Providers

| Provider | Adapter | Models |
|----------|---------|--------|
| Anthropic | `anthropic` | Claude Sonnet 4, Claude Opus 4, Claude Haiku 3.5 |
| OpenAI | `openai` | GPT-4o, GPT-4o mini, GPT-4.1 |
| Google | `google` | Gemini 2.5 Pro, Gemini 2.5 Flash |
| Kimi K2.5 | `openai` | kimi-k2.5 (via custom `baseUrl`) |
| Ollama | `ollama` | Llama 3.3, Qwen 2.5, or any local model |
| OpenRouter | `openai` | Any model (via custom `baseUrl`) |
| Together AI | `openai` | Any model (via custom `baseUrl`) |

Multiple providers can be configured for different purposes (thinking, deciding, acting, reflecting, summarizing, chat).

## Web Dashboard

The web dashboard (`pnpm start --web`) provides a full browser-based interface:

| Tab | What's on it |
|-----|-------------|
| **Dashboard** | Agent phase, cycle count, uptime, token usage, cost, tasks completed/failed, error count. Pause/Resume/Wake controls. |
| **Tasks** | Create tasks, view recent tasks with status, priority, source, and timestamps. |
| **Goals** | Create goals, track progress with expandable details showing current step, task count, progress log. Pause/resume/cancel goals. |
| **Schedules** | View active cron schedules with next/last run times. Delete schedules. |
| **Integrations** | Enable/disable integrations, configure credentials, view available tools per integration. |
| **Activity** | Real-time event feed with color-coded entries (errors, completions, task creation, sleep/wake). |
| **Terminal** | Full interactive terminal at the bottom — same as CLI mode with chat, slash commands, and all keyboard shortcuts. |

The version number is displayed in the header alongside the agent's connection status and cycle count.

## Terminal

The terminal (available in both CLI and web modes) is the primary way to interact with while-true-ai. Type natural language messages to chat with the AI, or use slash commands.

### Commands

| Command | Description |
|---------|-------------|
| `/help` | Show all available commands |
| `/status` | Agent phase, cycle count, tokens used, cost |
| `/tasks` | List recent 15 tasks |
| `/add_task <description>` | Create a new task |
| `/goals` | List all goals with status |
| `/add_goal <title>` | Create a goal (AI decomposes into tasks) |
| `/goal show <id>` | Show goal details and progress log |
| `/goal pause <id>` | Pause a goal |
| `/goal resume <id>` | Resume a paused goal |
| `/goal cancel <id>` | Cancel a goal |
| `/schedules` | List active schedules with next run times |
| `/add_schedule "task title" <schedule>` | Create a schedule from natural language |
| `/metrics` | Token usage, cost, cycles, tasks, errors |
| `/budget` | Remaining daily budget |
| `/integrations` | List active integrations and tool count |
| `/context` | View learned user context |
| `/context set <key> <value>` | Add context manually |
| `/context remove <key>` | Remove a context entry |
| `/pause` | Pause the agent loop |
| `/resume` | Resume the agent loop |
| `/wake` | Wake a sleeping agent |
| `/quit` or `/exit` | Exit (CLI only) |

**Tab completion** — Type `/` and press Tab to autocomplete commands. If multiple matches exist, press Tab again to see options.

**Natural language schedules** — The `/add_schedule` command accepts natural language:
- `/add_schedule "check email" every 30 minutes`
- `/add_schedule "standup prep" daily at 9am`
- `/add_schedule "weekly review" every monday at 10am`
- `/add_schedule "backup" weekdays at 8:30am`

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **Up / Down** | Navigate command history |
| **Left / Right** | Move cursor within the line |
| **Backspace** | Delete character before cursor |
| **Ctrl+A** / **Home** | Jump to start of line |
| **Ctrl+E** / **End** | Jump to end of line |
| **Ctrl+C** | Cancel current request |
| **Tab** | Autocomplete slash commands |
| **Enter** | Send message |

The web terminal also has a **Stop** button and a **processing...** indicator in the header bar when waiting for a response.

### First-Run Onboarding

On the first web launch, the terminal asks a few quick questions (name, location, timezone, occupation) to personalize responses. Press Enter to skip any question. This only runs once.

### User Context & Auto-Learning

while-true-ai learns about you automatically from conversations. If you mention where you live, what you do, or preferences — it remembers for next time.

- `/context` — View everything it knows about you
- `/context set language python` — Add context manually
- `/context remove timezone` — Remove an entry

Context is stored locally at `~/.while-true-ai/data/user_context.json` and included in the system prompt so the AI personalizes its responses.

## Tasks, Goals & Schedules

### Tasks

Tasks are individual units of work. They can be created manually, generated by goal decomposition, or triggered by schedules.

- **Priorities**: 1 (urgent), 2 (high), 3 (normal), 4 (low)
- **Statuses**: pending, in_progress, completed, failed, cancelled
- **Dependencies**: Tasks can be blocked by other tasks via `blockedBy`
- **Sources**: user, agent, scheduled, decomposed

The agent loop picks up pending tasks automatically and executes them using the LLM with available tools.

### Goals

Goals are high-level objectives that the AI decomposes into tasks:

1. You create a goal: `/add_goal Ship the new feature by Friday`
2. The AI breaks it down into concrete tasks using the LLM
3. A recurring check-in schedule is created to evaluate progress
4. The AI periodically reflects on progress and creates new tasks as needed
5. You can pause, resume, or cancel goals at any time

Goals track progress with a step-by-step log including timestamps and status.

### Schedules

Schedules use cron expressions to create recurring tasks:

- Created via `/add_schedule` (natural language) or the API (cron expression)
- Powered by the Croner library for accurate cron execution
- Each schedule fires and creates a task, which the agent loop picks up
- View next/last run times in the web UI or via `/schedules`

## Integrations

| Integration | Tools | What it does | Requires Approval |
|-------------|-------|-------------|-------------------|
| **REST Client** | 3 | GET, POST, and generic HTTP requests to any API | No |
| **Gmail** | 6 | List, read, search, send, archive, mark read | No |
| **Google Calendar** | 4 | List, create, update, delete events | No |
| **Tesla** | 11 | Vehicle status, lock/unlock, climate, charge, honk, flash, trunk | Yes |
| **Robinhood** | 9 | Portfolio, positions, quotes, buy/sell stocks, orders, crypto | Yes |
| **Schlage** | 9 | List locks, status, lock/unlock, access codes, history, battery | Yes |

Integrations marked **Requires Approval** will ask for confirmation before executing actions that affect physical devices or finances.

### Tool Reference

<details>
<summary><strong>REST Client</strong> (3 tools)</summary>

| Tool | Parameters | Description |
|------|-----------|-------------|
| `rest_get` | url, headers | Make a GET request |
| `rest_post` | url, body, headers | Make a POST request |
| `rest_request` | method, url, body, headers | Generic HTTP request (GET/POST/PUT/DELETE/PATCH) |
</details>

<details>
<summary><strong>Gmail</strong> (6 tools)</summary>

| Tool | Parameters | Description |
|------|-----------|-------------|
| `gmail_list` | query, maxResults | List messages with Gmail search query |
| `gmail_read` | messageId | Read a specific email |
| `gmail_send` | to, subject, body, cc | Send an email |
| `gmail_search` | query, maxResults | Search Gmail |
| `gmail_archive` | messageId | Archive email (remove from inbox) |
| `gmail_mark_read` | messageId | Mark email as read |
</details>

<details>
<summary><strong>Google Calendar</strong> (4 tools)</summary>

| Tool | Parameters | Description |
|------|-----------|-------------|
| `calendar_list` | timeMin, timeMax, maxResults, query | List upcoming events |
| `calendar_create` | summary, startTime, endTime, description, location, attendees | Create an event |
| `calendar_update` | eventId, summary, description, startTime, endTime, location | Update an event |
| `calendar_delete` | eventId | Delete an event |
</details>

<details>
<summary><strong>Tesla</strong> (11 tools)</summary>

| Tool | Parameters | Description |
|------|-----------|-------------|
| `tesla_vehicles` | — | List all vehicles |
| `tesla_status` | vehicleId | Vehicle status (location, battery, climate, locks) |
| `tesla_lock` | vehicleId | Lock doors |
| `tesla_unlock` | vehicleId | Unlock doors |
| `tesla_climate_on` | vehicleId, temperature | Enable climate control |
| `tesla_climate_off` | vehicleId | Disable climate control |
| `tesla_charge_start` | vehicleId | Start charging |
| `tesla_charge_stop` | vehicleId | Stop charging |
| `tesla_honk` | vehicleId | Honk horn |
| `tesla_flash` | vehicleId | Flash headlights |
| `tesla_trunk` | vehicleId, which | Open/close trunk (rear or front) |
</details>

<details>
<summary><strong>Robinhood</strong> (9 tools)</summary>

| Tool | Parameters | Description |
|------|-----------|-------------|
| `robinhood_portfolio` | — | Portfolio summary |
| `robinhood_positions` | — | List stock positions |
| `robinhood_quote` | symbol | Get stock quote |
| `robinhood_buy` | symbol, quantity, type, limitPrice | Buy stocks |
| `robinhood_sell` | symbol, quantity, type, limitPrice | Sell stocks |
| `robinhood_orders` | status | List orders (all/open/filled/cancelled) |
| `robinhood_cancel_order` | orderId | Cancel an order |
| `robinhood_crypto_positions` | — | List crypto holdings |
| `robinhood_crypto_quote` | symbol | Get crypto quote |
</details>

<details>
<summary><strong>Schlage</strong> (9 tools)</summary>

| Tool | Parameters | Description |
|------|-----------|-------------|
| `schlage_devices` | — | List all smart locks |
| `schlage_status` | deviceId | Lock state, battery, jam detection, connectivity |
| `schlage_lock` | deviceId | Lock a door |
| `schlage_unlock` | deviceId | Unlock a door |
| `schlage_access_codes` | deviceId | List keypad access codes |
| `schlage_add_code` | deviceId, name, code | Add a keypad code (4-8 digits) |
| `schlage_remove_code` | deviceId, codeName | Remove an access code by name |
| `schlage_history` | deviceId, limit | Lock activity history |
| `schlage_battery` | deviceId | Battery level |
</details>

### Configuring Integrations

**Via the Web UI (recommended):**
1. Go to the **Integrations** tab
2. Click an integration to expand it
3. Enter credentials in the fields provided
4. Click **Save Credentials**
5. Click **Enable**
6. Restart the server

**Via `~/.while-true-ai/credentials.yaml`:**
```yaml
integrations:
  schlage:
    username: your@email.com
    password: your-password
  tesla:
    accessToken: eyJ...
    vehicleId: "12345"
  robinhood:
    accessToken: your-token
```

**Via environment variables:**
```bash
SCHLAGE_USERNAME=your@email.com
SCHLAGE_PASSWORD=your-password
TESLA_ACCESS_TOKEN=eyJ...
ROBINHOOD_ACCESS_TOKEN=your-token
```

### Google OAuth (Gmail & Calendar)

Google integrations require a **Desktop app** OAuth client:

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Enable the **Gmail API** and/or **Google Calendar API**
3. Create an OAuth Client ID — select **Desktop app** (not Web)
4. Copy the **Client ID** and **Client Secret**
5. Enter them in the web UI Integrations tab, or add to `credentials.yaml`:
   ```yaml
   integrations:
     gmail:
       client_id: xxxx.apps.googleusercontent.com
       client_secret: GOCSPX-xxx
   ```
6. Enable the integration and restart

On first restart, your browser will open for Google sign-in. After authorizing, the OAuth token is saved at `~/.while-true-ai/data/gmail_token.json` and auto-refreshes — you won't need to sign in again.

## REST API

When running with `--web`, a full REST API is available at `http://localhost:4200`:

### Status & Control

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/status` | Agent state, phase, cycle count, metrics, version |
| POST | `/api/control/pause` | Pause agent loop |
| POST | `/api/control/resume` | Resume agent loop |
| POST | `/api/control/wake` | Wake from sleep |
| POST | `/api/control/stop` | Shutdown agent |
| GET | `/api/metrics` | Token usage, cost, cycles, tasks, errors, uptime |
| GET | `/api/budget` | Remaining daily token/cost budget |

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | List recent tasks |
| POST | `/api/tasks` | Create task `{ title, description?, priority? }` |
| GET | `/api/tasks/:id` | Get a specific task |

### Goals

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/goals` | List all goals |
| POST | `/api/goals` | Create goal `{ title, description?, successCriteria?, deadline?, checkInIntervalMinutes? }` |
| GET | `/api/goals/:id` | Get a specific goal |
| POST | `/api/goals/:id/pause` | Pause a goal |
| POST | `/api/goals/:id/resume` | Resume a goal |
| POST | `/api/goals/:id/cancel` | Cancel a goal |

### Schedules

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/schedules` | List active schedules |
| POST | `/api/schedules` | Create schedule `{ name?, cronExpression, taskTitle, taskDescription?, taskPriority? }` |
| DELETE | `/api/schedules/:id` | Delete a schedule |

### Integrations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/integrations` | List integrations, tools, and config status |
| POST | `/api/integrations/:name/toggle` | Enable or disable `{ enabled: boolean }` |
| GET | `/api/integrations/:name/credentials` | Check which credentials are configured (masked) |
| POST | `/api/integrations/:name/credentials` | Save credentials `{ key: value, ... }` |

### Chat & WebSocket

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Send a message `{ message }`, returns AI response |
| WS | `/ws` | WebSocket for terminal I/O and real-time agent events |

## Configuration

All configuration and data lives in `~/.while-true-ai/` (outside the project repo, never committed to git):

```
~/.while-true-ai/
├── config.yaml              # LLM providers, integration toggles, agent settings
├── credentials.yaml         # API keys, integration credentials (0600 permissions)
├── gmail_credentials.json   # Google OAuth client credentials (if configured)
└── data/
    ├── agent.db             # SQLite database (tasks, goals, memory)
    ├── user_context.json    # Learned user preferences
    ├── gmail_token.json     # Gmail OAuth token (auto-generated)
    ├── calendar_token.json  # Calendar OAuth token (auto-generated)
    └── logs/
        └── agent.log        # Application logs
```

### config.yaml Reference

```yaml
# ─── LLM Providers ──────────────────────────────────
providers:
  - modelId: claude-sonnet-4-20250514
    adapter: anthropic        # openai | anthropic | google | ollama
    purpose: chat             # thinking | deciding | acting | reflecting | summarizing | chat
    apiKeyEnv: ANTHROPIC_API_KEY
    maxTokens: 4096           # default: 4096
    temperature: 0.7          # default: 0.7
    # baseUrl: https://...    # for OpenAI-compatible providers (Kimi, OpenRouter, etc.)

# ─── Agent Loop ──────────────────────────────────────
loop:
  minSleepSeconds: 1.0        # minimum sleep between cycles
  maxSleepSeconds: 300.0      # maximum sleep (5 minutes)
  baseIdleSleep: 10.0         # initial idle sleep
  idleGrowthFactor: 1.5       # sleep grows by this factor when idle

# ─── Budget Limits ───────────────────────────────────
budget:
  maxTokensPerCall: 150000
  maxTokensPerMinute: 2000000
  maxTokensPerHour: 50000000
  maxTokensPerDay: 200000000
  maxCostPerDayUsd: 100.0
  maxCostPerMonthUsd: 1000.0

# ─── Memory ──────────────────────────────────────────
memory:
  shortTermMaxEntries: 50     # recent context window
  mediumTermTtlDays: 7        # searchable memory TTL

# ─── Safety ──────────────────────────────────────────
safety:
  maxActionsPerCycle: 25      # max tool calls per agent cycle
  requireApprovalFor: []      # additional tools requiring approval

# ─── Integrations ────────────────────────────────────
integrations:
  rest:
    enabled: true
  gmail:
    enabled: false
  calendar:
    enabled: false
  tesla:
    enabled: false
  robinhood:
    enabled: false
  schlage:
    enabled: false

# ─── Logging ─────────────────────────────────────────
logging:
  consoleLevel: info          # fatal | error | warn | info | debug | trace
  fileLevel: info
  filePath: data/logs/agent.log

# ─── API Server ──────────────────────────────────────
api:
  enabled: true
  host: "127.0.0.1"
  port: 4200
```

## Architecture

```
while-true-ai/
├── packages/
│   ├── core/           # Agent loop, LLM adapters, tasks, goals, memory,
│   │                   # scheduler, config, safety, guardrails, kill switch
│   ├── cli/            # Terminal UI (Ink/React), setup wizard, entry point
│   ├── web/            # Express API, WebSocket, React dashboard, xterm.js terminal
│   └── integrations/   # Gmail, Calendar, Tesla, Robinhood, Schlage, REST client
├── install.sh          # One-command setup script
├── turbo.json          # Turborepo build configuration
└── pnpm-workspace.yaml # Monorepo workspace definition
```

### Agent Loop

The agent runs a continuous four-phase loop:

1. **Think** — Gather pending tasks, poll integrations for signals
2. **Decide** — Select the next task based on priority and dependencies
3. **Act** — Execute the task using the LLM with available tools (up to 20 tool iterations)
4. **Reflect** — Evaluate the outcome, update metrics, store results in memory

Between cycles, the agent sleeps adaptively — starting at 10 seconds and growing up to 5 minutes when idle, resetting when new work arrives.

### Safety

- **Action limits** — Maximum 25 tool calls per cycle (configurable)
- **Approval workflow** — Tesla, Robinhood, and Schlage actions require user confirmation
- **Kill switch** — File-based emergency stop (`~/.while-true-ai/data/.kill_switch`)
- **Budget guardrails** — Token and cost limits per call, minute, hour, day, and month
- **Tool call cap** — Chat messages limited to 10 tool iterations, agent actions to 20

### Memory

Three-tier memory system:

| Tier | Storage | Duration | Use |
|------|---------|----------|-----|
| **Short-term** | In-memory | Session (50 entries) | Recent conversation context |
| **Medium-term** | SQLite | 7 days (configurable) | Searchable history, full-text search |
| **Long-term** | Vector store | Persistent | Semantic search (future) |

Chat conversations, task outcomes, and observations are stored automatically.

## Development

```bash
# Run all tests
pnpm test

# Build all packages
pnpm build

# Clean build artifacts
pnpm clean

# Watch mode
pnpm dev

# Run a specific package's tests
pnpm --filter @while-true-ai/core test
pnpm --filter @while-true-ai/integrations test
```

### Project Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `pnpm start` | Run the CLI | Default interactive mode |
| `pnpm setup` | Setup wizard | Configure LLM provider |
| `pnpm build` | `turbo build` | Build all packages |
| `pnpm dev` | `turbo dev` | Watch mode |
| `pnpm test` | `turbo test` | Run all tests |
| `pnpm lint` | `turbo lint` | Lint all packages |
| `pnpm clean` | `turbo clean` | Clean build artifacts |

## License

MIT
