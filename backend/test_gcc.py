"""
GCC Integration Test Suite
Tests: login, navigation, data export, work order detail scraping, technician list
Run: python test_gcc.py
"""
import asyncio
import json
import os
import sys
import pandas as pd
from pathlib import Path
from datetime import datetime

GCC_URL      = "https://gcc.haier.net"
D365_URL     = "https://haiergccin.crm8.dynamics.com"
GCC_EMAIL    = "hgins01105@gcc.haier.net"
GCC_PASSWORD = os.getenv("GCC_PASSWORD", "Vizag@123")   # override via env var
DOWNLOAD_DIR = Path("./test_downloads")
DOWNLOAD_DIR.mkdir(exist_ok=True)

PASS = "[PASS]"
FAIL = "[FAIL]"
INFO = "[INFO]"

results = []
ACTUAL_D365 = "https://haiergccin.crm8.dynamics.com"  # updated after login

def log(status, test, detail=""):
    msg = f"{status} {test}"
    if detail:
        msg += f"\n       {detail}"
    print(msg)
    results.append({"test": test, "status": status, "detail": detail})


async def run_tests():
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        # Use system Edge (already installed) — more reliable on Windows than Playwright Chromium
        EDGE_PATH = (
            "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
        )
        browser = await p.chromium.launch(
            executable_path=EDGE_PATH,
            headless=False,          # visible so we can watch it work
            slow_mo=400,             # slight delay so we can see each step
            args=["--start-maximized", "--no-sandbox"]
        )
        ctx = await browser.new_context(
            viewport={"width": 1400, "height": 900},
            accept_downloads=True,
        )
        page = await ctx.new_page()

        # ── TEST 1: Login ──────────────────────────────────────────────────
        print("\n" + "="*60)
        print("TEST 1: GCC Login")
        print("="*60)
        try:
            # Go directly to the India D365 instance — gcc.haier.net portal routes to
            # Singapore (crm5) which has the account disabled. India instance (crm8) is correct.
            DIRECT_URL = "https://haiergccin.crm8.dynamics.com"
            await page.goto(DIRECT_URL, wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(3000)
            await page.screenshot(path="test_downloads/00_initial_page.png")
            log(INFO, "Login", f"Landing page: {page.url}")

            # Now wait for Microsoft login form
            await page.wait_for_selector(
                "input[type='email'], input[name='loginfmt'], input[type='text']",
                timeout=25000
            )
            log(INFO, "Login", f"Login form appeared at: {page.url}")
            await page.screenshot(path="test_downloads/01_login_form.png")

            # Fill email
            email_input = page.locator("input[type='email'], input[name='loginfmt']").first
            await email_input.fill(GCC_EMAIL)
            await page.screenshot(path="test_downloads/01_email_entered.png")
            await page.keyboard.press("Enter")
            await page.wait_for_timeout(2500)

            # Password
            try:
                await page.wait_for_selector("input[type='password'], input[name='passwd']", timeout=12000)
                await page.fill("input[type='password'], input[name='passwd']", GCC_PASSWORD)
                await page.screenshot(path="test_downloads/02_password_entered.png")
                await page.keyboard.press("Enter")
                await page.wait_for_timeout(4000)
            except Exception as e:
                log(INFO, "Login", f"Password step: {e}")

            # Handle "Stay signed in?" prompt
            try:
                stay_btn = page.locator("input[id='idBtn_Back'], button:has-text('No')")
                if await stay_btn.count() > 0:
                    await stay_btn.first.click()
                    await page.wait_for_timeout(2000)
            except Exception:
                pass

            # Wait for D365 to land on main.aspx (apps page) — don't wait for networkidle,
            # D365 keeps loading chunks. Just detect the URL change.
            import re
            for _ in range(30):   # poll up to 30s
                await page.wait_for_timeout(1000)
                cur = page.url
                if "dynamics.com/main.aspx" in cur or "dynamics.com/uclient" in cur:
                    break
            else:
                raise TimeoutError(f"D365 never reached main page. Last URL: {page.url}")

            await page.wait_for_timeout(4000)   # let the app portal render
            await page.screenshot(path="test_downloads/03_logged_in.png")

            final_url = page.url
            match = re.search(r'(https://[\w\-\.]+\.dynamics\.com)', final_url)
            actual_d365 = match.group(1) if match else "https://haiergccin.crm8.dynamics.com"

            global ACTUAL_D365
            ACTUAL_D365 = actual_d365
            log(PASS, "Login", f"Authenticated to: {actual_d365}")

        except Exception as e:
            log(FAIL, "Login", str(e))
            await page.screenshot(path="test_downloads/01_login_failed.png")
            await browser.close()
            return

        # ── TEST 2: Navigate to Work Orders ───────────────────────────────
        print("\n" + "="*60)
        print("TEST 2: Navigate to Work Orders list")
        print("="*60)
        try:
            wo_url = (
                f"{ACTUAL_D365}/main.aspx"
                "?appid=4480e191-a429-ec11-b6e6-000d3a80f6f0"
                "&pagetype=entitylist&etn=mcs_workorder"
            )
            await page.goto(wo_url, wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_load_state("networkidle", timeout=20000)
            await page.wait_for_timeout(3000)
            await page.screenshot(path="test_downloads/04_workorder_list.png")

            # Check for grid rows
            row_count_el = page.locator("text=/Rows: \\d+/")
            if await row_count_el.count() > 0:
                row_text = await row_count_el.first.text_content()
                log(PASS, "Work Order Navigation", f"Grid loaded — {row_text}")
            else:
                # Try alternate check
                rows = page.locator("[data-id='entity_control-pcf_grid_control_container'] tr")
                count = await rows.count()
                log(PASS if count > 0 else FAIL, "Work Order Navigation",
                    f"Rows in grid: {count}")

        except Exception as e:
            log(FAIL, "Work Order Navigation", str(e))
            await page.screenshot(path="test_downloads/04_nav_failed.png")

        # ── TEST 3: Export to Excel ───────────────────────────────────────
        print("\n" + "="*60)
        print("TEST 3: Export to Excel")
        print("="*60)
        excel_path = None
        try:
            # Click Export to Excel button
            export_btn = page.locator("button:has-text('Export to Excel'), [aria-label*='Export to Excel']")
            await export_btn.first.wait_for(timeout=10000)

            async with page.expect_download(timeout=60000) as dl_info:
                await export_btn.first.click()
                # Handle dropdown if it appears (Static worksheet vs Dynamic)
                await page.wait_for_timeout(1500)
                static_opt = page.locator("button:has-text('Static worksheet'), li:has-text('Static worksheet')")
                if await static_opt.count() > 0:
                    await static_opt.first.click()

            download = await dl_info.value
            excel_path = DOWNLOAD_DIR / download.suggested_filename
            await download.save_as(excel_path)
            await page.screenshot(path="test_downloads/05_exported.png")

            size_kb = excel_path.stat().st_size // 1024
            log(PASS, "Export to Excel", f"Downloaded: {excel_path.name} ({size_kb} KB)")

        except Exception as e:
            log(FAIL, "Export to Excel", str(e))
            await page.screenshot(path="test_downloads/05_export_failed.png")

        # ── TEST 4: Parse Excel data ──────────────────────────────────────
        print("\n" + "="*60)
        print("TEST 4: Parse exported Excel")
        print("="*60)
        if excel_path and excel_path.exists():
            try:
                df = pd.read_excel(excel_path, header=0)
                df.columns = [str(c).strip() for c in df.columns]

                wo_col = next((c for c in df.columns if 'Work order' in c and '#' in c), None)
                status_col = next((c for c in df.columns if c == 'Status'), None)
                contact_col = next((c for c in df.columns if c == 'Contact'), None)
                product_col = next((c for c in df.columns if 'Product Group' in c), None)

                log(PASS, "Excel Parse", f"Rows: {len(df)} | Cols: {len(df.columns)}")
                log(INFO, "Excel Parse", f"Columns found: {list(df.columns)}")

                if wo_col:
                    sample = df[wo_col].dropna().head(5).tolist()
                    log(PASS, "Excel Parse — Work Orders", f"Sample WOs: {sample}")

                if status_col:
                    counts = df[status_col].value_counts().to_dict()
                    log(PASS, "Excel Parse — Statuses", f"{counts}")

                if product_col:
                    prods = df[product_col].value_counts().to_dict()
                    log(INFO, "Excel Parse — Products", f"{prods}")

            except Exception as e:
                log(FAIL, "Excel Parse", str(e))
        else:
            log(INFO, "Excel Parse", "Skipped — no file to parse")

        # ── TEST 5: Open a work order detail ─────────────────────────────
        print("\n" + "="*60)
        print("TEST 5: Scrape work order detail (address, phone, slot)")
        print("="*60)
        try:
            await page.goto(wo_url, wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_load_state("networkidle", timeout=20000)
            await page.wait_for_timeout(3000)

            # Click first work order link
            first_link = page.locator("a[data-id*='mcs_name'], a[href*='mcs_workorder']").first
            await first_link.wait_for(timeout=10000)
            wo_number = await first_link.text_content()
            await first_link.click()
            await page.wait_for_load_state("networkidle", timeout=20000)
            await page.wait_for_timeout(2000)
            await page.screenshot(path="test_downloads/06_wo_detail.png")

            # Extract fields
            fields = {}
            field_map = {
                "mobile":   "[data-id='mobilephone'] input, [data-id='mobilephone'] .ms-TextField-field",
                "address":  "[data-id='mcs_detailaddress'] input, [data-id='mcs_detailaddress'] textarea",
                "locality": "[data-id='mcs_locality'] input",
                "zip":      "[data-id='address1_postalcode'] input",
                "time":     "[data-id='mcs_timeperiod'] input, [data-id='mcs_timeperiod'] .lookupSelectedOption",
                "mileage":  "[data-id='mcs_mileage'] input",
                "productivity": "[data-id='mcs_productivity'] input",
                "technician":   "[data-id='mcs_assignedtechnicianid'] .lookupSelectedOption",
            }
            for key, selector in field_map.items():
                try:
                    el = page.locator(selector).first
                    if await el.count() > 0:
                        val = await el.input_value() if await el.evaluate("el => el.tagName") in ["INPUT","TEXTAREA"] else await el.text_content()
                        if val and val.strip():
                            fields[key] = val.strip()
                except Exception:
                    pass

            log(PASS if fields else FAIL, "Work Order Detail Scrape",
                f"WO: {wo_number.strip()} | Fields: {json.dumps(fields, indent=2)}")

        except Exception as e:
            log(FAIL, "Work Order Detail Scrape", str(e))
            await page.screenshot(path="test_downloads/06_detail_failed.png")

        # ── TEST 6: Service Center Staff list ────────────────────────────
        print("\n" + "="*60)
        print("TEST 6: Fetch technician list from GCC")
        print("="*60)
        try:
            staff_url = (
                f"{ACTUAL_D365}/main.aspx"
                "?appid=4480e191-a429-ec11-b6e6-000d3a80f6f0"
                "&pagetype=entitylist&etn=mcs_personnel"
            )
            await page.goto(staff_url, wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_load_state("networkidle", timeout=20000)
            await page.wait_for_timeout(3000)
            await page.screenshot(path="test_downloads/07_staff_list.png")

            row_text_el = page.locator("text=/Rows: \\d+/")
            if await row_text_el.count() > 0:
                log(PASS, "Technician List", await row_text_el.first.text_content())
            else:
                log(INFO, "Technician List", "Page loaded but row count not visible — check screenshot 07")

        except Exception as e:
            log(FAIL, "Technician List", str(e))
            await page.screenshot(path="test_downloads/07_staff_failed.png")

        # ── TEST 7: Save session cookies ─────────────────────────────────
        print("\n" + "="*60)
        print("TEST 7: Save session for reuse")
        print("="*60)
        try:
            cookies = await ctx.cookies()
            Path("gcc_session.json").write_text(json.dumps(cookies, indent=2))
            log(PASS, "Session Save", f"{len(cookies)} cookies saved to gcc_session.json")
        except Exception as e:
            log(FAIL, "Session Save", str(e))

        await browser.close()

    # ── Summary ───────────────────────────────────────────────────────────
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    passed = sum(1 for r in results if r["status"] == PASS)
    failed = sum(1 for r in results if r["status"] == FAIL)
    for r in results:
        if r["status"] != INFO:
            print(f"  {r['status']} {r['test']}")
    print(f"\n  {passed} passed / {failed} failed")
    print(f"\nScreenshots saved to: {DOWNLOAD_DIR.absolute()}")
    print("="*60)


if __name__ == "__main__":
    asyncio.run(run_tests())
