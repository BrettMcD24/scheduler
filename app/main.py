from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .routers import (
    auth,
    availability,
    call_offs,
    employees,
    level_changes,
    schedules,
    school_breaks,
    stores,
    swaps,
    time_off,
)

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Ted's Hot Dogs Scheduler API",
    version="0.1.0",
    description=(
        "Backend for the Ted's scheduling app: schedule building, "
        "availability, shift swaps, and time-off requests."
    ),
)

# Allow the Vite dev server (and later, the deployed web app) to call the API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(stores.router)
app.include_router(employees.router)
app.include_router(availability.router)
app.include_router(schedules.router)
app.include_router(swaps.router)
app.include_router(time_off.router)
app.include_router(call_offs.router)
app.include_router(level_changes.router)
app.include_router(school_breaks.router)


@app.get("/")
def root():
    return {"app": "teds-scheduler", "docs": "/docs"}
