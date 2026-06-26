from sqlalchemy import Column, Integer, String, Boolean, DateTime, Index
from sqlalchemy.orm import declarative_base
from datetime import datetime, date
from rfm import calculate_rfm

Base = declarative_base()

OVERDUE_STAGES = ["业务一面已完成", "业务二面待安排", "终面已完成"]


def calculate_last_contact_days(last_contact_date_str):
    if not last_contact_date_str:
        return 0
    try:
        contact_date = datetime.strptime(last_contact_date_str, "%Y-%m-%d").date()
        today = date.today()
        return (today - contact_date).days
    except Exception:
        return 0


def calculate_overdue_followup(interview_stage, last_contact_days):
    return interview_stage in OVERDUE_STAGES and last_contact_days > 14


class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, index=True)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    position = Column(String, nullable=True, index=True)
    industry = Column(String, nullable=True)
    city = Column(String, nullable=True, index=True)
    channel = Column(String, nullable=True)
    interview_stage = Column(String, nullable=True, index=True)
    last_contact_date = Column(String, nullable=True)
    last_contact_days = Column(Integer, default=0, nullable=False)
    interact_count = Column(Integer, default=0, nullable=False)
    intent_score = Column(Integer, default=0, nullable=False)
    current_salary_k = Column(Integer, nullable=True)
    expect_salary_k = Column(Integer, nullable=True)
    note = Column(String, nullable=True)
    overdue_followup = Column(Boolean, default=False, nullable=False, index=True)
    r_score = Column(Integer, default=0, nullable=False)
    f_score = Column(Integer, default=0, nullable=False)
    i_score = Column(Integer, default=0, nullable=False)
    rfm_total = Column(Integer, default=0, nullable=False)
    segment = Column(String, nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def update_calculated_fields(self):
        self.last_contact_days = calculate_last_contact_days(self.last_contact_date)
        self.overdue_followup = calculate_overdue_followup(self.interview_stage, self.last_contact_days)
        rfm = calculate_rfm(self.last_contact_days, self.interact_count, self.intent_score)
        self.r_score = rfm["r"]
        self.f_score = rfm["f"]
        self.i_score = rfm["i"]
        self.rfm_total = rfm["total"]
        self.segment = rfm["segment"]
        self.updated_at = datetime.utcnow()

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "phone": self.phone,
            "email": self.email,
            "position": self.position,
            "industry": self.industry,
            "city": self.city,
            "channel": self.channel,
            "interview_stage": self.interview_stage,
            "last_contact_date": self.last_contact_date,
            "last_contact_days": self.last_contact_days,
            "interact_count": self.interact_count,
            "intent_score": self.intent_score,
            "current_salary_k": self.current_salary_k,
            "expect_salary_k": self.expect_salary_k,
            "note": self.note,
            "overdue_followup": self.overdue_followup,
            "r": self.r_score,
            "f": self.f_score,
            "i": self.i_score,
            "total": self.rfm_total,
            "segment": self.segment,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }