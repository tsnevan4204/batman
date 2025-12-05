import argparse
import json
import os
import sys

from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.dirname(__file__)))

# Load backend/.env so the executor sees RPC/private key/domain settings
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from services.polymarket_executor import execute_order  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description="Test Polymarket executor for a given marketId.")
    parser.add_argument("--marketId", required=True, help="CLOB condition_id / market_id")
    parser.add_argument("--outcomeIndex", type=int, default=0, help="Outcome index (0 for Yes)")
    parser.add_argument("--side", choices=["buy", "sell"], default="buy")
    parser.add_argument("--size", type=float, default=1.0, help="Size in shares")
    parser.add_argument("--limitPrice", type=float, default=0.5, help="Limit price (0-1)")
    parser.add_argument("--dryRun", action="store_true", help="Do not submit to CLOB")
    args = parser.parse_args()

    print("[test] starting execute_order with args:", vars(args))
    result = execute_order(
        market_id=args.marketId,
        outcome_index=args.outcomeIndex,
        side=args.side,
        size=args.size,
        limit_price=args.limitPrice,
        dry_run=args.dryRun or True,
    )
    print("[test] result:")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

