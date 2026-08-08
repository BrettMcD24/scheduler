import json

from sqlalchemy.orm import Session

from .models import AuditLog


def log_action(
    db: Session,
    entity_type: str,
    entity_id: int,
    action: str,
    actor_id: int | None,
    **details,
) -> None:
    db.add(
        AuditLog(
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            actor_id=actor_id,
            details=json.dumps(details, default=str),
        )
    )
