import os
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

if os.getenv("VERCEL") and not os.getenv("DATABASE_URL"):
    os.environ["DATABASE_URL"] = "sqlite:////tmp/candidate-recall-workbench.db"

from main import app  # noqa: E402
