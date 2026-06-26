name = "候选人智能召回工作台"
version = "1.0.0"

[build]
command = """
  cd frontend && npm ci && npm run build && cd ..
  cd backend && pip install -r requirements.txt
"""

[run]
command = "cd backend && python3 -m uvicorn main:app --host 0.0.0.0 --port 8000"
