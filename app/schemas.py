from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- auth ---

class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class BootstrapIn(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str


# --- stores ---

class StoreIn(BaseModel):
    name: str
    address: str = ""
    state: str = Field(pattern="^(NY|AZ)$")
    timezone: str = "America/New_York"
    open_time: time = time(8, 0)
    close_time: time = time(22, 0)
    closer_end_time: time = time(22, 45)
    min_openers: int = 3
    min_closers: int = 4
    opener_cutoff: time = time(9, 0)


class StoreOut(ORMModel, StoreIn):
    id: int


# --- employees ---

class EmployeeIn(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    phone: str = ""
    role: str = "employee"
    store_id: int | None = None
    dob: date | None = None
    skill_level: int | None = Field(default=None, ge=1, le=5)
    skill_dressing: bool | None = None
    skill_cashing: bool | None = None
    skill_frying: bool | None = None
    skill_cooking: bool | None = None
    desired_hours_min: int | None = Field(default=None, ge=0)
    desired_hours_max: int | None = Field(default=None, ge=0)


class EmployeeUpdate(BaseModel):
    phone: str | None = None
    role: str | None = None
    store_id: int | None = None
    dob: date | None = None
    skill_level: int | None = Field(default=None, ge=1, le=5)
    skill_dressing: bool | None = None
    skill_cashing: bool | None = None
    skill_frying: bool | None = None
    skill_cooking: bool | None = None
    desired_hours_min: int | None = Field(default=None, ge=0)
    desired_hours_max: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class EmployeeOut(ORMModel):
    id: int
    email: EmailStr
    first_name: str
    last_name: str
    phone: str
    role: str
    store_id: int | None
    dob: date | None
    skill_level: int | None
    skill_dressing: bool
    skill_cashing: bool
    skill_frying: bool
    skill_cooking: bool
    desired_hours_min: int | None
    desired_hours_max: int | None
    is_active: bool


class DesiredHoursIn(BaseModel):
    desired_hours_min: int = Field(ge=0)
    desired_hours_max: int = Field(ge=0)


# --- availability ---

class AvailabilityWindowIn(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    start_time: time
    end_time: time


class AvailabilityOut(ORMModel, AvailabilityWindowIn):
    id: int
    employee_id: int


class AvailabilityExceptionIn(BaseModel):
    on_date: date
    available: bool = True
    start_time: time | None = None
    end_time: time | None = None
    note: str = ""


class AvailabilityExceptionOut(ORMModel, AvailabilityExceptionIn):
    id: int
    employee_id: int


# --- schedules / shifts ---

class ScheduleIn(BaseModel):
    store_id: int
    week_start: date


class ScheduleOut(ORMModel):
    id: int
    store_id: int
    week_start: date
    status: str
    created_by: int
    published_at: datetime | None


class ShiftIn(BaseModel):
    employee_id: int | None = None
    on_date: date
    start_time: time | None = None
    end_time: time | None = None
    code: str | None = None  # paper-style code, e.g. "8-4", "2-C"
    position: str = ""
    notes: str = ""
    is_manager_shift: bool = False
    override_availability: bool = False  # manager bypass of the availability block


class ShiftUpdate(BaseModel):
    employee_id: int | None = None
    override_availability: bool = False
    start_time: time | None = None
    end_time: time | None = None
    position: str | None = None
    notes: str | None = None


class ShiftOut(ORMModel):
    id: int
    schedule_id: int
    employee_id: int | None
    on_date: date
    start_time: time
    end_time: time
    is_close: bool
    position: str
    notes: str
    is_manager_shift: bool
    was_swapped: bool
    hours: float

    @classmethod
    def from_shift(cls, s):
        return cls(
            id=s.id,
            schedule_id=s.schedule_id,
            employee_id=s.employee_id,
            on_date=s.on_date,
            start_time=s.start_time,
            end_time=s.end_time,
            is_close=s.is_close,
            position=s.position,
            notes=s.notes,
            is_manager_shift=s.is_manager_shift,
            was_swapped=s.was_swapped,
            hours=s.hours(),
        )


# --- swaps ---

class SwapCreateIn(BaseModel):
    shift_id: int
    target_employee_id: int | None = None  # None = open drop to the pool
    target_shift_id: int | None = None  # the coworker's shift to trade for
    drop_reason: str = ""  # manager-visible reason


class SwapDecisionIn(BaseModel):
    note: str = ""


class SwapOut(ORMModel):
    id: int
    shift_id: int
    requesting_employee_id: int
    target_employee_id: int | None
    target_shift_id: int | None
    status: str
    manager_note: str
    created_at: datetime
    coworker_accepted_at: datetime | None
    decided_at: datetime | None


class ShiftSummary(BaseModel):
    id: int
    on_date: date
    start_time: time
    end_time: time
    is_close: bool


class SwapDetailOut(BaseModel):
    """Enriched swap with both employees' names and both shift summaries,
    for the manager's 'View Request' panel."""
    id: int
    status: str
    requesting_employee_id: int
    requesting_employee_name: str
    target_employee_id: int | None
    target_employee_name: str | None
    requesting_shift: ShiftSummary | None
    target_shift: ShiftSummary | None
    manager_note: str
    drop_reason: str
    created_at: datetime
    decided_at: datetime | None


# --- time off ---

class TimeOffIn(BaseModel):
    start_date: date
    end_date: date
    reason: str = ""


class TimeOffDecisionIn(BaseModel):
    note: str = ""


class TimeOffOut(ORMModel):
    id: int
    employee_id: int
    start_date: date
    end_date: date
    reason: str
    status: str
    manager_note: str
    created_at: datetime


# --- call-offs ---

class CallOffIn(BaseModel):
    employee_id: int
    shift_id: int | None = None
    on_date: date
    shift_label: str = ""
    reason: str = ""


class CallOffOut(ORMModel):
    id: int
    store_id: int
    employee_id: int
    employee_name: str | None = None
    shift_id: int | None
    on_date: date
    shift_label: str
    reason: str
    created_at: datetime


# --- level change requests ---

class LevelChangeIn(BaseModel):
    employee_id: int
    to_level: int
    reason: str = ""


class LevelChangeOut(ORMModel):
    id: int
    employee_id: int
    employee_name: str | None = None
    store_id: int
    from_level: int | None
    to_level: int
    reason: str
    status: str
    requested_by: int
    requested_by_name: str | None = None
    admin_note: str
    created_at: datetime
    decided_at: datetime | None
