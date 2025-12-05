from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

# Load environment variables FIRST, before any imports that need them
load_dotenv()

from routers import match_risk, execute_hedge

app = FastAPI(title="Hedger API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],  # Frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(match_risk.router, prefix="/api", tags=["matching"])
app.include_router(execute_hedge.router, prefix="/api", tags=["execution"])

@app.get("/")
async def root():
    return {"message": "Hedger API", "version": "1.0.0"}

@app.get("/api/health")
async def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

