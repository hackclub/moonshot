#!/usr/bin/env python3
"""
INSTRUCTIONS:

1. REPLACE base_url

2. Create
  - export NEXTAUTH_SESSION_TOKEN=''
  - python3 scripts/seed_shop_items.py --from-file scripts/shop_items.json
3. Delete all
  - python3 scripts/seed_shop_items.py --delete-all

Notes
- The script auto-selects the correct cookie name by scheme (dev HTTP vs prod/staging HTTPS).
- The token must belong to an Admin whose email is in SHOP_ITEM_ADMIN_WHITELIST.

"""

import argparse
import json
import os
import sys
from typing import Any, Dict, List

try:
    import requests  # type: ignore
except ModuleNotFoundError:
    print(
        "Missing dependency: requests\n"
        "Install it with one of:\n"
        "  - python3 -m pip install --user requests\n"
        "  - python3 -m venv .venv && source .venv/bin/activate && pip install requests\n"
    )
    raise SystemExit(2)


DEFAULT_PRESET_ITEMS: List[Dict[str, Any]] = [
    {
        "name": "Test",
        "description": "A collection of exclusive Moonshot stickers.",
        "image": "/stardust.png",
        "price": 50,
        "usdCost": 5.00,
        "costType": "fixed",
        "useRandomizedPricing": False,
    },
]


def detect_cookie_name(base_url: str) -> str:
    override = os.environ.get("NEXTAUTH_COOKIE_NAME", "").strip()
    if override:
        return override
    # Heuristic: HTTPS origins use the __Secure- cookie name
    return "__Secure-next-auth.session-token" if base_url.lower().startswith("https://") else "next-auth.session-token"


def load_items_from_file(path: str) -> List[Dict[str, Any]]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValueError("JSON must be an array of items")
    return data


def create_item(session: requests.Session, base_url: str, item: Dict[str, Any]) -> requests.Response:
    url = f"{base_url.rstrip('/')}/api/admin/shop-items"
    return session.post(url, json=item, headers={"Content-Type": "application/json"}, timeout=30)


def main() -> int:
    parser = argparse.ArgumentParser(description="Manage Moonshot shop items via API")
    parser.add_argument(
        "--from-file",
        dest="from_file",
        help="Path to JSON file containing an array of item objects to create",
    )
    parser.add_argument(
        "--delete-all",
        dest="delete_all",
        action="store_true",
        help="Delete ALL shop items (admin + whitelist required)",
    )
    args = parser.parse_args()

    base_url = os.environ.get("BASE_URL", "https://moonshot.hackclub.com").strip()
    token = os.environ.get("NEXTAUTH_SESSION_TOKEN", "").strip()
    if not token:
        print("ERROR: NEXTAUTH_SESSION_TOKEN is required (copy it from your browser cookie).", file=sys.stderr)
        return 2

    cookie_name = detect_cookie_name(base_url)
    with requests.Session() as session:
        session.cookies.set(cookie_name, token)

        print(f"Using BASE_URL={base_url}")
        print(f"Using cookie {cookie_name} (length={len(token)})")

        if args.delete_all:
            # Delete all items
            return delete_all_flow(session, base_url)

        # Create flow
        items: List[Dict[str, Any]]
        if args.from_file:
            try:
                items = load_items_from_file(args.from_file)
            except Exception as e:
                print(f"ERROR: failed to load items from file: {e}", file=sys.stderr)
                return 2
        else:
            items = DEFAULT_PRESET_ITEMS

        print(f"Creating {len(items)} item(s)...\n")

        successes = 0
        for idx, item in enumerate(items, start=1):
            try:
                resp = create_item(session, base_url, item)
                ok = 200 <= resp.status_code < 300
                status = resp.status_code
                body = {}
                try:
                    body = resp.json()
                except Exception:
                    pass

                name = item.get("name", "<unnamed>")

                if ok:
                    successes += 1
                    print(f"[{idx}/{len(items)}] CREATED: {name} (status={status}) -> {body}")
                else:
                    print(f"[{idx}/{len(items)}] FAILED:  {name} (status={status}) -> {body}")

                # Helpful hints for common failures
                if status == 401:
                    print("  Hint: 401 Unauthorized - session token missing/invalid/expired or wrong cookie name.")
                elif status == 403:
                    print("  Hint: 403 Forbidden - user must be Admin and whitelisted in SHOP_ITEM_ADMIN_WHITELIST.")
                elif status == 400:
                    print("  Hint: 400 Bad Request - check required fields: name, description, price (>0).")

            except requests.RequestException as e:
                print(f"[{idx}/{len(items)}] ERROR: {e}")

        print(f"\nDone. Created {successes}/{len(items)} item(s).")
    return 0 if successes == len(items) else 1


def delete_all_flow(session: "requests.Session", base_url: str) -> int:
    items = list_items(session, base_url)
    total = len(items)
    if total == 0:
        print("No items to delete.")
        return 0

    print(f"Deleting {total} item(s)...\n")
    deleted = 0
    for idx, it in enumerate(items, start=1):
        item_id = it.get("id")
        name = it.get("name", "<unnamed>")
        try:
            resp = delete_item(session, base_url, item_id)
            ok = 200 <= resp.status_code < 300
            status = resp.status_code
            body = {}
            try:
                body = resp.json()
            except Exception:
                pass

            if ok:
                deleted += 1
                print(f"[{idx}/{total}] DELETED: {name} ({item_id}) status={status} -> {body}")
            else:
                print(f"[{idx}/{total}] FAILED:  {name} ({item_id}) status={status} -> {body}")

            if status == 401:
                print("  Hint: 401 Unauthorized - session token missing/invalid/expired or wrong cookie name.")
            elif status == 403:
                print("  Hint: 403 Forbidden - user must be Admin and whitelisted in SHOP_ITEM_ADMIN_WHITELIST.")

        except requests.RequestException as e:
            print(f"[{idx}/{total}] ERROR: {e}")

    print(f"\nDone. Deleted {deleted}/{total} item(s).")
    return 0 if deleted == total else 1


def list_items(session: "requests.Session", base_url: str) -> List[Dict[str, Any]]:
    url = f"{base_url.rstrip('/')}/api/admin/shop-items"
    resp = session.get(url, timeout=30)
    if not (200 <= resp.status_code < 300):
        print(f"ERROR: failed to list items: status={resp.status_code} body={resp.text}")
        if resp.status_code == 401:
            print("  Hint: 401 Unauthorized - session token missing/invalid/expired or wrong cookie name.")
        elif resp.status_code == 403:
            print("  Hint: 403 Forbidden - user must be Admin and whitelisted in SHOP_ITEM_ADMIN_WHITELIST.")
        return []
    try:
        data = resp.json()
    except Exception:
        return []
    return data.get("items", []) or []


def delete_item(session: "requests.Session", base_url: str, item_id: str) -> "requests.Response":
    url = f"{base_url.rstrip('/')}/api/admin/shop-items/{item_id}"
    return session.delete(url, timeout=30)


if __name__ == "__main__":
    raise SystemExit(main())


