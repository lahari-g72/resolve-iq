from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from database import Base
from pgvector.sqlalchemy import Vector

class RoleEnum(str, enum.Enum):
    customer = "customer"
    agent = "agent"
    admin = "admin"

class StatusEnum(str, enum.Enum):
    open = "open"
    pending = "pending"
    resolved = "resolved"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    role = Column(Enum(RoleEnum), default=RoleEnum.customer)
    hashed_password = Column(String, nullable=True) 

    tickets_created = relationship("Ticket", foreign_keys="[Ticket.customer_id]", back_populates="customer")
    tickets_assigned = relationship("Ticket", foreign_keys="[Ticket.agent_id]", back_populates="agent")

class Ticket(Base):
    __tablename__ = "tickets"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(Text)
    category = Column(String, nullable=True)
    priority = Column(String, default="medium") 
    status = Column(Enum(StatusEnum), default=StatusEnum.open)
    
    customer_id = Column(Integer, ForeignKey("users.id"))
    agent_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    customer = relationship("User", foreign_keys=[customer_id], back_populates="tickets_created")
    agent = relationship("User", foreign_keys=[agent_id], back_populates="tickets_assigned")
    messages = relationship("TicketMessage", back_populates="ticket", cascade="all, delete-orphan")

class TicketMessage(Base):
    __tablename__ = "ticket_messages"
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"))
    sender_id = Column(Integer, ForeignKey("users.id"))
    body = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    ticket = relationship("Ticket", back_populates="messages")
    sender = relationship("User")

class Article(Base):
    __tablename__ = "articles"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    content = Column(Text)
    embedding = Column(Vector(768))