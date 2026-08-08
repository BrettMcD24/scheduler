"""Seed demo data for local development. Run: python seed.py
Creates the Sheridan store, 5 managers, and 25 employees with varied,
scattered availability (mirroring the real paper schedule). Passwords: 'password123'."""

import random
from datetime import date, time

from app.auth import hash_password
from app.database import Base, SessionLocal, engine
from app.models import Availability, Role, Store, User
from app.skills import assign_skills

Base.metadata.create_all(bind=engine)
db = SessionLocal()

if db.query(User).count() > 0:
    print("Database already has users; skipping seed.")
    raise SystemExit

PW = hash_password("password123")
random.seed(42)

store = Store(name="Sheridan", address="Sheridan Dr, Tonawanda NY", state="NY")
db.add(store)
db.flush()

db.add(User(
    email="owner@teds.com", password_hash=PW, role=Role.super_admin,
    first_name="Owner", last_name="Ted",
))

FIRST = [
    "Sarah", "Jake", "Ben", "Lisa", "Maya", "Eve", "Omar", "Nina", "Carlos",
    "Priya", "Liam", "Zoe", "Noah", "Aria", "Ethan", "Mia", "Lucas", "Ava",
    "Mason", "Ella", "Logan", "Chloe", "Caleb", "Grace", "Henry", "Ruby",
    "Owen", "Lily", "Jack", "Hazel",
]
LAST = [
    "Kowalski", "Pearson", "Reyes", "Moreau", "Chen", "Torres", "Diallo",
    "Singh", "Rivera", "Patel", "Murphy", "Brooks", "Nguyen", "Foster",
    "Bauer", "Cruz", "Hayes", "Ito", "Walsh", "Romano", "Park", "Quinn",
    "Adler", "Bowen", "Cohen", "Delgado", "Ellis", "Frost", "Gibbs", "Hale",
]

MGR_NAMES = [
    ("Mandy", "Manager"), ("Greg", "Stockton"), ("Tara", "Voss"),
    ("Dev", "Kapoor"), ("Renee", "Albright"),
]

# Realistic shift-window options employees tend to be available for.
# (open is 6-ish prep, store 8-10:45). Mirrors scattered paper-schedule availability.
WINDOW_POOL = [
    (time(6, 0), time(14, 0)),    # early
    (time(8, 0), time(16, 0)),    # opener-ish
    (time(8, 0), time(22, 45)),   # all day
    (time(11, 0), time(19, 30)),  # mid
    (time(15, 0), time(22, 45)),  # closer / after school
    (time(16, 0), time(22, 45)),  # evenings only
    (time(10, 0), time(18, 0)),   # midday
]

def scattered_availability(emp_id, minor=False):
    """Give each employee a different, partial week of availability."""
    # how many days available this week: most people 3-6 days
    n_days = random.randint(3, 6)
    days = random.sample(range(7), n_days)
    for dow in days:
        if minor:
            # minors: weekday after-school, looser on weekends
            if dow < 5:
                start, end = time(15, 30), time(21, 0)
            else:
                start, end = random.choice([(time(8, 0), time(21, 0)),
                                            (time(10, 0), time(21, 0))])
        else:
            start, end = random.choice(WINDOW_POOL)
        db.add(Availability(
            employee_id=emp_id, day_of_week=dow, start_time=start, end_time=end,
        ))

# 5 managers (schedulable, generally wide availability)
for i, (first, last) in enumerate(MGR_NAMES):
    mgr_skills = assign_skills(5, is_manager=True)
    m = User(
        email="mgr@teds.com" if i == 0 else f"mgr{i + 1}@teds.com",
        password_hash=PW, role=Role.manager, store_id=store.id,
        first_name=first, last_name=last, dob=date(1990, 1, 1),
        skill_level=5, desired_hours_min=30, desired_hours_max=40,
        skill_dressing=mgr_skills["dressing"], skill_cashing=mgr_skills["cashing"],
        skill_frying=mgr_skills["frying"], skill_cooking=mgr_skills["cooking"],
    )
    db.add(m)
    db.flush()
    # managers available most days, varied windows
    for dow in random.sample(range(7), random.randint(5, 7)):
        start, end = random.choice(WINDOW_POOL[:4] + [(time(6, 0), time(22, 45))])
        db.add(Availability(employee_id=m.id, day_of_week=dow,
                            start_time=start, end_time=end))

# 25 employees
used = set()
for i in range(25):
    first = FIRST[i % len(FIRST)]
    last = LAST[i % len(LAST)]
    email = f"{first.lower()}.{last.lower()}@teds.com"
    if email in used:
        email = f"{first.lower()}.{last.lower()}{i}@teds.com"
    used.add(email)
    level = random.randint(1, 5)
    minor = random.random() < 0.18
    if minor:
        dob = date(2009 + random.randint(0, 1), random.randint(1, 12), random.randint(1, 28))
    else:
        dob = date(1995 + random.randint(0, 8), random.randint(1, 12), random.randint(1, 28))
    hmin = random.choice([8, 10, 15, 20, 25])
    hmax = hmin + random.choice([10, 15, 20])
    emp_skills = assign_skills(level, is_manager=False)
    emp = User(
        email=email, password_hash=PW, role=Role.employee, store_id=store.id,
        first_name=first, last_name=last, dob=dob, skill_level=level,
        desired_hours_min=hmin, desired_hours_max=hmax,
        skill_dressing=emp_skills["dressing"], skill_cashing=emp_skills["cashing"],
        skill_frying=emp_skills["frying"], skill_cooking=emp_skills["cooking"],
    )
    db.add(emp)
    db.flush()
    scattered_availability(emp.id, minor=minor)

db.commit()
print("Seeded: 1 store, 1 super admin, 5 managers, 25 employees (scattered availability).")
print("Manager logins: mgr@teds.com, mgr2@teds.com ... mgr5@teds.com (password123)")
print("Employees: firstname.lastname@teds.com (password123)")
print("Owner/super-admin: owner@teds.com (password123)")
