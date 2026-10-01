from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from models import RoleEnum, StatusEnum

# --- Users ---
class UserCreate(BaseModel):
    name: str
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: RoleEnum
    
    class Config:
        from_attributes = True

# --- Messages ---
class TicketMessageCreate(BaseModel):
    body: str
    sender_id: int

class TicketMessageResponse(BaseModel):
    id: int
    sender_id: int
    body: str
    created_at: datetime
    
    class Config:
        from_attributes = True

# --- Tickets ---
class TicketCreate(BaseModel):
    title: str
    description: str
    customer_id: int
    priority: str = "medium"
    category: Optional[str] = None

class TicketResponse(BaseModel):
    id: int
    title: str
    description: str
    category: Optional[str]
    priority: str
    status: StatusEnum
    customer_id: int
    agent_id: Optional[int]
    created_at: datetime
    messages: List[TicketMessageResponse] = []
    
    class Config:
        from_attributes = True

# --- Articles (RAG) ---
class ArticleCreate(BaseModel):
    title: str
    content: str

class ArticleResponse(BaseModel):
    id: int
    title: str
    content: str
    
    class Config:
        from_attributes = True

class SearchQuery(BaseModel):
    query: str