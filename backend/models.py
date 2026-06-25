from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import declarative_base
from datetime import datetime

Base = declarative_base()


class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    position = Column(String, nullable=True)
    last_contact_days = Column(Integer, default=0, nullable=False)
    interact_count = Column(Integer, default=0, nullable=False)
    intent_score = Column(Integer, default=0, nullable=False)
    interview_stage = Column(String, nullable=True)
    overdue_followup = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "phone": self.phone,
            "email": self.email,
            "position": self.position,
            "last_contact_days": self.last_contact_days,
            "interact_count": self.interact_count,
            "intent_score": self.intent_score,
            "interview_stage": self.interview_stage,
            "overdue_followup": self.overdue_followup,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }