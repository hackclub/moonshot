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
from typing import Any, Dict, List, Optional

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
        # Provide only USD cost; script will compute price using dollars/hour
        "usdCost": 5.00,
        "costType": "fixed",
        "useRandomizedPricing": True,
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


def fetch_global_config(session: "requests.Session", base_url: str) -> Dict[str, str]:
    """Fetch global config key/value map from the server."""
    url = f"{base_url.rstrip('/')}/api/admin/global-config"
    resp = session.get(url, timeout=30)
    if 200 <= resp.status_code < 300:
        try:
            data = resp.json()
            return data.get("config", {}) or {}
        except Exception:
            return {}
    return {}


def calculate_currency_price(usd_cost: float, dollars_per_hour: float) -> int:
    """Replicates lib/shop-utils.ts calculateCurrencyPrice.

    Formula: currency = round((usdCost / dollarsPerHour) * 256)
    """
    if dollars_per_hour <= 0:
        return 0
    hours = usd_cost / dollars_per_hour
    return int(round(hours * 256))


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
    parser.add_argument(
        "--dollars-per-hour",
        dest="dollars_per_hour",
        type=float,
        default=None,
        help="Override global dollars per hour when computing item price",
    )
    args = parser.parse_args()

    base_url = os.environ.get("BASE_URL", "http://localhost:3000").strip()
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

        # Determine dollars per hour to use
        override_dph: Optional[float] = args.dollars_per_hour
        if override_dph is None:
            try:
                cfg = fetch_global_config(session, base_url)
                dph_str = cfg.get("dollars_per_hour", "")
                override_dph = float(dph_str) if dph_str else None
            except Exception:
                override_dph = None

        # Fallback to 10 (same default used server-side in purchase route) to avoid failures
        if override_dph is None or override_dph <= 0:
            override_dph = 10.0

        print(f"Creating {len(items)} item(s)...\n")

        successes = 0
        for idx, item in enumerate(items, start=1):
            try:
                # Normalize input: treat existing 'price' as usdCost if usdCost missing
                if "usdCost" not in item or item.get("usdCost") in (None, 0, ""):
                    if "price" in item and item.get("price") not in (None, ""):
                        item["usdCost"] = float(item["price"])  # previous JSON used price for USD
                    # remove legacy field to avoid confusion; API requires computed price anyway
                item.pop("price", None)

                # Default cost type and randomized pricing
                item.setdefault("costType", "fixed")
                item.setdefault("useRandomizedPricing", True)

                # Compute shell price from usdCost using dollars/hour
                usd_cost_val = float(item.get("usdCost", 0) or 0)
                # Determine dollars/hour: prefer per-item config override for dynamic items
                dollars_per_hour = override_dph if override_dph is not None else 0.0
                if str(item.get("costType", "fixed")) == "config":
                    cfg = item.get("config") or {}
                    if isinstance(cfg, dict) and "dollars_per_hour" in cfg:
                        try:
                            dollars_per_hour = float(cfg["dollars_per_hour"])  # type: ignore
                        except Exception:
                            pass
                computed_price = calculate_currency_price(usd_cost_val, dollars_per_hour)

                if computed_price <= 0:
                    # As a last resort, use default 10 $/hour to compute a positive price
                    computed_price = calculate_currency_price(usd_cost_val, 10.0)

                # Build payload expected by the API
                payload = {
                    "name": item.get("name"),
                    "description": item.get("description"),
                    "image": item.get("image") or None,
                    "price": computed_price,
                    "usdCost": usd_cost_val,
                    "costType": item.get("costType", "fixed"),
                    "config": item.get("config") or None,
                    "useRandomizedPricing": bool(item.get("useRandomizedPricing", True)),
                }

                # Optional inventory constraints
                if "maxInventory" in item and item["maxInventory"] not in (None, ""):
                    payload["maxInventory"] = int(item["maxInventory"])  # type: ignore
                if "maxPurchasesPerUser" in item and item["maxPurchasesPerUser"] not in (None, ""):
                    payload["maxPurchasesPerUser"] = int(item["maxPurchasesPerUser"])  # type: ignore

                resp = create_item(session, base_url, payload)
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


