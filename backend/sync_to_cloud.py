"""
Local GCC Sync Script
Run this on dad's PC every morning (or double-click sync_gcc.bat)

What it does:
  1. Opens Chrome invisibly, logs into GCC
  2. Exports today's work orders
  3. Writes them directly to Supabase (cloud DB)
  4. Dashboard on any device shows fresh data instantly
"""
import asyncio
import sys
import os
import json
import pandas as pd
from datetime import datetime, date
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# ── Config ────────────────────────────────────────────────────────────────
NEON_URL = "postgresql://neondb_owner:npg_xnil7mGXe3uh@ep-cool-flower-aouv20eg.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
GCC_EMAIL    = "hgins01105@gcc.haier.net"
GCC_PASSWORD = os.getenv("GCC_PASSWORD", "")   # set in .env or env var
D365_URL     = "https://haiergccin.crm8.dynamics.com"
DOWNLOAD_DIR = Path("./sync_downloads")
DOWNLOAD_DIR.mkdir(exist_ok=True)
EDGE_PATH    = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
COOKIE_FILE  = Path("gcc_session.json")

# ── Load from .env if available ───────────────────────────────────────────
try:
    from dotenv import load_dotenv
    load_dotenv()
    GCC_PASSWORD = os.getenv("GCC_PASSWORD", GCC_PASSWORD)
except ImportError:
    pass

if not GCC_PASSWORD:
    GCC_PASSWORD = input("Enter GCC password: ").strip()


# ── DB setup ──────────────────────────────────────────────────────────────
engine = create_engine(NEON_URL, pool_pre_ping=True)
Session = sessionmaker(bind=engine)

# Import models (from same directory)
sys.path.insert(0, str(Path(__file__).parent))
from models import Job, Technician, SyncLog, Base
Base.metadata.create_all(bind=engine)


# ── GCC automation ────────────────────────────────────────────────────────
async def login_and_export():
    from playwright.async_api import async_playwright
    import re

    print("  Opening GCC in background browser...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path=EDGE_PATH,
            headless=True,
            args=["--no-sandbox"]
        )
        ctx = await browser.new_context(accept_downloads=True)

        # Reuse saved session if available
        if COOKIE_FILE.exists():
            try:
                cookies = json.loads(COOKIE_FILE.read_text())
                await ctx.add_cookies(cookies)
                print("  Using saved session...")
            except Exception:
                pass

        page = await ctx.new_page()

        # Navigate directly to India D365 instance
        await page.goto(D365_URL, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(2000)

        # Login if needed
        if "login.microsoftonline" in page.url or "gcc.haier.net" in page.url:
            print("  Logging into GCC...")
            try:
                await page.wait_for_selector("input[type='email'], input[name='loginfmt']", timeout=15000)
                await page.fill("input[type='email'], input[name='loginfmt']", GCC_EMAIL)
                await page.keyboard.press("Enter")
                await page.wait_for_timeout(2000)
                await page.fill("input[type='password'], input[name='passwd']", GCC_PASSWORD)
                await page.keyboard.press("Enter")
                await page.wait_for_timeout(4000)

                # "Stay signed in?" → No
                try:
                    btn = page.locator("input[id='idBtn_Back'], button:has-text('No')")
                    if await btn.count() > 0:
                        await btn.first.click()
                        await page.wait_for_timeout(2000)
                except Exception:
                    pass

                # Wait for D365 to load
                for _ in range(30):
                    await page.wait_for_timeout(1000)
                    if "dynamics.com/main.aspx" in page.url:
                        break

                # Save session
                cookies = await ctx.cookies()
                COOKIE_FILE.write_text(json.dumps(cookies))
                print("  Login successful, session saved.")
            except Exception as e:
                print(f"  Login failed: {e}")
                await browser.close()
                return None

        # Navigate to work orders list
        print("  Loading work orders list...")
        wo_url = (
            f"{D365_URL}/main.aspx"
            "?appid=4480e191-a429-ec11-b6e6-000d3a80f6f0"
            "&pagetype=entitylist&etn=mcs_workorder"
        )
        await page.goto(wo_url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(5000)

        # Export to Excel
        print("  Exporting to Excel...")
        export_btn = page.locator("button:has-text('Export to Excel'), [aria-label*='Export to Excel']")
        await export_btn.first.wait_for(timeout=15000)

        async with page.expect_download(timeout=90000) as dl_info:
            await export_btn.first.click()
            await page.wait_for_timeout(1500)
            static = page.locator("button:has-text('Static worksheet'), li:has-text('Static worksheet')")
            if await static.count() > 0:
                await static.first.click()

        download = await dl_info.value
        excel_path = DOWNLOAD_DIR / download.suggested_filename
        await download.save_as(excel_path)
        print(f"  Downloaded: {excel_path.name}")

        await browser.close()
        return excel_path


def parse_and_upsert(excel_path: Path) -> dict:
    """Parse Excel export and upsert into Supabase."""
    df = pd.read_excel(excel_path, header=0)
    df.columns = [str(c).strip() for c in df.columns]

    db = Session()
    stats = {"new": 0, "updated": 0, "total": 0}
    today = date.today()

    def safe_dt(val):
        if pd.isna(val): return None
        try: return pd.to_datetime(val).to_pydatetime().replace(tzinfo=None)
        except: return None

    for _, row in df.iterrows():
        wo = str(row.get("Work order#", "")).strip()
        gcc_id = str(row.get("(Do Not Modify) Work Order", "")).strip()
        if not wo or wo == "nan":
            continue

        stats["total"] += 1
        existing = db.query(Job).filter_by(work_order_no=wo).first()
        mod_date = safe_dt(row.get("(Do Not Modify) Modified On"))

        data = dict(
            id=gcc_id if gcc_id != "nan" else wo,
            work_order_no=wo,
            display_type=str(row.get("Work Order Display Type", "Normal")).strip(),
            priority=str(row.get("Priority", "Normal")).strip(),
            status=str(row.get("Status", "")).strip(),
            sub_status=str(row.get("Sub-status", "")).strip(),
            customer_name=None if pd.isna(row.get("Contact", "")) else str(row["Contact"]).strip(),
            product_group=None if pd.isna(row.get("Product Group", "")) else str(row["Product Group"]).strip(),
            local_category=None if pd.isna(row.get("Local Category", "")) else str(row["Local Category"]).strip(),
            model=None if pd.isna(row.get("Model", "")) else str(row["Model"]).strip(),
            serial_number=None if pd.isna(row.get("Serial Number", "")) else str(row["Serial Number"]).strip(),
            l1=None if pd.isna(row.get("L1", "")) else str(row["L1"]).strip(),
            service_type=None if pd.isna(row.get("Service Type", "")) else str(row["Service Type"]).strip(),
            gcc_created_at=safe_dt(row.get("Created On")),
            gcc_updated_at=mod_date,
            is_carry_forward=bool(mod_date and mod_date.date() < today),
            synced_at=datetime.now(),
        )

        if existing:
            for k, v in data.items():
                setattr(existing, k, v)
            stats["updated"] += 1
        else:
            db.add(Job(**data))
            stats["new"] += 1

    db.commit()

    # Log the sync
    log = SyncLog(
        jobs_fetched=stats["total"],
        jobs_new=stats["new"],
        jobs_updated=stats["updated"],
        status="success",
    )
    db.add(log)
    db.commit()
    db.close()
    return stats


async def main():
    print()
    print("=" * 50)
    print("  GCC → Supabase Sync")
    print(f"  {datetime.now().strftime('%d %b %Y, %I:%M %p')}")
    print("=" * 50)
    print()

    excel_path = await login_and_export()
    if not excel_path:
        print("  Sync failed at export step.")
        return

    print("  Syncing to cloud database...")
    stats = parse_and_upsert(excel_path)

    print()
    print("=" * 50)
    print(f"  DONE! {stats['total']} jobs synced")
    print(f"  {stats['new']} new  |  {stats['updated']} updated")
    print("  Dashboard will show fresh data now.")
    print("=" * 50)
    print()


if __name__ == "__main__":
    asyncio.run(main())
