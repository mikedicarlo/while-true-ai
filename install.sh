#!/usr/bin/env bash
set -euo pipefail

# ─── Colors ────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

info()    { echo -e "${CYAN}[info]${NC} $1"; }
success() { echo -e "${GREEN}[ok]${NC} $1"; }
warn()    { echo -e "${YELLOW}[warn]${NC} $1"; }
fail()    { echo -e "${RED}[error]${NC} $1"; exit 1; }

# ─── Banner ────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}"
echo "  ╦ ╦╦ ╦╦╦  ╔═╗  ╔╦╗╦═╗╦ ╦╔═╗  ╔═╗╦"
echo "  ║║║╠═╣║║  ║╣    ║ ╠╦╝║ ║║╣   ╠═╣║"
echo "  ╚╩╝╩ ╩╩╩═╝╚═╝   ╩ ╩╚═╚═╝╚═╝  ╩ ╩╩"
echo -e "${NC}"
echo -e "  ${BOLD}Autonomous AI Agent${NC}"
echo ""

# ─── Detect OS & Package Manager ──────────────────────────────
OS="$(uname -s)"
ARCH="$(uname -m)"

detect_pkg_manager() {
  if command -v brew &>/dev/null; then
    echo "brew"
  elif command -v apt-get &>/dev/null; then
    echo "apt"
  elif command -v dnf &>/dev/null; then
    echo "dnf"
  elif command -v yum &>/dev/null; then
    echo "yum"
  elif command -v pacman &>/dev/null; then
    echo "pacman"
  else
    echo "none"
  fi
}

PKG_MANAGER="$(detect_pkg_manager)"
info "Detected OS: ${OS} (${ARCH}), package manager: ${PKG_MANAGER}"

# ─── Check / Install Node.js ──────────────────────────────────
MIN_NODE_MAJOR=20

check_node() {
  if ! command -v node &>/dev/null; then
    return 1
  fi
  local version
  version="$(node -v | sed 's/^v//')"
  local major
  major="$(echo "$version" | cut -d. -f1)"
  if [ "$major" -ge "$MIN_NODE_MAJOR" ]; then
    return 0
  fi
  warn "Node.js ${version} found, but ${MIN_NODE_MAJOR}+ is required."
  return 1
}

install_node() {
  info "Installing Node.js..."

  # Prefer nvm if available
  if command -v nvm &>/dev/null || [ -s "$HOME/.nvm/nvm.sh" ]; then
    [ -s "$HOME/.nvm/nvm.sh" ] && source "$HOME/.nvm/nvm.sh"
    nvm install 22
    nvm use 22
    return
  fi

  # Prefer fnm if available
  if command -v fnm &>/dev/null; then
    fnm install 22
    fnm use 22
    return
  fi

  case "$PKG_MANAGER" in
    brew)
      brew install node@22
      ;;
    apt)
      # NodeSource setup for Ubuntu/Debian
      info "Adding NodeSource repository..."
      curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
      sudo apt-get install -y nodejs
      ;;
    dnf)
      sudo dnf install -y nodejs
      ;;
    yum)
      curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
      sudo yum install -y nodejs
      ;;
    pacman)
      sudo pacman -Sy --noconfirm nodejs npm
      ;;
    *)
      echo ""
      fail "Could not auto-install Node.js. Please install Node.js 20+ manually:\n  https://nodejs.org/en/download"
      ;;
  esac
}

if check_node; then
  success "Node.js $(node -v) found"
else
  install_node
  if check_node; then
    success "Node.js $(node -v) installed"
  else
    fail "Failed to install Node.js 20+. Please install manually: https://nodejs.org"
  fi
fi

# ─── Check / Install pnpm ─────────────────────────────────────
install_pnpm() {
  info "Installing pnpm..."
  if command -v corepack &>/dev/null; then
    corepack enable
    corepack prepare pnpm@latest --activate 2>/dev/null || npm install -g pnpm
  else
    npm install -g pnpm
  fi
}

if command -v pnpm &>/dev/null; then
  success "pnpm $(pnpm -v) found"
else
  install_pnpm
  if command -v pnpm &>/dev/null; then
    success "pnpm $(pnpm -v) installed"
  else
    fail "Failed to install pnpm. Run: npm install -g pnpm"
  fi
fi

# ─── Install Dependencies ─────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

info "Installing project dependencies..."
pnpm install --force
success "Dependencies installed"

# ─── Build Native Modules ─────────────────────────────────────
info "Building native modules..."
pnpm rebuild better-sqlite3 2>/dev/null || warn "better-sqlite3 rebuild skipped (may already be built)"
success "Native modules ready"

# ─── Build Project ─────────────────────────────────────────────
info "Building while-true-ai..."
pnpm build
success "Build complete"

# ─── Check for existing config ────────────────────────────────
CONFIG_DIR="${HOME}/.while-true-ai"
CONFIG_FILE="${CONFIG_DIR}/config.yaml"

if [ ! -f "$CONFIG_FILE" ]; then
  echo ""
  echo -e "${GREEN}${BOLD}Installation complete!${NC}"
  echo ""
  info "No configuration found. Starting setup wizard..."
  echo ""
  node packages/cli/dist/bin/while-true-ai.js --setup
  echo ""
else
  echo ""
  echo -e "${GREEN}${BOLD}Installation complete!${NC}"
  echo ""
  success "Existing configuration found at ${CONFIG_FILE}"
fi

# ─── Launch Web Dashboard ─────────────────────────────────────
PORT=4200

echo ""
echo -e "${BOLD}${CYAN}┌──────────────────────────────────────────────────────────┐${NC}"
echo -e "${BOLD}${CYAN}│                                                          │${NC}"
echo -e "${BOLD}${CYAN}│   ${GREEN}✓  while-true-ai is ready!${CYAN}                            │${NC}"
echo -e "${BOLD}${CYAN}│                                                          │${NC}"
echo -e "${BOLD}${CYAN}│   ${NC}${BOLD}Starting web dashboard:${CYAN}                               │${NC}"
echo -e "${BOLD}${CYAN}│                                                          │${NC}"
echo -e "${BOLD}${CYAN}│      ${NC}${BOLD}→  http://localhost:${PORT}${CYAN}                           │${NC}"
echo -e "${BOLD}${CYAN}│                                                          │${NC}"
echo -e "${BOLD}${CYAN}│   ${NC}${BOLD}Other ways to run:${CYAN}                                    │${NC}"
echo -e "${BOLD}${CYAN}│                                                          │${NC}"
echo -e "${BOLD}${CYAN}│   ${NC}  pnpm start              ${CYAN}${NC}${BOLD} Interactive CLI${CYAN}             │${NC}"
echo -e "${BOLD}${CYAN}│   ${NC}  pnpm start --web        ${CYAN}${NC}${BOLD} Web dashboard${CYAN}              │${NC}"
echo -e "${BOLD}${CYAN}│   ${NC}  pnpm start --headless   ${CYAN}${NC}${BOLD} Agent loop only${CYAN}            │${NC}"
echo -e "${BOLD}${CYAN}│   ${NC}  pnpm start --setup      ${CYAN}${NC}${BOLD} Reconfigure${CYAN}                │${NC}"
echo -e "${BOLD}${CYAN}│                                                          │${NC}"
echo -e "${BOLD}${CYAN}│   ${NC}${BOLD}Press Ctrl+C to stop the server.${CYAN}                       │${NC}"
echo -e "${BOLD}${CYAN}│                                                          │${NC}"
echo -e "${BOLD}${CYAN}└──────────────────────────────────────────────────────────┘${NC}"
echo ""

node packages/cli/dist/bin/while-true-ai.js --web --port $PORT
