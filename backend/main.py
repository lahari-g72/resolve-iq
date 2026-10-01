import os
from google import genai
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db, engine
import models
import schemas
import auth

# Initialize Environment & AI
load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# Ensure database tables exist
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="ResolveIQ API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root(db: Session = Depends(get_db)):
    return {"status": "healthy"}

# --- WebSockets ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            await connection.send_json(message)

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep the connection open and wait for client disconnect
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# --- Auth & Users ---
@app.post("/users/", response_model=schemas.UserResponse)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter(models.User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    new_user = models.User(
        name=user.name, 
        email=user.email, 
        hashed_password=auth.get_password_hash(user.password)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/token")
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = auth.create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer", "role": user.role}

# --- Tickets (Secured) ---
@app.post("/tickets/", response_model=schemas.TicketResponse)
async def create_ticket(ticket: schemas.TicketCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    new_ticket = models.Ticket(
        title=ticket.title,
        description=ticket.description,
        customer_id=current_user.id,
        priority=ticket.priority,
        category=ticket.category
    )
    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)

    # Broadcast to all connected WebSockets
    await manager.broadcast({
        "type": "new_ticket",
        "ticket": {
            "id": new_ticket.id,
            "title": new_ticket.title,
            "description": new_ticket.description,
            "priority": new_ticket.priority,
            "status": new_ticket.status,
            "category": new_ticket.category
        }
    })

    return new_ticket

@app.get("/tickets/", response_model=list[schemas.TicketResponse])
def get_tickets(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Only show tickets that are NOT resolved
    query = db.query(models.Ticket).filter(models.Ticket.status != models.StatusEnum.resolved)
    
    # RBAC: Customers only see their own tickets. Agents/Admins see all.
    if current_user.role == models.RoleEnum.customer:
        return query.filter(models.Ticket.customer_id == current_user.id).all()
    return query.all()

@app.post("/tickets/{ticket_id}/resolve")
def resolve_ticket(ticket_id: int, payload: dict, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # 1. Save the AI draft to the message thread
    new_message = models.TicketMessage(
        ticket_id=ticket.id,
        sender_id=current_user.id,
        body=payload.get("reply_text", "Resolved by agent.")
    )
    db.add(new_message)

    # 2. Change the status instead of deleting the ticket
    ticket.status = models.StatusEnum.resolved
    db.commit()
    
    return {"status": "success", "message": "Ticket resolved and reply saved"}

# --- Analytics ---
@app.get("/analytics/summary")
def get_analytics_summary(
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    total = db.query(func.count(models.Ticket.id)).scalar() or 0
    resolved = db.query(func.count(models.Ticket.id)).filter(
        models.Ticket.status == models.StatusEnum.resolved
    ).scalar() or 0
    open_count = db.query(func.count(models.Ticket.id)).filter(
        models.Ticket.status != models.StatusEnum.resolved
    ).scalar() or 0

    category_counts = (
        db.query(models.Ticket.category, func.count(models.Ticket.id))
        .group_by(models.Ticket.category)
        .all()
    )

    return {
        "total": total,
        "open": open_count,
        "resolved": resolved,
        "by_category": {cat or "general": count for cat, count in category_counts}
    }

# --- Articles & RAG ---
@app.post("/articles/", response_model=schemas.ArticleResponse)
def create_article(article: schemas.ArticleCreate, db: Session = Depends(get_db)):
    # Using the verified gemini-embedding-2 model
    response = client.models.embed_content(
        model="gemini-embedding-2", 
        contents=f"Title: {article.title}\nContent: {article.content}"
    )
    new_article = models.Article(
        title=article.title, 
        content=article.content, 
        embedding=response.embeddings[0].values[:768]
    )
    db.add(new_article)
    db.commit()
    db.refresh(new_article)
    return new_article

@app.get("/articles/", response_model=list[schemas.ArticleResponse])
def get_articles(db: Session = Depends(get_db)):
    return db.query(models.Article).all()

@app.post("/tickets/{ticket_id}/draft")
def generate_ai_draft(ticket_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        return {"error": "Ticket not found"}
    
    try:
        # 1. Search the vector database using gemini-embedding-2
        search_response = client.models.embed_content(
            model="gemini-embedding-2", 
            contents=ticket.description
        )
        best_article = db.query(models.Article).order_by(
            models.Article.embedding.cosine_distance(search_response.embeddings[0].values[:768])
        ).first()
        
        article_text = best_article.content if best_article else "No relevant article found."

        # 2. Generate the draft using the verified gemini-3.8-flash model
        prompt = f"You are a helpful customer support agent. Write a brief, polite response to this customer issue. Use ONLY the information in the Knowledge Base Article provided.\nCustomer Issue: {ticket.description}\nKnowledge Base Article: {article_text}"
        
        ai_response = client.models.generate_content(
            model='gemini-3.8-flash', 
            contents=prompt
        )
        return {"draft": ai_response.text}
        
    except Exception as e:
        print(f"AI Error: {e}")
        return {"draft": "⚠️ The AI service is temporarily unavailable. Please try again."}