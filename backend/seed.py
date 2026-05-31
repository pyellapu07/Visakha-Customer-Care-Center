"""
Seed the DB with data from the real GCC Excel export + engineer dashboard.
Run once: python seed.py
"""
import sys
import pandas as pd
from datetime import datetime
from database import init_db, SessionLocal
from models import Job, Technician

def seed():
    init_db()
    db = SessionLocal()

    # ── Technicians from dashboard file ──────────────────────────────────
    try:
        df_eng = pd.read_excel("F:/SF Engineers Dash Board-July-2023.xls",
                               sheet_name="SMKV", header=1)
        df_eng.columns = [str(c).strip() for c in df_eng.columns]
        print(f"Seeding {len(df_eng)} technicians...")
        for _, row in df_eng.iterrows():
            name = str(row.get("Engineer Name", "")).strip()
            emp_code = str(row.get("User ID", "")).strip()
            if not name or name == "nan" or not emp_code or emp_code == "nan":
                continue
            existing = db.query(Technician).filter_by(id=emp_code).first()
            if not existing:
                tech = Technician(
                    id=emp_code,
                    name=name,
                    mobile=str(row.get("Mobile No", "")).strip().replace(".0",""),
                    skill_level=str(row.get("Grade", "")).strip(),
                    type=str(row.get("Eng Type", "Full-Time")).strip(),
                    status="Active",
                    gcc_user_id=emp_code,
                )
                db.add(tech)
        db.commit()
        print("✅ Technicians seeded")
    except Exception as e:
        print(f"⚠️  Technician seed error: {e}")

    # ── Jobs from GCC Excel export ────────────────────────────────────────
    try:
        df_jobs = pd.read_excel(
            "F:/All Open Work Orders 31_05_26 16-00-40.xlsx", header=1
        )
        df_jobs.columns = [str(c).strip() for c in df_jobs.columns]
        print(f"Seeding {len(df_jobs)} jobs...")

        def safe_dt(val):
            if pd.isna(val): return None
            try: return pd.to_datetime(val).to_pydatetime()
            except: return None

        today = datetime.utcnow().date()

        for _, row in df_jobs.iterrows():
            wo = str(row.get("Work order#", "")).strip()
            gcc_id = str(row.get("(Do Not Modify) Work Order", "")).strip()
            if not wo or wo == "nan": continue

            existing = db.query(Job).filter_by(work_order_no=wo).first()
            if existing: continue

            req_date = safe_dt(row.get("(Do Not Modify) Modified On"))
            is_carry = bool(req_date and req_date.date() < today)

            job = Job(
                id=gcc_id if gcc_id != "nan" else wo,
                work_order_no=wo,
                display_type=str(row.get("Work Order Display Type", "Normal")).strip(),
                priority=str(row.get("Priority", "Normal")).strip(),
                status=str(row.get("Status", "")).strip(),
                sub_status=str(row.get("Sub-status", "")).strip(),
                customer_name=str(row.get("Contact", "")).strip() if not pd.isna(row.get("Contact","")) else None,
                product_group=str(row.get("Product Group", "")).strip() if not pd.isna(row.get("Product Group","")) else None,
                local_category=str(row.get("Local Category", "")).strip() if not pd.isna(row.get("Local Category","")) else None,
                model=str(row.get("Model", "")).strip() if not pd.isna(row.get("Model","")) else None,
                serial_number=str(row.get("Serial Number", "")).strip() if not pd.isna(row.get("Serial Number","")) else None,
                l1=str(row.get("L1", "")).strip() if not pd.isna(row.get("L1","")) else None,
                service_type=str(row.get("Service Type", "")).strip() if not pd.isna(row.get("Service Type","")) else None,
                gcc_created_at=safe_dt(row.get("Created On")),
                gcc_updated_at=safe_dt(row.get("(Do Not Modify) Modified On")),
                is_carry_forward=is_carry,
                synced_at=datetime.utcnow(),
            )
            db.add(job)

        db.commit()
        print("✅ Jobs seeded")
    except Exception as e:
        print(f"⚠️  Job seed error: {e}")
        import traceback; traceback.print_exc()

    db.close()
    print("\n🎉 Seed complete. Run: uvicorn main:app --reload")

if __name__ == "__main__":
    seed()
