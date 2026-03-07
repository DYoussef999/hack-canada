from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import dashboard, sandbox, optimizer

app = FastAPI(title="LaunchPad AI API", description="Expansion Intelligence for Small Businesses")

# Allow requests from the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sandbox.router, prefix="/sandbox", tags=["Sandbox"])
app.include_router(optimizer.router, prefix="/optimizer", tags=["Optimizer"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])

@app.get("/")
def read_root():
    return {"message": "LaunchPad AI Backend is running"}
