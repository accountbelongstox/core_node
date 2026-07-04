import os
import json
import sys
import argparse
from datetime import datetime
from pathlib import Path
import requests

def get_claude_session_token():
    """
    Locates and extracts the official active OAuth/session token 
    from the local Claude Code configurations directory.
    """
    home = Path.home()
    # Official path variants where Claude Code stores authentication payloads
    possible_paths = [
        home / ".claude" / "config.json",
        home / ".config" / "claude" / "config.json",
        home / "AppData" / "Roaming" / "claude" / "config.json"  # Windows alternative
    ]
    
    for path in possible_paths:
        if path.exists():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    config_data = json.load(f)
                    # Check common token key wrappers used by Claude CLI
                    token = config_data.get("oauth_token") or config_data.get("token") or config_data.get("auth", {}).get("access_token")
                    if token:
                        return token
            except Exception as e:
                print(f"[-] Warning: Failed to parse configuration file at {path}: {e}", file=sys.stderr)
                
    return None

def fetch_account_wide_usage(token, date_str, limit=100):
    """
    Queries Anthropic's Admin endpoint using the extracted active session token.
    """
    url = "https://api.anthropic.com/v1/organizations/usage_report/claude_code"
    
    headers = {
        "Authorization": f"Bearer {token}",
        "anthropic-version": "2023-06-01",  # Required spec header
        "content-type": "application/json"
    }
    
    params = {
        "starting_at": date_str,
        "limit": limit
    }
    
    all_records = []
    
    try:
        print(f"[*] Validating session and retrieving metrics for date: {date_str}...")
        while True:
            response = requests.get(url, headers=headers, params=params)
            
            if response.status_code == 401:
                print("[-] Error: Unauthorized. Your official local session may have expired. Please re-run 'claude auth'.", file=sys.stderr)
                return None
            elif response.status_code != 200:
                print(f"[-] API Error ({response.status_code}): {response.text}", file=sys.stderr)
                return None
                
            payload = response.json()
            records = payload.get("data", [])
            all_records.extend(records)
            
            if payload.get("has_more") and payload.get("next_page"):
                params["page"] = payload["next_page"]
            else:
                break
                
        return all_records

    except requests.exceptions.RequestException as e:
        print(f"[-] Connection issue: {e}", file=sys.stderr)
        return None

def generate_report(records):
    """
    Parses and summarizes usage across all client profiles.
    """
    if not records:
        print("[!] No multi-client usage found for this specific date range.")
        return

    print("\n" + "="*85)
    print(f"{'CLIENT / IDENTITY PROFILE':<45} | {'INPUT TOKENS':<12} | {'OUTPUT TOKENS':<12}")
    print("="*85)

    grand_input = 0
    grand_output = 0

    for record in records:
        actor = record.get("actor", {})
        metrics = record.get("core_metrics", {})
        
        # Resolving profile identifier (Email for Web/Pro users, Machine tags or Key names for others)
        if actor.get("type") == "user_actor":
            identity = actor.get("email_address", "Unknown Active Session")
        elif actor.get("type") == "api_actor":
            identity = f"API Client: {actor.get('api_key_name', 'Unnamed Connection')}"
        else:
            identity = f"Client ID: {actor.get('id', 'Unknown Device')}"

        input_tokens = metrics.get("input_tokens", 0)
        output_tokens = metrics.get("output_tokens", 0)
        
        grand_input += input_tokens
        grand_output += output_tokens
        
        print(f"{identity:<45} | {input_tokens:<12,} | {output_tokens:<12,}")

    print("="*85)
    print(f"{'TOTAL ACCOUNT-WIDE ACCRUED USAGE':<45} | {grand_input:<12,} | {grand_output:<12,}")
    print("="*85 + "\n")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extract active official session and fetch all client metrics.")
    parser.add_argument(
        "--date", 
        type=str, 
        default=datetime.utcnow().strftime("%Y-%m-%d"),
        help="Target date in YYYY-MM-DD format (Default: Today UTC)"
    )
    args = parser.parse_args()

    # Step 1: Automatically find token from active `claude auth`
    session_token = get_claude_session_token()
    if not session_token:
        print("[-] Error: Could not find an active Claude session token on this machine.", file=sys.stderr)
        print("[*] Please open your terminal and run 'claude auth' first to sign in.", file=sys.stderr)
        sys.exit(1)
        
    # Step 2: Fetch and display the cross-client tracking report
    usage_data = fetch_account_wide_usage(session_token, args.date)
    if usage_data is not None:
        generate_report(usage_data)
