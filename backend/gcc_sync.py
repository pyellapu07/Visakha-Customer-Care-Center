"""
GCC Sync Module
Handles data extraction from GCC (haiergccin.crm8.dynamics.com)

Strategy:
  1. Session-based: Login with Playwright, extract auth cookies,
     then use those cookies to call the Dynamics 365 OData API directly.
  2. Fallback: Export-to-Excel automation if API access is restricted.
"""

import os
import json
import asyncio
import httpx

try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False
from datetime import datetime
from pathlib import Path
from typing import Optional

GCC_BASE = "https://haiergccin.crm8.dynamics.com"
GCC_API  = f"{GCC_BASE}/api/data/v9.2"
GCC_LOGIN_URL = "https://gcc.haier.net"
GCC_EMAIL    = os.getenv("GCC_EMAIL", "hgins01105@gcc.haier.net")
GCC_PASSWORD = os.getenv("GCC_PASSWORD", "")   # Set in .env, never hardcode

COOKIE_FILE = Path("gcc_session.json")


# ─── Playwright session login ──────────────────────────────────────────────

async def login_and_save_session():
    """Login to GCC via browser, save session cookies for API reuse."""
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        raise RuntimeError("playwright not installed: pip install playwright && playwright install chromium")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context()
        page = await ctx.new_page()

        print("[GCC] Opening login page...")
        await page.goto(GCC_LOGIN_URL, wait_until="networkidle")

        # Fill Microsoft / Haier SSO login
        await page.fill("input[type='email'], input[name='loginfmt']", GCC_EMAIL)
        await page.keyboard.press("Enter")
        await page.wait_for_timeout(2000)

        try:
            await page.fill("input[type='password'], input[name='passwd']", GCC_PASSWORD)
            await page.keyboard.press("Enter")
        except Exception:
            pass

        # Wait for redirect to Dynamics
        await page.wait_for_url(f"*{GCC_BASE}*", timeout=30000)
        await page.wait_for_load_state("networkidle")

        cookies = await ctx.cookies()
        COOKIE_FILE.write_text(json.dumps(cookies))
        print(f"[GCC] Session saved ({len(cookies)} cookies)")

        await browser.close()
        return cookies


def load_cookies() -> Optional[list]:
    if COOKIE_FILE.exists():
        return json.loads(COOKIE_FILE.read_text())
    return None


def cookies_to_header(cookies: list) -> dict:
    cookie_str = "; ".join(f"{c['name']}={c['value']}" for c in cookies)
    return {"Cookie": cookie_str}


# ─── OData API calls ───────────────────────────────────────────────────────

WORK_ORDER_SELECT = ",".join([
    "mcs_name",              # Work order#
    "mcs_workorderdisplaytype",
    "mcs_priority",
    "mcs_status",
    "mcs_substatus",
    "mcs_substatuscomments",
    "mcs_workordersource",
    "createdon",
    "modifiedon",
    "mcs_requiredservicedate",
    "mcs_timeperiod",
    "mcs_appointmenttime",
    "mcs_repairtype",
    "mcs_servicetype",
    "mcs_serviceclass",
    "mcs_l1",
    "mcs_customerdescription",
    "mcs_productivity",
    "mcs_mileage",
    "mcs_settlementstatus",
    "mcs_casenumber",
    "mcs_longitude",
    "mcs_latitude",
])

CONTACT_SELECT = ",".join([
    "firstname", "lastname", "mobilephone", "telephone1",
    "address1_postalcode", "address1_city", "address1_stateorprovince",
    "mcs_locality", "address1_line1",
])


async def fetch_open_work_orders(cookies: list) -> list:
    """Fetch all open work orders from GCC OData API."""
    headers = {
        **cookies_to_header(cookies),
        "Accept": "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
        "Prefer": 'odata.maxpagesize=500,odata.include-annotations="*"',
    }

    # Filter: our service center, active statuses
    filter_q = (
        "mcs_servicecenter/mcs_name eq 'Visakha Customer Care Center' and "
        "mcs_status ne 'Closed' and mcs_status ne 'Cancelled'"
    )

    url = (
        f"{GCC_API}/mcs_workorders"
        f"?$select={WORK_ORDER_SELECT}"
        f"&$filter={filter_q}"
        f"&$expand=mcs_contactid($select={CONTACT_SELECT}),mcs_assignedtechnicianid($select=mcs_name,mcs_jobcardno)"
        f"&$orderby=createdon desc"
    )

    all_jobs = []
    async with httpx.AsyncClient(verify=False, timeout=60) as client:
        while url:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 401:
                raise PermissionError("GCC session expired — re-login required")
            resp.raise_for_status()
            data = resp.json()
            all_jobs.extend(data.get("value", []))
            url = data.get("@odata.nextLink")

    print(f"[GCC] Fetched {len(all_jobs)} open work orders")
    return all_jobs


async def fetch_technicians(cookies: list) -> list:
    """Fetch all active technicians for Visakha service center."""
    headers = {
        **cookies_to_header(cookies),
        "Accept": "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
    }

    select = "mcs_name,mcs_jobcardno,mobilephone,mcs_skilllevel,mcs_type,mcs_status,mcs_performancescore,mcs_occupiedwoservicetime"
    filter_q = "mcs_servicecenter/mcs_name eq 'Visakha Customer Care Center' and mcs_status eq 'Active'"

    url = f"{GCC_API}/mcs_personnels?$select={select}&$filter={filter_q}"

    techs = []
    async with httpx.AsyncClient(verify=False, timeout=60) as client:
        resp = await client.get(url, headers=headers)
        if resp.status_code in (401, 403):
            raise PermissionError("Cannot fetch technicians — insufficient GCC permissions")
        resp.raise_for_status()
        techs = resp.json().get("value", [])

    print(f"[GCC] Fetched {len(techs)} technicians")
    return techs


async def assign_technician_in_gcc(work_order_id: str, technician_gcc_id: str, cookies: list) -> bool:
    """Write technician assignment back to GCC."""
    headers = {
        **cookies_to_header(cookies),
        "Content-Type": "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
        "If-Match": "*",
    }

    payload = {
        "mcs_assignedtechnicianid@odata.bind": f"/mcs_personnels({technician_gcc_id})"
    }

    url = f"{GCC_API}/mcs_workorders({work_order_id})"
    async with httpx.AsyncClient(verify=False, timeout=30) as client:
        resp = await client.patch(url, headers=headers, json=payload)
        return resp.status_code == 204


# ─── Excel export fallback ────────────────────────────────────────────────

async def export_via_browser(download_dir: str = "./downloads") -> Optional[str]:
    """
    Fallback: Automate the GCC Export to Excel button.
    Returns path to downloaded file.
    """
    from playwright.async_api import async_playwright

    Path(download_dir).mkdir(exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(accept_downloads=True)

        cookies = load_cookies()
        if cookies:
            await ctx.add_cookies(cookies)

        page = await ctx.new_page()
        work_order_list_url = (
            f"{GCC_BASE}/main.aspx?appid=4480e191-a429-ec11-b6e6-000d3a80f6f0"
            f"&pagetype=entitylist&etn=mcs_workorder"
        )
        await page.goto(work_order_list_url, wait_until="networkidle")

        async with page.expect_download() as dl:
            await page.click("button:has-text('Export to Excel')")

        download = await dl.value
        path = f"{download_dir}/{download.suggested_filename}"
        await download.save_as(path)
        await browser.close()

        print(f"[GCC] Downloaded: {path}")
        return path


def parse_excel_export(filepath: str) -> list[dict]:
    """Parse GCC Excel export into list of job dicts."""
    df = pd.read_excel(filepath, header=1)
    df.columns = [c.strip() for c in df.columns]
    jobs = []
    for _, row in df.iterrows():
        if pd.isna(row.get("Work order#")):
            continue
        jobs.append({
            "work_order_no": row.get("Work order#"),
            "display_type": row.get("Work Order Display Type"),
            "priority": row.get("Priority"),
            "status": row.get("Status"),
            "sub_status": row.get("Sub-status"),
            "customer_name": row.get("Contact"),
            "product_group": row.get("Product Group"),
            "local_category": row.get("Local Category"),
            "model": row.get("Model"),
            "serial_number": row.get("Serial Number"),
            "date_of_purchase": row.get("Date of Purchase"),
            "l1": row.get("L1"),
            "service_type": row.get("Service Type"),
            "gcc_created_at": row.get("Created On"),
        })
    return jobs


# ─── Master sync orchestrator ─────────────────────────────────────────────

async def run_sync(db_session) -> dict:
    """Full sync: login → fetch → upsert DB → return stats."""
    from gcc_mapper import map_job, map_technician

    stats = {"jobs_fetched": 0, "jobs_new": 0, "jobs_updated": 0,
             "technicians_fetched": 0, "status": "success", "error": None}
    try:
        cookies = load_cookies()
        if not cookies:
            cookies = await login_and_save_session()

        # Try OData API first
        try:
            raw_jobs = await fetch_open_work_orders(cookies)
            raw_techs = await fetch_technicians(cookies)
        except PermissionError:
            # Fallback: re-login and retry once
            cookies = await login_and_save_session()
            raw_jobs = await fetch_open_work_orders(cookies)
            raw_techs = await fetch_technicians(cookies)

        stats["jobs_fetched"] = len(raw_jobs)
        stats["technicians_fetched"] = len(raw_techs)

        for raw in raw_techs:
            map_technician(raw, db_session)

        for raw in raw_jobs:
            result = map_job(raw, db_session)
            stats[f"jobs_{result}"] = stats.get(f"jobs_{result}", 0) + 1

        db_session.commit()

    except Exception as e:
        stats["status"] = "error"
        stats["error"] = str(e)
        db_session.rollback()

    return stats
