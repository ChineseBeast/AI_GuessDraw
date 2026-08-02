from fastapi import FastAPI

app = FastAPI(title="Draw & Guess AI Service", version="0.1.0")


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "draw-guess-ai-service"}


@app.get("/api/v1/info")
async def service_info():
    return {
        "name": "Draw & Guess AI Service",
        "version": "0.1.0",
        "capabilities": ["recognition", "drawing", "story"],
    }
