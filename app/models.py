import enum
from datetime import date, datetime, time, timezone

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow():
    return datetime.now(timezone.utc)


class Role(str, enum.Enum):
    super_admin = "super_admin"
    manager = "manager"
    employee = "employee"


class ScheduleStatus(str, enum.Enum):
    draft = "draft"
    published = "published"


class SwapStatus(str, enum.Enum):
    open = "open"                      # dropped to pool, no target yet
    pending_coworker = "pending_coworker"
    pending_manager = "pending_manager"
    approved = "approved"
    denied = "denied"
    cancelled = "cancelled"


class RequestStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    denied = "denied"
    cancelled = "cancelled"


class Store(Base):
    __tablename__ = "stores"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    address: Mapped[str] = mapped_column(String(255), default="")
    state: Mapped[str] = mapped_column(String(2))  # "NY" or "AZ"
    timezone: Mapped[str] = mapped_column(String(64), default="America/New_York")
    open_time: Mapped[time] = mapped_column(Time, default=time(8, 0))
    close_time: Mapped[time] = mapped_column(Time, default=time(22, 0))
    # cleanup buffer after close; closers are scheduled until this time
    closer_end_time: Mapped[time] = mapped_column(Time, default=time(22, 45))
    min_openers: Mapped[int] = mapped_column(Integer, default=3)
    min_closers: Mapped[int] = mapped_column(Integer, default=4)
    # latest start time that still counts as an opener
    opener_cutoff: Mapped[time] = mapped_column(Time, default=time(9, 0))

    employees: Mapped[list["User"]] = relationship(back_populates="store")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    store_id: Mapped[int | None] = mapped_column(ForeignKey("stores.id"), nullable=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    phone: Mapped[str] = mapped_column(String(32), default="")
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(Enum(Role), default=Role.employee)
    first_name: Mapped[str] = mapped_column(String(80))
    last_name: Mapped[str] = mapped_column(String(80))
    dob: Mapped[date | None] = mapped_column(Date, nullable=True)
    skill_level: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1-5
    # position certifications; cooking is always the last one mastered
    skill_dressing: Mapped[bool] = mapped_column(Boolean, default=False)
    skill_cashing: Mapped[bool] = mapped_column(Boolean, default=False)
    skill_frying: Mapped[bool] = mapped_column(Boolean, default=False)
    skill_cooking: Mapped[bool] = mapped_column(Boolean, default=False)
    desired_hours_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    desired_hours_max: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    store: Mapped[Store | None] = relationship(back_populates="employees")

    def age_on(self, on_date: date) -> int | None:
        if not self.dob:
            return None
        return (
            on_date.year
            - self.dob.year
            - ((on_date.month, on_date.day) < (self.dob.month, self.dob.day))
        )


class Availability(Base):
    """Recurring weekly availability window. Multiple rows per day allowed."""

    __tablename__ = "availability"

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    day_of_week: Mapped[int] = mapped_column(Integer)  # 0=Monday .. 6=Sunday
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)

    employee: Mapped[User] = relationship()


class AvailabilityException(Base):
    """One-off override for a specific date. If available=False, blocks the day."""

    __tablename__ = "availability_exceptions"
    __table_args__ = (UniqueConstraint("employee_id", "on_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    on_date: Mapped[date] = mapped_column(Date)
    available: Mapped[bool] = mapped_column(Boolean, default=True)
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    note: Mapped[str] = mapped_column(String(255), default="")

    employee: Mapped[User] = relationship()


class Schedule(Base):
    __tablename__ = "schedules"
    __table_args__ = (UniqueConstraint("store_id", "week_start"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id"), index=True)
    week_start: Mapped[date] = mapped_column(Date)  # must be a Monday
    status: Mapped[ScheduleStatus] = mapped_column(
        Enum(ScheduleStatus), default=ScheduleStatus.draft
    )
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    store: Mapped[Store] = relationship()
    shifts: Mapped[list["Shift"]] = relationship(
        back_populates="schedule", cascade="all, delete-orphan"
    )


class Shift(Base):
    __tablename__ = "shifts"

    id: Mapped[int] = mapped_column(primary_key=True)
    schedule_id: Mapped[int] = mapped_column(ForeignKey("schedules.id"), index=True)
    employee_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )  # null = unfilled slot
    on_date: Mapped[date] = mapped_column(Date, index=True)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    is_close: Mapped[bool] = mapped_column(Boolean, default=False)
    position: Mapped[str] = mapped_column(String(80), default="")
    notes: Mapped[str] = mapped_column(String(255), default="")
    # manager-on-duty concept from the paper sheet
    is_manager_shift: Mapped[bool] = mapped_column(Boolean, default=False)
    # set true on both shifts when an approved swap reassigns them
    was_swapped: Mapped[bool] = mapped_column(Boolean, default=False)

    schedule: Mapped[Schedule] = relationship(back_populates="shifts")
    employee: Mapped[User | None] = relationship()

    def hours(self) -> float:
        start_minutes = self.start_time.hour * 60 + self.start_time.minute
        end_minutes = self.end_time.hour * 60 + self.end_time.minute
        return round(max(0, end_minutes - start_minutes) / 60, 2)


class SwapRequest(Base):
    __tablename__ = "swap_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    shift_id: Mapped[int] = mapped_column(ForeignKey("shifts.id"), index=True)
    requesting_employee_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    target_employee_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    # for two-sided swaps: the coworker's shift the requester will take.
    # null = one-sided drop to the pool.
    target_shift_id: Mapped[int | None] = mapped_column(
        ForeignKey("shifts.id"), nullable=True
    )
    status: Mapped[SwapStatus] = mapped_column(Enum(SwapStatus))
    coworker_accepted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    decided_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    manager_note: Mapped[str] = mapped_column(String(255), default="")
    # reason the requester gave for dropping/swapping — manager-visible only
    drop_reason: Mapped[str] = mapped_column(String(500), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    shift: Mapped[Shift] = relationship(foreign_keys=[shift_id])
    target_shift: Mapped[Shift | None] = relationship(foreign_keys=[target_shift_id])


class TimeOffRequest(Base):
    __tablename__ = "time_off_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    reason: Mapped[str] = mapped_column(String(255), default="")
    status: Mapped[RequestStatus] = mapped_column(
        Enum(RequestStatus), default=RequestStatus.pending
    )
    manager_note: Mapped[str] = mapped_column(String(255), default="")
    decided_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    employee: Mapped[User] = relationship(foreign_keys=[employee_id])


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    entity_type: Mapped[str] = mapped_column(String(40), index=True)
    entity_id: Mapped[int] = mapped_column(Integer, index=True)
    action: Mapped[str] = mapped_column(String(60))
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    details: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class CallOff(Base):
    """Logged when an employee calls in unable to work a shift.
    Managers create these for tracking and disciplinary purposes."""

    __tablename__ = "call_offs"

    id: Mapped[int] = mapped_column(primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id"), index=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    shift_id: Mapped[int | None] = mapped_column(
        ForeignKey("shifts.id"), nullable=True
    )
    on_date: Mapped[date] = mapped_column(Date)
    shift_label: Mapped[str] = mapped_column(String(80), default="")
    reason: Mapped[str] = mapped_column(String(500), default="")
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    employee: Mapped[User] = relationship(foreign_keys=[employee_id])
    shift: Mapped[Shift | None] = relationship(foreign_keys=[shift_id])


class LevelChangeRequest(Base):
    """A manager proposing a skill-level change. Increases require super-admin
    approval; decreases apply immediately."""

    __tablename__ = "level_change_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id"), index=True)
    from_level: Mapped[int | None] = mapped_column(Integer, nullable=True)
    to_level: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(String(500), default="")
    status: Mapped[RequestStatus] = mapped_column(
        Enum(RequestStatus), default=RequestStatus.pending
    )
    requested_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    decided_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    admin_note: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    decided_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    employee: Mapped[User] = relationship(foreign_keys=[employee_id])
