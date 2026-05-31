#!/bin/bash
# Run on Render startup — init DB then start server
python -c "from database import init_db; init_db(); print('DB ready')"
exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
