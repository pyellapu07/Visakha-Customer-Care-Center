from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Text, ForeignKey, Enum
)
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime
import enum

Base = declarative_base()


class JobStatus(str, enum.Enum):
    created = "Created"
    dispatched = "Dispatched"
    allocated = "Allocated"
    in_service = "In Service"
    completed = "Completed"
    closed = "Closed"
    rejected = "Rejected"


class JobPriority(str, enum.Enum):
    normal = "Normal"
    vip = "VIP"
    high = "High"


class TechnicianType(str, enum.Enum):
    full_time = "Full-Time"
    seasonal = "Seasonal"
    freelancer = "Freelancer"


class PartRequestStatus(str, enum.Enum):
    pending = "Pending"
    dispatched = "Dispatched"
    ordered = "Ordered"
    collected = "Collected"


class Technician(Base):
    __tablename__ = "technicians"

    id = Column(String, primary_key=True)          # HGINT03815
    name = Column(String, nullable=False)
    mobile = Column(String)
    skill_level = Column(String)                   # A / B / C
    type = Column(String)                          # Full-Time / Seasonal / Freelancer
    status = Column(String, default="Active")      # Active / Inactive
    gcc_user_id = Column(String, unique=True)      # GCC system user ID
    profile_photo_url = Column(String)
    occupied_wo_service_time = Column(Float, default=0)
    performance_score = Column(Float)
    cover_areas = Column(Text)                     # JSON list of localities
    expiration_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    assignments = relationship("Assignment", back_populates="technician")


class Job(Base):
    __tablename__ = "jobs"

    id = Column(String, primary_key=True)           # GCC GUID
    work_order_no = Column(String, unique=True, nullable=False)   # VJ20260531000791
    display_type = Column(String)                   # Normal / VIP
    priority = Column(String, default="Normal")
    status = Column(String)
    sub_status = Column(String)
    sub_status_comments = Column(Text)
    work_order_source = Column(String)              # WhatsApp / Call

    # Customer
    customer_name = Column(String)
    customer_mobile = Column(String)
    customer_alt_mobile = Column(String)
    customer_address = Column(Text)
    locality = Column(String)
    city = Column(String)
    zip_code = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    preferred_channel = Column(String)              # WhatsApp

    # Product
    product_group = Column(String)                  # Home Air Conditioner
    local_category = Column(String)                 # AC-Split
    model = Column(String)
    serial_number = Column(String)
    brand = Column(String)
    date_of_purchase = Column(DateTime)
    warranty_expiry = Column(DateTime)
    product_warranty = Column(String)
    is_b2b = Column(Boolean, default=False)

    # Service
    required_service_date = Column(DateTime)
    time_period = Column(String)                    # 18:00-20:00
    appointment_time = Column(DateTime)
    repair_type = Column(String)                    # Simple Repair / Installation
    service_type = Column(String)
    l1 = Column(String)                             # Customer Service / Installation
    customer_description = Column(Text)
    productivity_score = Column(Float)              # Haier's complexity score
    mileage_km = Column(Float)

    # Settlement
    settlement_status = Column(String)
    case_number = Column(String)

    # Our fields
    assigned_technician_id = Column(String, ForeignKey("technicians.id"))
    gcc_assigned_technician = Column(String)        # Name as in GCC
    is_carry_forward = Column(Boolean, default=False)
    internal_notes = Column(Text)

    # Timestamps
    gcc_created_at = Column(DateTime)
    gcc_updated_at = Column(DateTime)
    synced_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    assignment = relationship("Assignment", back_populates="job", uselist=False)
    part_requests = relationship("PartRequest", back_populates="job")


class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(String, ForeignKey("jobs.id"), nullable=False)
    technician_id = Column(String, ForeignKey("technicians.id"), nullable=False)
    assigned_by = Column(String)                    # Admin user name
    assigned_at = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text)
    synced_to_gcc = Column(Boolean, default=False)
    gcc_sync_at = Column(DateTime)

    job = relationship("Job", back_populates="assignment")
    technician = relationship("Technician", back_populates="assignments")


class PartRequest(Base):
    __tablename__ = "part_requests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(String, ForeignKey("jobs.id"), nullable=False)
    technician_id = Column(String, ForeignKey("technicians.id"))
    part_number = Column(String)
    part_description = Column(String)
    quantity = Column(Integer, default=1)
    status = Column(String, default="Pending")      # Pending/Dispatched/Ordered/Collected
    in_inventory = Column(Boolean)
    receipt_url = Column(String)
    notes = Column(Text)
    requested_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime)

    job = relationship("Job", back_populates="part_requests")


class SyncLog(Base):
    __tablename__ = "sync_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    synced_at = Column(DateTime, default=datetime.utcnow)
    jobs_fetched = Column(Integer, default=0)
    jobs_new = Column(Integer, default=0)
    jobs_updated = Column(Integer, default=0)
    technicians_fetched = Column(Integer, default=0)
    status = Column(String)                         # success / error
    error_message = Column(Text)
