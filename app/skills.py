"""Position-certification system.

Four skills exist at Ted's: dressing, cashing, frying, cooking. Cooking is
always the last one mastered, so an employee is never certified in cooking
without also being certified in the other three.
"""

import random

SKILL_ORDER = ["dressing", "cashing", "frying", "cooking"]


def assign_skills(level: int | None, is_manager: bool) -> dict[str, bool]:
    """Random-but-sensible skill certifications correlated with skill_level.

    - Managers: certified in everything.
    - Level 1 or unset: brand new hire, nothing certified yet.
    - Level 2-4: certified in `level - 1` of {dressing, cashing, frying},
      chosen at random (cooking excluded below the top level).
    - Level 5: certified in all four, including cooking.
    """
    if is_manager:
        return {s: True for s in SKILL_ORDER}
    if not level or level <= 1:
        return {s: False for s in SKILL_ORDER}
    if level >= 5:
        return {s: True for s in SKILL_ORDER}
    chosen = set(random.sample(SKILL_ORDER[:3], level - 1))
    return {s: (s in chosen) for s in SKILL_ORDER}
