"""End-to-end smoke test. Run with: python test_smoke.py"""

import os

os.environ["DATABASE_URL"] = "sqlite:///./test_smoke.db"
if os.path.exists("test_smoke.db"):
    os.remove("test_smoke.db")

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

client = TestClient(app)
PASSWORD = "password123"


def check(condition, label):
    status = "PASS" if condition else "FAIL"
    print(f"[{status}] {label}")
    assert condition, label


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# 1. bootstrap super admin
r = client.post("/auth/bootstrap", json={
    "email": "owner@teds.com", "password": PASSWORD,
    "first_name": "Owner", "last_name": "Ted",
})
check(r.status_code == 200, "bootstrap super admin")
admin = auth_headers(r.json()["access_token"])

r = client.post("/auth/bootstrap", json={
    "email": "x@x.com", "password": PASSWORD, "first_name": "X", "last_name": "X",
})
check(r.status_code == 403, "bootstrap blocked after first user")

# 2. create store
r = client.post("/stores", headers=admin, json={
    "name": "Sheridan", "state": "NY", "address": "Sheridan Dr, Tonawanda NY",
})
check(r.status_code == 200, "create store")
store_id = r.json()["id"]

# 3. create manager + employees
r = client.post("/employees", headers=admin, json={
    "email": "mgr@teds.com", "password": PASSWORD, "first_name": "Mandy",
    "last_name": "Manager", "role": "manager", "store_id": store_id,
})
check(r.status_code == 200, "create manager")
r = client.post("/auth/login", json={"email": "mgr@teds.com", "password": PASSWORD})
manager = auth_headers(r.json()["access_token"])

emps = {}
roster = [
    ("sarah@teds.com", "Sarah", "K", "2002-03-14", 4, 20, 30),
    ("jake@teds.com", "Jake", "P", "2001-07-22", 3, 25, 35),
    ("ben@teds.com", "Ben", "R", "2010-09-05", 2, 4, 15),   # 15yo minor
    ("lisa@teds.com", "Lisa", "M", "1998-01-30", 5, 30, 40),
    ("maya@teds.com", "Maya", "C", "2000-11-11", 3, 30, 40),
    ("eve@teds.com", "Eve", "T", "2003-05-19", 1, 8, 16),
    ("omar@teds.com", "Omar", "D", "1999-12-02", 4, 20, 40),
    ("nina@teds.com", "Nina", "S", "2004-04-08", 2, 10, 20),  # gets no shifts
]
for email, first, last, dob, level, hmin, hmax in roster:
    r = client.post("/employees", headers=manager, json={
        "email": email, "password": PASSWORD, "first_name": first,
        "last_name": last, "role": "employee", "dob": dob,
        "skill_level": level, "desired_hours_min": hmin, "desired_hours_max": hmax,
    })
    check(r.status_code == 200, f"create employee {first}")
    emps[first] = r.json()["id"]

# 4. employee logins + availability
tokens = {}
for email, first, *_ in roster:
    r = client.post("/auth/login", json={"email": email, "password": PASSWORD})
    tokens[first] = auth_headers(r.json()["access_token"])

# Sarah: Mon-Fri 8am-4pm
r = client.put(f"/availability/{emps['Sarah']}/windows", headers=tokens["Sarah"],
               json=[{"day_of_week": d, "start_time": "08:00", "end_time": "16:00"}
                     for d in range(5)])
check(r.status_code == 200, "Sarah sets availability")
# Ben (minor): weekdays after school + weekends
windows = [{"day_of_week": d, "start_time": "15:30", "end_time": "21:00"} for d in range(5)]
windows += [{"day_of_week": d, "start_time": "08:00", "end_time": "21:00"} for d in (5, 6)]
r = client.put(f"/availability/{emps['Ben']}/windows", headers=tokens["Ben"], json=windows)
check(r.status_code == 200, "Ben sets availability")
# everyone else: open availability all week
for name in ("Jake", "Lisa", "Maya", "Eve", "Omar", "Nina"):
    r = client.put(f"/availability/{emps[name]}/windows", headers=tokens[name],
                   json=[{"day_of_week": d, "start_time": "06:00", "end_time": "22:45"}
                         for d in range(7)])
    check(r.status_code == 200, f"{name} sets availability")

# employee updates desired hours themselves
r = client.put("/employees/me/desired-hours", headers=tokens["Eve"],
               json={"desired_hours_min": 10, "desired_hours_max": 20})
check(r.status_code == 200 and r.json()["desired_hours_min"] == 10,
      "employee updates own desired hours")

# 5. schedule for week of Mon 2026-06-15
r = client.post("/schedules", headers=manager,
                json={"store_id": store_id, "week_start": "2026-06-15"})
check(r.status_code == 200, "create schedule")
schedule_id = r.json()["id"]

r = client.post("/schedules", headers=manager,
                json={"store_id": store_id, "week_start": "2026-06-16"})
check(r.status_code == 422, "non-Monday week_start rejected")

# 6. add shifts via paper codes and explicit times
monday = "2026-06-15"


def add(emp, day, code=None, start=None, end=None, expect=200, **kw):
    # Most of this test seeds shifts to exercise the ADVISORY validation engine
    # (minor rules, double-booking, staffing minimums). Those are deliberately
    # outside availability, so default to overriding the hard availability gate.
    # Pass override_availability=False to test the gate itself.
    kw.setdefault("override_availability", True)
    payload = {"employee_id": emps[emp] if emp else None, "on_date": day, **kw}
    if code:
        payload["code"] = code
    else:
        payload["start_time"], payload["end_time"] = start, end
    r = client.post(f"/schedules/{schedule_id}/shifts", headers=manager, json=payload)
    check(r.status_code == expect, f"shift {emp or 'open'} {day} {code or f'{start}-{end}'}")
    return r.json() if r.status_code == 200 else None


s1 = add("Sarah", monday, code="8-4")
check(s1["start_time"] == "08:00:00" and s1["end_time"] == "16:00:00", "code 8-4 parsed")
s2 = add("Lisa", monday, code="2-C")
check(s2["is_close"] and s2["end_time"] == "22:45:00", "code 2-C parsed as closer")
s3 = add("Jake", monday, code="4-1045")
check(s3["is_close"], "code 4-1045 parsed as closer")
s4 = add("Maya", monday, code="1130-730")
check(s4["start_time"] == "11:30:00" and s4["end_time"] == "19:30:00", "code 1130-730 parsed")
add("Omar", monday, start="08:30", end="16:30")
add("Eve", monday, code="830-4")

# Ben: a shift that violates minor rules on purpose (15yo until 9:30pm exceeds NY 7pm school-day cap)
add("Ben", monday, start="15:30", end="21:30")

# Maya double-booked on purpose
add("Maya", monday, start="18:00", end="22:00")

# The availability gate itself: without an override, a shift outside the
# employee's listed availability is refused (409); with one, it goes through.
add("Ben", monday, start="06:00", end="07:00", expect=409, override_availability=False)

# 7. available-on-day panel
r = client.get(f"/schedules/{schedule_id}/available", headers=manager,
               params={"on_date": monday})
check(r.status_code == 200, "available-on-day endpoint")
panel = {e["name"]: e for e in r.json()["employees"]}
check(panel["Ben R"]["age"] == 15 and any("minor" in f for f in panel["Ben R"]["flags"]),
      "minor flagged in availability panel")
check(panel["Sarah K"]["hours_this_week"] == 8.0, "weekly hours computed in panel")

# 8. validation engine
r = client.get(f"/schedules/{schedule_id}/validate", headers=manager)
check(r.status_code == 200, "validate endpoint")
v = r.json()
codes = {i["code"] for i in v["violations"]} | {i["code"] for i in v["warnings"]}
check("STAFFING_OPENERS" in codes or "STAFFING_CLOSERS" in codes, "staffing minimums flagged")
check("MINOR_TOO_LATE" in codes or "MINOR_DAILY_HOURS" in codes, "minor labor law flagged")
check("DOUBLE_BOOKED" in codes, "double booking flagged")
check("NO_SHIFTS" in codes, "zero-shift employee warning")
mon_staffing = next(d for d in v["staffing"] if d["on_date"] == monday)
check(mon_staffing["openers"] == 3, f"opener count = {mon_staffing['openers']} (8-4, 830-16:30, 830-4)")
check(mon_staffing["closers"] == 2 and not mon_staffing["closers_met"],
      "closer minimum not met flagged")

# 9. publish (warnings don't block)
r = client.post(f"/schedules/{schedule_id}/publish", headers=manager)
check(r.status_code == 200 and r.json()["status"] == "published", "publish with warnings")

# employee can now see schedule
r = client.get(f"/schedules/{schedule_id}/shifts", headers=tokens["Sarah"])
check(r.status_code == 200 and len(r.json()) >= 7, "employee sees published shifts")

# 10. swap flow: Sarah -> Jake, Jake accepts, manager approves
r = client.post("/swaps", headers=tokens["Sarah"],
                json={"shift_id": s1["id"], "target_employee_id": emps["Jake"]})
check(r.status_code == 200 and r.json()["status"] == "pending_coworker", "swap created")
swap_id = r.json()["id"]

r = client.post(f"/swaps/{swap_id}/accept", headers=tokens["Lisa"])
check(r.status_code == 403, "wrong coworker cannot accept")

r = client.post(f"/swaps/{swap_id}/accept", headers=tokens["Jake"])
check(r.status_code == 200 and r.json()["status"] == "pending_manager", "coworker accepts")

r = client.post(f"/swaps/{swap_id}/approve", headers=manager, json={"note": "ok"})
check(r.status_code == 200 and r.json()["status"] == "approved", "manager approves swap")

r = client.get(f"/schedules/{schedule_id}/shifts", headers=manager)
shift_after = next(s for s in r.json() if s["id"] == s1["id"])
check(shift_after["employee_id"] == emps["Jake"], "shift reassigned after approval")

# open drop + claim
r = client.post("/swaps", headers=tokens["Lisa"], json={"shift_id": s2["id"]})
check(r.status_code == 200 and r.json()["status"] == "open", "open drop created")
drop_id = r.json()["id"]
r = client.post(f"/swaps/{drop_id}/claim", headers=tokens["Omar"])
check(r.status_code == 200 and r.json()["status"] == "pending_manager", "drop claimed")
r = client.post(f"/swaps/{drop_id}/deny", headers=manager, json={"note": "need Lisa on close"})
check(r.status_code == 200 and r.json()["status"] == "denied", "manager denies claim")
r = client.get(f"/schedules/{schedule_id}/shifts", headers=manager)
shift_after = next(s for s in r.json() if s["id"] == s2["id"])
check(shift_after["employee_id"] == emps["Lisa"], "shift unchanged after denial")

# 11. time off flow
r = client.post("/time-off", headers=tokens["Eve"],
                json={"start_date": "2026-06-19", "end_date": "2026-06-20",
                      "reason": "family trip"})
check(r.status_code == 200, "time-off created")
to_id = r.json()["id"]
r = client.post(f"/time-off/{to_id}/approve", headers=manager, json={"note": "have fun"})
check(r.status_code == 200 and r.json()["status"] == "approved", "time-off approved")

# schedule Eve on her approved day off -> validation should flag it
add("Eve", "2026-06-19", code="9-4")
r = client.get(f"/schedules/{schedule_id}/validate", headers=manager)
codes = {i["code"] for i in r.json()["violations"]}
check("TIME_OFF_CONFLICT" in codes, "approved time-off conflict flagged")

# 12. permission spot checks
r = client.get(f"/schedules/{schedule_id}/validate", headers=tokens["Sarah"])
check(r.status_code == 403, "employee cannot access validation")
r = client.post("/stores", headers=manager, json={"name": "Nope", "state": "NY"})
check(r.status_code == 403, "manager cannot create stores")

print("\nAll smoke tests passed.")
