"""One-off migration: add the 4 skill columns to an existing teds.db and
backfill every user's certifications from their skill_level. Safe to run
more than once. Run: python migrate_skills.py"""

import sqlite3

from app.skills import SKILL_ORDER, assign_skills

DB_PATH = "teds.db"

con = sqlite3.connect(DB_PATH)
cur = con.cursor()

existing_cols = {row[1] for row in cur.execute("PRAGMA table_info(users)")}
for skill in SKILL_ORDER:
    col = f"skill_{skill}"
    if col not in existing_cols:
        cur.execute(f"ALTER TABLE users ADD COLUMN {col} BOOLEAN NOT NULL DEFAULT 0")
        print(f"Added column {col}")

con.commit()

rows = cur.execute("SELECT id, role, skill_level FROM users").fetchall()
for user_id, role, skill_level in rows:
    is_manager = role in ("manager", "super_admin")
    skills = assign_skills(skill_level, is_manager)
    cur.execute(
        "UPDATE users SET skill_dressing=?, skill_cashing=?, skill_frying=?, "
        "skill_cooking=? WHERE id=?",
        (
            int(skills["dressing"]),
            int(skills["cashing"]),
            int(skills["frying"]),
            int(skills["cooking"]),
            user_id,
        ),
    )

con.commit()
con.close()
print(f"Backfilled skills for {len(rows)} users.")
