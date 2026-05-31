"""Maps raw GCC OData records → SQLAlchemy models."""
from datetime import datetime
from models import Job, Technician
from sqlalchemy.orm import Session


def _dt(val) -> datetime | None:
    if not val:
        return None
    if isinstance(val, datetime):
        return val
    try:
        return datetime.fromisoformat(str(val).replace("Z", "+00:00"))
    except Exception:
        return None


def map_technician(raw: dict, db: Session) -> str:
    gcc_id = raw.get("mcs_jobcardno") or raw.get("mcs_personnelid")
    if not gcc_id:
        return "skip"

    tech = db.query(Technician).filter_by(id=gcc_id).first()
    if not tech:
        tech = Technician(id=gcc_id)
        db.add(tech)
        result = "new"
    else:
        result = "updated"

    tech.name = raw.get("mcs_name", "")
    tech.mobile = raw.get("mobilephone", "")
    tech.skill_level = raw.get("mcs_skilllevel", "")
    tech.type = raw.get("mcs_type", "Full-Time")
    tech.status = raw.get("mcs_status", "Active")
    tech.gcc_user_id = raw.get("mcs_personnelid")
    tech.occupied_wo_service_time = raw.get("mcs_occupiedwoservicetime") or 0
    tech.performance_score = raw.get("mcs_performancescore")
    return result


def map_job(raw: dict, db: Session) -> str:
    wo_no = raw.get("mcs_name")
    gcc_id = raw.get("mcs_workorderid")
    if not wo_no:
        return "skip"

    job = db.query(Job).filter_by(work_order_no=wo_no).first()
    if not job:
        job = Job(id=gcc_id or wo_no, work_order_no=wo_no)
        db.add(job)
        result = "new"
    else:
        result = "updated"

    job.display_type = raw.get("mcs_workorderdisplaytype@OData.Community.Display.V1.FormattedValue",
                               raw.get("mcs_workorderdisplaytype"))
    job.priority = raw.get("mcs_priority@OData.Community.Display.V1.FormattedValue",
                           raw.get("mcs_priority", "Normal"))
    job.status = raw.get("mcs_status@OData.Community.Display.V1.FormattedValue",
                         raw.get("mcs_status"))
    job.sub_status = raw.get("mcs_substatus@OData.Community.Display.V1.FormattedValue",
                             raw.get("mcs_substatus"))
    job.sub_status_comments = raw.get("mcs_substatuscomments")
    job.work_order_source = raw.get("mcs_workordersource@OData.Community.Display.V1.FormattedValue",
                                    raw.get("mcs_workordersource"))
    job.repair_type = raw.get("mcs_repairtype@OData.Community.Display.V1.FormattedValue",
                              raw.get("mcs_repairtype"))
    job.service_type = raw.get("mcs_servicetype@OData.Community.Display.V1.FormattedValue",
                               raw.get("mcs_servicetype"))
    job.l1 = raw.get("mcs_l1@OData.Community.Display.V1.FormattedValue", raw.get("mcs_l1"))
    job.customer_description = raw.get("mcs_customerdescription")
    job.productivity_score = raw.get("mcs_productivity")
    job.mileage_km = raw.get("mcs_mileage")
    job.settlement_status = raw.get("mcs_settlementstatus@OData.Community.Display.V1.FormattedValue",
                                    raw.get("mcs_settlementstatus"))
    job.case_number = raw.get("mcs_casenumber")
    job.longitude = raw.get("mcs_longitude")
    job.latitude = raw.get("mcs_latitude")
    job.time_period = raw.get("mcs_timeperiod@OData.Community.Display.V1.FormattedValue",
                              raw.get("mcs_timeperiod"))
    job.gcc_created_at = _dt(raw.get("createdon"))
    job.gcc_updated_at = _dt(raw.get("modifiedon"))
    job.synced_at = datetime.utcnow()

    # Required service date
    job.required_service_date = _dt(raw.get("mcs_requiredservicedate"))

    # Carry forward: required date is before today
    today = datetime.utcnow().date()
    if job.required_service_date and job.required_service_date.date() < today:
        job.is_carry_forward = True

    # Contact (customer)
    contact = raw.get("mcs_contactid") or {}
    job.customer_name = f"{contact.get('firstname', '')} {contact.get('lastname', '')}".strip()
    job.customer_mobile = contact.get("mobilephone")
    job.customer_alt_mobile = contact.get("telephone1")
    job.zip_code = contact.get("address1_postalcode")
    job.city = contact.get("address1_city")
    job.locality = contact.get("mcs_locality")
    job.customer_address = contact.get("address1_line1")

    # GCC assigned technician
    assigned = raw.get("mcs_assignedtechnicianid") or {}
    job.gcc_assigned_technician = assigned.get("mcs_name")

    return result
