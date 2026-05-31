from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class TechnicianOut(BaseModel):
    id: str
    name: str
    mobile: Optional[str]
    skill_level: Optional[str]
    type: Optional[str]
    status: Optional[str]
    occupied_wo_service_time: Optional[float]
    performance_score: Optional[float]
    cover_areas: Optional[str]

    class Config:
        from_attributes = True


class JobOut(BaseModel):
    id: str
    work_order_no: str
    display_type: Optional[str]
    priority: Optional[str]
    status: Optional[str]
    sub_status: Optional[str]
    work_order_source: Optional[str]
    customer_name: Optional[str]
    customer_mobile: Optional[str]
    customer_address: Optional[str]
    locality: Optional[str]
    city: Optional[str]
    zip_code: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    product_group: Optional[str]
    local_category: Optional[str]
    model: Optional[str]
    serial_number: Optional[str]
    repair_type: Optional[str]
    service_type: Optional[str]
    l1: Optional[str]
    customer_description: Optional[str]
    productivity_score: Optional[float]
    mileage_km: Optional[float]
    time_period: Optional[str]
    required_service_date: Optional[datetime]
    is_carry_forward: Optional[bool]
    assigned_technician_id: Optional[str]
    gcc_assigned_technician: Optional[str]
    gcc_created_at: Optional[datetime]
    synced_at: Optional[datetime]

    class Config:
        from_attributes = True


class AssignmentCreate(BaseModel):
    job_id: str
    technician_id: str
    assigned_by: Optional[str] = "Admin"
    notes: Optional[str] = None


class AssignmentOut(BaseModel):
    id: int
    job_id: str
    technician_id: str
    assigned_by: Optional[str]
    assigned_at: datetime
    synced_to_gcc: bool

    class Config:
        from_attributes = True


class PartRequestCreate(BaseModel):
    job_id: str
    technician_id: Optional[str]
    part_number: Optional[str]
    part_description: Optional[str]
    quantity: int = 1
    notes: Optional[str]


class PartRequestOut(BaseModel):
    id: int
    job_id: str
    technician_id: Optional[str]
    part_number: Optional[str]
    part_description: Optional[str]
    quantity: int
    status: str
    in_inventory: Optional[bool]
    receipt_url: Optional[str]
    requested_at: datetime

    class Config:
        from_attributes = True


class DashboardStats(BaseModel):
    total_open: int
    total_active: int = 0
    pending_accept: int
    pending_assign: int
    carry_forward: int
    vip_open: int
    completed_today: int
    unassigned: int
    pending_parts: int
    last_synced: Optional[datetime]


class SyncResult(BaseModel):
    jobs_fetched: int
    jobs_new: int
    jobs_updated: int
    technicians_fetched: int
    status: str
    error: Optional[str]
