#!/bin/bash
set -e
cd /app/backend || cd backend
# Activate virtual environment if it exists
if [ -d "venv" ]; then
  source venv/bin/activate
fi
# Increase timeout to 120 seconds for database initialization and email sending
exec python3 -m gunicorn app:app --bind 0.0.0.0:${PORT:-5000} --timeout 120 --workers 2

