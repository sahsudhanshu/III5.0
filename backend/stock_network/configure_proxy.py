#!/usr/bin/env python3
"""
Setup proxy configuration for stock data fetching
Run this to configure proxy settings
"""

import os
import sys
from pathlib import Path

def setup_proxy():
    """Interactive proxy setup."""
    
    print("\n" + "="*60)
    print("PROXY CONFIGURATION SETUP".center(60))
    print("="*60 + "\n")
    
    print("If your network requires a proxy, enter the details below.")
    print("(Press Enter to skip or use direct connection)\n")
    
    # Check if already configured
    env_file = Path(".env")
    if env_file.exists():
        print("✓ .env file already exists")
        print("  Current settings:")
        with open(env_file) as f:
            for line in f:
                if "PROXY" in line:
                    print(f"    {line.strip()}")
        print()
    
    # Ask for proxy settings
    use_proxy = input("🔌 Enable proxy? (y/n, default: n): ").lower().strip()
    
    if use_proxy != 'y':
        print("\n✓ Proxy disabled. System will use direct connection.")
        settings = {
            "USE_PROXY": "false"
        }
    else:
        proxy_addr = input("📍 Proxy Address (default: 172.31.2.4): ").strip() or "172.31.2.4"
        proxy_port = input("🔌 Proxy Port (default: 8080): ").strip() or "8080"
        
        settings = {
            "USE_PROXY": "true",
            "PROXY_ADDRESS": proxy_addr,
            "PROXY_PORT": proxy_port
        }
        
        print(f"\n✓ Proxy configured: {proxy_addr}:{proxy_port}")
    
    # Write to .env file
    print("\n💾 Writing configuration to .env...")
    
    env_content = "# Proxy Configuration\n"
    env_content += f"USE_PROXY={settings['USE_PROXY']}\n"
    
    if "PROXY_ADDRESS" in settings:
        env_content += f"PROXY_ADDRESS={settings['PROXY_ADDRESS']}\n"
        env_content += f"PROXY_PORT={settings['PROXY_PORT']}\n"
    
    # Append to .env
    with open(".env", "a") as f:
        f.write("\n" + env_content)
    
    print("✓ Configuration saved to .env\n")
    
    # Show how to use
    print("="*60)
    print("NEXT STEPS".center(60))
    print("="*60 + "\n")
    
    print("1. Start the Streamlit app:")
    print("   streamlit run stock_network/app.py\n")
    
    print("2. Or use the demo script:")
    print("   python stock_network/demo.py AAPL,MSFT\n")
    
    print("If you need to change proxy settings later, edit .env")
    print("="*60 + "\n")


def test_proxy():
    """Test if proxy is working."""
    print("\n🧪 Testing proxy connection...\n")
    
    try:
        import requests
        
        proxy_addr = os.environ.get("PROXY_ADDRESS", "172.31.2.4")
        proxy_port = os.environ.get("PROXY_PORT", "8080")
        proxy_url = f"http://{proxy_addr}:{proxy_port}"
        proxies = {"http": proxy_url, "https": proxy_url}
        
        # Try a simple request
        response = requests.get("http://httpbin.org/delay/0", proxies=proxies, timeout=5)
        
        if response.status_code == 200:
            print(f"✅ Proxy connection successful!")
            print(f"   Address: {proxy_addr}:{proxy_port}\n")
            return True
        else:
            print(f"⚠️  Proxy returned status {response.status_code}\n")
            return False
    
    except Exception as e:
        print(f"❌ Proxy connection failed: {e}\n")
        return False


def main():
    """Main entry point."""
    
    import argparse
    parser = argparse.ArgumentParser(description="Configure proxy settings")
    parser.add_argument("--test", action="store_true", help="Test proxy connection")
    parser.add_argument("--setup", action="store_true", help="Interactive setup")
    
    args = parser.parse_args()
    
    if args.test:
        test_proxy()
    elif args.setup or (not args.test):
        setup_proxy()
        if input("\n🧪 Test proxy connection? (y/n, default: n): ").lower() == 'y':
            test_proxy()


if __name__ == "__main__":
    main()
