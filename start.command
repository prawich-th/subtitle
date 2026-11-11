#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  Double-click this file to start the subtitle system on a Mac.
#
#  It installs what is needed the first time (needs internet once), starts the
#  program, and opens the operator page in your browser.
#  Keep the window that appears open during the show. Close it to stop.
# ─────────────────────────────────────────────────────────────────────────────

cd "$(dirname "$0")" || exit 1
export PATH="$HOME/.bun/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
PORT="${PORT:-8001}"
export PORT
URL="http://localhost:$PORT"

open_browser() { command -v open >/dev/null 2>&1 && open "$1"; }

finish() {
  echo
  read -n 1 -s -r -p "Press any key to close this window."
  echo
  exit "${1:-0}"
}

echo
echo "Starting the subtitle system…"
echo

# Already running? Just open the page.
if curl -fs "$URL/api/health" 2>/dev/null | grep -q subtitle; then
  echo "It is already running. Opening the operator page."
  open_browser "$URL/controller"
  finish 0
fi

# 1. Bun is the engine that runs the program. Install it once if it is missing.
if ! command -v bun >/dev/null 2>&1; then
  echo "First-time setup: installing Bun (needs internet, takes about a minute)…"
  if ! curl -fsSL https://bun.sh/install | bash; then
    echo
    echo "✗ Could not install Bun. Check the internet connection and try again."
    finish 1
  fi
  export PATH="$HOME/.bun/bin:$PATH"
fi

# 2. Download the program's building blocks (only does real work the first time).
if ! bun install; then
  if [ -d node_modules ]; then
    echo "⚠ Could not check for updates (no internet?). Using what is already installed."
  else
    echo
    echo "✗ First-time setup needs internet. Connect to the internet and try again."
    finish 1
  fi
fi

# 3. Prepare the web pages.
if ! bun run build; then
  if [ -f web/dist/index.html ]; then
    echo "⚠ Could not rebuild the pages. Using the previous version."
  else
    echo
    echo "✗ Could not prepare the web pages. Send a photo of this window to whoever looks after the program."
    finish 1
  fi
fi

# 4. Start. Open the operator page once the server answers.
(
  for _ in $(seq 1 40); do
    if curl -fs "$URL/api/health" >/dev/null 2>&1; then
      open_browser "$URL/controller"
      break
    fi
    sleep 0.25
  done
) &

# caffeinate stops the Mac from going to sleep while the show is running.
if command -v caffeinate >/dev/null 2>&1; then
  caffeinate -dims bun server/main.ts
else
  bun server/main.ts
fi

echo
echo "The subtitle system has stopped."
finish 0
