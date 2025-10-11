import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

_client: Client | None = None

def get_supabase() -> Client:
	global _client
	if _client is not None:
		return _client
	# Load environment variables from common locations to be robust to CWD
	# 1) Current working directory .env (default)
	load_dotenv()
	# 2) backend/.env next to this file
	backend_env = Path(__file__).with_name('.env')
	if backend_env.exists():
		load_dotenv(dotenv_path=backend_env, override=False)
	# 3) Project root .env (one level up from backend/)
	project_root_env = Path(__file__).resolve().parent.parent / '.env'
	if project_root_env.exists():
		load_dotenv(dotenv_path=project_root_env, override=False)
	url = os.getenv("SUPABASE_URL")
	key = os.getenv("SUPABASE_SERVICE_ROLE") or os.getenv("SUPABASE_ANON_KEY")
	if not url or not key:
		raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE (or ANON) must be set via environment variables or in a .env file (project root or backend/.env)")
	_client = create_client(url, key)
	return _client
