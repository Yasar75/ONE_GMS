from pathlib import Path
import sys


# Vercel imports this file directly by path, so we add the backend
# directory to sys.path before importing the src package.
CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

from src.main import app
