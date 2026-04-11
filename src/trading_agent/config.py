from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional, Dict

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    nvidia_api_key: str
    nvidia_model: str
    nvidia_base_url: str
    tavily_api_key: str
    tavily_base_url: str
    tavily_topic: str
    tavily_search_depth: str
    memory_db_path: str
    use_proxy: bool
    proxy_address: Optional[str]
    proxy_port: Optional[int]
    connection_timeout: int


def get_proxy_settings() -> tuple[bool, Optional[str], int]:
    """Get proxy configuration independently (no API key validation)."""
    use_proxy = os.getenv("USE_PROXY", "false").lower() == "true"
    proxy_address = os.getenv("PROXY_ADDRESS", "").strip() if use_proxy else None
    proxy_port_str = os.getenv("PROXY_PORT", "8080").strip()
    proxy_port = int(proxy_port_str) if proxy_port_str.isdigit() else 8080
    
    return use_proxy, proxy_address, proxy_port


def get_proxy_dict() -> Optional[Dict[str, str]]:
    """Get proxy configuration for requests library."""
    use_proxy, proxy_address, proxy_port = get_proxy_settings()
    if use_proxy and proxy_address:
        proxy_url = f"http://{proxy_address}:{proxy_port}"
        return {
            "http": proxy_url,
            "https": proxy_url,
        }
    return None


def get_settings() -> Settings:
    api_key = os.getenv("NVIDIA_API_KEY", "").strip()
    if not api_key:
        raise ValueError("NVIDIA_API_KEY is required in environment.")
    tavily_api_key = os.getenv("TAVILY_API_KEY", "").strip()
    if not tavily_api_key:
        raise ValueError("TAVILY_API_KEY is required in environment.")
    
    # Parse proxy settings
    use_proxy, proxy_address, proxy_port = get_proxy_settings()
    
    connection_timeout = int(os.getenv("CONNECTION_TIMEOUT", "10"))
    
    return Settings(
        nvidia_api_key=api_key,
        nvidia_model=os.getenv("NVIDIA_MODEL", "meta/llama-3.1-70b-instruct"),
        nvidia_base_url=os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1"),
        tavily_api_key=tavily_api_key,
        tavily_base_url=os.getenv("TAVILY_BASE_URL", "https://api.tavily.com/search"),
        tavily_topic=os.getenv("TAVILY_TOPIC", "finance"),
        tavily_search_depth=os.getenv("TAVILY_SEARCH_DEPTH", "advanced"),
        memory_db_path=os.getenv("MEMORY_DB_PATH", "trading_memory.db"),
        use_proxy=use_proxy,
        proxy_address=proxy_address,
        proxy_port=proxy_port,
        connection_timeout=connection_timeout,
    )
