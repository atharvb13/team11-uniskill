from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

# Import after load_dotenv so supabase_clients sees env vars
from app.routes import auth, connections, messages, profile, skills  # noqa: E402

app = FastAPI(title="UniSkill API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(profile.router, prefix="/api/profile", tags=["profile"])
app.include_router(skills.router, prefix="/api/skills", tags=["skills"])
app.include_router(connections.router, prefix="/api/connections", tags=["connections"])
app.include_router(messages.router, prefix="/api/messages", tags=["messages"])


@app.get("/health")
def health():
    return {"status": "ok"}
