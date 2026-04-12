#!/bin/bash
# Kill any Expo web dev server running on port 8082 (or custom port).
# Usage: bash scripts/kill-expo-web.sh [port]

PORT="${1:-8082}"

if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
  # Windows (Git Bash / MSYS2)
  PID=$(netstat -ano 2>/dev/null | grep ":$PORT " | grep "LISTENING" | awk '{print $5}' | head -1)
  if [ -n "$PID" ]; then
    taskkill //PID "$PID" //T //F 2>/dev/null
    echo "Killed process tree rooted at PID $PID (port $PORT)"
  else
    echo "No process listening on port $PORT"
  fi
else
  # macOS / Linux
  PID=$(lsof -ti :"$PORT" 2>/dev/null | head -1)
  if [ -n "$PID" ]; then
    kill -9 "$PID" 2>/dev/null
    echo "Killed PID $PID (port $PORT)"
  else
    echo "No process listening on port $PORT"
  fi
fi
