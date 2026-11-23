import os
from dataclasses import dataclass

def _get(name: str, default: str = "") -> str:
    return os.environ.get(name, default)

@dataclass
class Settings:
    hydra_api_key: str = ""
    hydra_database: str = "throughline_demo"
    hydra_collection: str = "northstar_knowledge"
    hydra_memory_collection: str = "approvals_memory"
    openai_api_key: str = ""
    openai_model: str = "gpt-6-luna"
    openai_reasoning_effort: str = "none"
    rate_limit_analyze_per_day: int = 10
    trust_proxy_headers: bool = False
    data_dir: str = ""
    sqlite_path: str = ""
    backend_port: int = 8000

def load_settings() -> Settings:
    from dotenv import load_dotenv
    load_dotenv()
    base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    # backend/ -> repo root
    root = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
    s = Settings()
    s.hydra_api_key = os.environ.get("HYDRA_DB_API_KEY", "")
    s.hydra_database = os.environ.get("HYDRA_DATABASE", "throughline_demo")
    s.hydra_collection = os.environ.get("HYDRA_COLLECTION", "northstar_knowledge")
    s.hydra_memory_collection = os.environ.get("HYDRA_MEMORY_COLLECTION", "approvals_memory")
    s.openai_api_key = os.environ.get("OPENAI_API_KEY", "")
    s.openai_model = os.environ.get("OPENAI_MODEL", "gpt-6-luna")
    # "none" lets reasoning models use function tools on chat completions.
    # Set it empty for non-reasoning models (e.g. gpt-4.1-mini), which reject it.
    s.openai_reasoning_effort = os.environ.get("OPENAI_REASONING_EFFORT", "none")
    # Max analyses (the only route that calls OpenAI) per client IP per UTC day; 0 disables.
    s.rate_limit_analyze_per_day = int(os.environ.get("RATE_LIMIT_ANALYZE_PER_DAY", "10") or 0)
    # Only trust X-Forwarded-For when running behind a proxy you control.
    s.trust_proxy_headers = os.environ.get("TRUST_PROXY_HEADERS", "").lower() in ("1", "true", "yes")
    s.data_dir = os.environ.get("DATA_DIR", os.path.join(root, "data"))
    s.sqlite_path = os.environ.get("SQLITE_PATH", os.path.join(root, "data", "throughline.db"))
    return s

settings = load_settings()
