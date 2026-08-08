# Backend change required

The Next.js dev server runs on **port 3000**, but your FastAPI CORS config only
allows the old Vite origin (5173). Add port 3000 in `app/main.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",    # <-- add
        "http://127.0.0.1:3000",    # <-- add
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

No other backend changes are needed. No migrations, no new endpoints — this
frontend uses the API exactly as it already exists.
