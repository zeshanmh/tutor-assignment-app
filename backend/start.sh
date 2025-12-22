#!/bin/bash
set -e
cd /app/backend || cd backend
exec python3 -m gunicorn app:app --bind 0.0.0.0:${PORT:-5000}

