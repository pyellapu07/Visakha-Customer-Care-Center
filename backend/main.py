from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from datetime import datetime, date
from typing import Optional
from pathlib import Path
import asyncio

from database import get_db, init_db
from models import Job, Technician, Assignment, PartRequest, SyncLog
from schemas import (
    JobOut, TechnicianOut, AssignmentCreate, AssignmentOut,
    PartRequestCreate, PartRequestOut, DashboardStats, SyncResult
)
from gcc_sync import run_sync

app = FastAPI(title="Haier Service OS", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

Path("uploads").mkdir(exist_ok=True)

@app.on_event("startup")
def startup():
    init_db()


# ─── Dashboard ────────────────────────────────────────────────────────────

@app.get("/api/dashboard", response_model=DashboardStats)
def get_dashboard(db: Session = Depends(get_db)):
    today = date.today()
    today_start = datetime(today.year, today.month, today.day)

    open_statuses = ["Dispatched", "Allocated", "In Service", "Created"]

    total_open    = db.query(func.count(Job.id)).scalar()   # ALL jobs in DB
    total_active  = db.query(func.count(Job.id)).filter(Job.status.in_(open_statuses)).scalar()

    pending_accept = db.query(func.count(Job.id)).filter(
        Job.sub_status.like("%Pending SC Accept%")
    ).scalar()

    pending_assign = db.query(func.count(Job.id)).filter(
        Job.sub_status.like("%Pending Technician Set%")
    ).scalar()

    carry_forward = db.query(func.count(Job.id)).filter(
        Job.is_carry_forward == True,
        Job.status.in_(open_statuses)
    ).scalar()

    vip_open = db.query(func.count(Job.id)).filter(
        Job.display_type == "VIP",
        Job.status.in_(open_statuses)
    ).scalar()

    completed_today = db.query(func.count(Job.id)).filter(
        Job.status.in_(["Completed", "Closed"]),
        Job.gcc_updated_at >= today_start
    ).scalar()

    unassigned = db.query(func.count(Job.id)).filter(
        Job.status.in_(open_statuses),
        Job.assigned_technician_id == None,
        Job.gcc_assigned_technician == None
    ).scalar()

    pending_parts = db.query(func.count(PartRequest.id)).filter(
        PartRequest.status == "Pending"
    ).scalar()

    return DashboardStats(
        total_open=total_open,
        total_active=total_active,
        pending_accept=pending_accept,
        pending_assign=pending_assign,
        carry_forward=carry_forward,
        vip_open=vip_open,
        completed_today=completed_today,
        unassigned=unassigned,
        pending_parts=pending_parts,
        last_synced=_last_sync_time(db),
    )


def _last_sync_time(db: Session) -> Optional[datetime]:
    log = db.query(SyncLog).order_by(SyncLog.synced_at.desc()).first()
    return log.synced_at if log else None


# ─── Jobs ─────────────────────────────────────────────────────────────────

@app.get("/api/jobs", response_model=list[JobOut])
def get_jobs(
    status: Optional[str] = None,
    sub_status: Optional[str] = None,
    priority: Optional[str] = None,
    locality: Optional[str] = None,
    product_group: Optional[str] = None,
    assigned: Optional[bool] = None,
    carry_forward: Optional[bool] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    q = db.query(Job)

    if status:
        q = q.filter(Job.status == status)
    if sub_status:
        q = q.filter(Job.sub_status.like(f"%{sub_status}%"))
    if priority:
        q = q.filter(Job.display_type == priority)
    if locality:
        q = q.filter(Job.locality == locality)
    if product_group:
        q = q.filter(Job.product_group == product_group)
    if carry_forward is not None:
        q = q.filter(Job.is_carry_forward == carry_forward)
    if assigned is not None:
        if assigned:
            q = q.filter(
                or_(Job.assigned_technician_id != None, Job.gcc_assigned_technician != None)
            )
        else:
            q = q.filter(
                and_(Job.assigned_technician_id == None, Job.gcc_assigned_technician == None)
            )
    if search:
        q = q.filter(
            or_(
                Job.work_order_no.like(f"%{search}%"),
                Job.customer_name.like(f"%{search}%"),
                Job.customer_mobile.like(f"%{search}%"),
                Job.locality.like(f"%{search}%"),
                Job.model.like(f"%{search}%"),
            )
        )

    q = q.order_by(
        Job.display_type.desc(),          # VIP first
        Job.is_carry_forward.desc(),      # Carry-forward next
        Job.required_service_date.asc(),  # Oldest due date first
    )

    offset = (page - 1) * limit
    return q.offset(offset).limit(limit).all()


@app.get("/api/jobs/{job_id}", response_model=JobOut)
def get_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
    return job


# ─── Technicians ──────────────────────────────────────────────────────────

@app.get("/api/technicians", response_model=list[TechnicianOut])
def get_technicians(
    status: Optional[str] = "Active",
    type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    q = db.query(Technician)
    if status:
        q = q.filter(Technician.status == status)
    if type:
        q = q.filter(Technician.type == type)
    techs = q.all()

    # Annotate with today's assignment count
    today = date.today()
    today_start = datetime(today.year, today.month, today.day)
    for tech in techs:
        tech._today_assignments = db.query(func.count(Assignment.id)).filter(
            Assignment.technician_id == tech.id,
            Assignment.assigned_at >= today_start
        ).scalar()
    return techs


@app.get("/api/technicians/{tech_id}", response_model=TechnicianOut)
def get_technician(tech_id: str, db: Session = Depends(get_db)):
    tech = db.query(Technician).filter(Technician.id == tech_id).first()
    if not tech:
        raise HTTPException(404, "Technician not found")
    return tech


@app.get("/api/technicians/{tech_id}/jobs")
def get_technician_jobs(tech_id: str, db: Session = Depends(get_db)):
    assignments = db.query(Assignment).filter(
        Assignment.technician_id == tech_id
    ).order_by(Assignment.assigned_at.desc()).limit(20).all()
    return [a.job for a in assignments if a.job]


# ─── Assignments ──────────────────────────────────────────────────────────

@app.post("/api/assignments", response_model=AssignmentOut)
async def assign_job(
    data: AssignmentCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    job = db.query(Job).filter(Job.id == data.job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
    tech = db.query(Technician).filter(Technician.id == data.technician_id).first()
    if not tech:
        raise HTTPException(404, "Technician not found")

    # Remove existing assignment if any
    existing = db.query(Assignment).filter(Assignment.job_id == data.job_id).first()
    if existing:
        db.delete(existing)

    assignment = Assignment(
        job_id=data.job_id,
        technician_id=data.technician_id,
        assigned_by=data.assigned_by or "Admin",
        notes=data.notes,
    )
    db.add(assignment)

    # Update job's assigned technician
    job.assigned_technician_id = data.technician_id
    db.commit()
    db.refresh(assignment)

    # Sync to GCC in background
    background_tasks.add_task(_sync_assignment_to_gcc, job.id, tech.gcc_user_id)

    return assignment


async def _sync_assignment_to_gcc(job_gcc_id: str, tech_gcc_id: str):
    """Background task: write assignment to GCC via OData PATCH."""
    if not tech_gcc_id:
        return
    try:
        from gcc_sync import load_cookies, assign_technician_in_gcc
        cookies = load_cookies()
        if cookies:
            await assign_technician_in_gcc(job_gcc_id, tech_gcc_id, cookies)
            print(f"[GCC] Assignment synced: {job_gcc_id} → {tech_gcc_id}")
    except Exception as e:
        print(f"[GCC] Assignment sync failed: {e}")


@app.delete("/api/assignments/{job_id}")
def unassign_job(job_id: str, db: Session = Depends(get_db)):
    a = db.query(Assignment).filter(Assignment.job_id == job_id).first()
    if a:
        db.delete(a)
    job = db.query(Job).filter(Job.id == job_id).first()
    if job:
        job.assigned_technician_id = None
    db.commit()
    return {"ok": True}


# ─── Part Requests ────────────────────────────────────────────────────────

@app.get("/api/part-requests", response_model=list[PartRequestOut])
def get_part_requests(
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    q = db.query(PartRequest)
    if status:
        q = q.filter(PartRequest.status == status)
    return q.order_by(PartRequest.requested_at.desc()).limit(100).all()


@app.post("/api/part-requests", response_model=PartRequestOut)
def create_part_request(data: PartRequestCreate, db: Session = Depends(get_db)):
    pr = PartRequest(**data.model_dump())
    db.add(pr)
    db.commit()
    db.refresh(pr)
    return pr


@app.patch("/api/part-requests/{pr_id}")
def update_part_request(
    pr_id: int,
    status: str,
    db: Session = Depends(get_db)
):
    pr = db.query(PartRequest).filter(PartRequest.id == pr_id).first()
    if not pr:
        raise HTTPException(404)
    pr.status = status
    if status in ("Dispatched", "Collected", "Ordered"):
        pr.resolved_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


@app.post("/api/part-requests/{pr_id}/receipt")
async def upload_receipt(
    pr_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    pr = db.query(PartRequest).filter(PartRequest.id == pr_id).first()
    if not pr:
        raise HTTPException(404)
    path = f"uploads/receipt_{pr_id}_{file.filename}"
    content = await file.read()
    Path(path).write_bytes(content)
    pr.receipt_url = path
    db.commit()
    return {"url": path}


# ─── GCC Sync ─────────────────────────────────────────────────────────────

@app.post("/api/sync", response_model=SyncResult)
async def trigger_sync(db: Session = Depends(get_db)):
    stats = await run_sync(db)
    log = SyncLog(
        jobs_fetched=stats["jobs_fetched"],
        jobs_new=stats.get("jobs_new", 0),
        jobs_updated=stats.get("jobs_updated", 0),
        technicians_fetched=stats["technicians_fetched"],
        status=stats["status"],
        error_message=stats.get("error"),
    )
    db.add(log)
    db.commit()
    return SyncResult(**stats)


@app.get("/api/sync/logs")
def get_sync_logs(db: Session = Depends(get_db)):
    return db.query(SyncLog).order_by(SyncLog.synced_at.desc()).limit(10).all()


# ─── Import from Excel ────────────────────────────────────────────────────

@app.post("/api/import/excel")
async def import_from_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Manual import: upload GCC Excel export file."""
    from gcc_sync import parse_excel_export
    from gcc_mapper import map_job

    content = await file.read()
    tmp = Path(f"uploads/import_{file.filename}")
    tmp.write_bytes(content)

    jobs_data = parse_excel_export(str(tmp))
    new_count = 0
    for j in jobs_data:
        result = map_job(j, db)
        if result == "new":
            new_count += 1
    db.commit()
    return {"imported": len(jobs_data), "new": new_count}


# ─── Utilities ────────────────────────────────────────────────────────────

@app.get("/api/localities")
def get_localities(db: Session = Depends(get_db)):
    rows = db.query(Job.locality).filter(
        Job.locality != None, Job.locality != ""
    ).distinct().all()
    return sorted([r[0] for r in rows if r[0]])


@app.get("/api/product-groups")
def get_product_groups(db: Session = Depends(get_db)):
    rows = db.query(Job.product_group).filter(
        Job.product_group != None
    ).distinct().all()
    return sorted([r[0] for r in rows if r[0]])


@app.get("/health")
def health():
    return {"status": "ok", "time": datetime.utcnow()}
