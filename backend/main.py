from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from collections import Counter
import csv
import io

from models import Base, Candidate
from rfm import calculate_rfm
from gemini_service import generate_strategy

sqlite_file_name = "database.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"
engine = create_engine(sqlite_url, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

app = FastAPI(title="候选人智能召回工作台", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    _init_sample_data()


def _init_sample_data():
    db = SessionLocal()
    try:
        existing = db.query(Candidate).first()
        if existing:
            return
        candidates = [
            Candidate(name="张三", phone="13800000001", email="zhangsan@example.com", position="前端工程师",
                      last_contact_days=3, interact_count=5, intent_score=5,
                      interview_stage="一面", overdue_followup=False),
            Candidate(name="李四", phone="13800000002", email="lisi@example.com", position="后端工程师",
                      last_contact_days=5, interact_count=3, intent_score=4,
                      interview_stage="二面", overdue_followup=False),
            Candidate(name="王五", phone="13800000003", email="wangwu@example.com", position="产品经理",
                      last_contact_days=10, interact_count=4, intent_score=4,
                      interview_stage="初筛", overdue_followup=True),
            Candidate(name="赵六", phone="13800000004", email="zhaoliu@example.com", position="测试工程师",
                      last_contact_days=15, interact_count=2, intent_score=3,
                      interview_stage="一面", overdue_followup=False),
            Candidate(name="钱七", phone="13800000005", email="qianqi@example.com", position="运维工程师",
                      last_contact_days=25, interact_count=3, intent_score=3,
                      interview_stage=None, overdue_followup=True),
            Candidate(name="孙八", phone="13800000006", email="sunba@example.com", position="数据分析师",
                      last_contact_days=40, interact_count=1, intent_score=2,
                      interview_stage="终面", overdue_followup=False),
            Candidate(name="周九", phone="13800000007", email="zhoujiu@example.com", position="算法工程师",
                      last_contact_days=60, interact_count=1, intent_score=1,
                      interview_stage=None, overdue_followup=True),
            Candidate(name="吴十", phone="13800000008", email="wushi@example.com", position="UI设计师",
                      last_contact_days=2, interact_count=2, intent_score=3,
                      interview_stage="offer", overdue_followup=False),
            Candidate(name="郑十一", phone="13800000009", email="zheng11@example.com", position="Java开发",
                      last_contact_days=8, interact_count=4, intent_score=2,
                      interview_stage="一面", overdue_followup=False),
            Candidate(name="冯十二", phone="13800000010", email="feng12@example.com", position="Python开发",
                      last_contact_days=35, interact_count=2, intent_score=4,
                      interview_stage=None, overdue_followup=True),
            Candidate(name="陈十三", phone="13800000011", email="chen13@example.com", position="Go开发",
                      last_contact_days=6, interact_count=6, intent_score=5,
                      interview_stage="二面", overdue_followup=False),
            Candidate(name="褚十四", phone="13800000012", email="chu14@example.com", position="HRBP",
                      last_contact_days=20, interact_count=1, intent_score=2,
                      interview_stage=None, overdue_followup=False),
        ]
        for c in candidates:
            db.add(c)
        db.commit()
    finally:
        db.close()


@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Service is running"}


@app.get("/api/candidates/segmented")
def get_segmented_candidates():
    db = SessionLocal()
    try:
        candidates = db.query(Candidate).all()
        result = []
        for c in candidates:
            rfm = calculate_rfm(c.last_contact_days, c.interact_count, c.intent_score)
            candidate_dict = c.to_dict()
            candidate_dict.update(rfm)
            result.append(candidate_dict)
        return result
    finally:
        db.close()


@app.get("/api/stats")
def get_stats():
    db = SessionLocal()
    try:
        candidates = db.query(Candidate).all()

        segment_counts = Counter()
        interview_stage_counts = Counter()
        overdue_followup_total = 0

        for c in candidates:
            rfm = calculate_rfm(c.last_contact_days, c.interact_count, c.intent_score)
            segment_counts[rfm["segment"]] += 1
            if c.overdue_followup:
                overdue_followup_total += 1
            if c.interview_stage:
                interview_stage_counts[c.interview_stage] += 1

        return {
            "segment_counts": dict(segment_counts),
            "overdue_followup_total": overdue_followup_total,
            "interview_stage_counts": dict(interview_stage_counts),
            "total_candidates": len(candidates),
        }
    finally:
        db.close()


@app.post("/api/candidates/{id}/strategy")
def get_candidate_strategy(id: int):
    db = SessionLocal()
    try:
        candidate = db.query(Candidate).filter(Candidate.id == id).first()
        if not candidate:
            return {"error": f"候选人 ID {id} 不存在"}

        candidate_dict = candidate.to_dict()
        rfm = calculate_rfm(candidate.last_contact_days, candidate.interact_count, candidate.intent_score)

        result = generate_strategy(candidate_dict, rfm)

        if "error" in result:
            return {"status": "error", **result}

        return {"status": "success", **result}

    finally:
        db.close()


@app.post("/api/candidates/import")
async def import_candidates(file: UploadFile = File(...)):
    db = SessionLocal()
    try:
        content = await file.read()
        reader = csv.DictReader(io.StringIO(content.decode("utf-8")))
        
        imported_count = 0
        errors = []
        
        for row_num, row in enumerate(reader, start=2):
            try:
                candidate = Candidate(
                    name=row.get("name", "").strip(),
                    phone=row.get("phone", "").strip() or None,
                    email=row.get("email", "").strip() or None,
                    position=row.get("position", "").strip() or None,
                    last_contact_days=int(row.get("last_contact_days", 0)),
                    interact_count=int(row.get("interact_count", 0)),
                    intent_score=int(row.get("intent_score", 0)),
                    interview_stage=row.get("interview_stage", "").strip() or None,
                    overdue_followup=row.get("overdue_followup", "false").strip().lower() == "true",
                )
                db.add(candidate)
                imported_count += 1
            except Exception as e:
                errors.append(f"第 {row_num} 行: {str(e)}")
        
        db.commit()
        
        return {
            "status": "success",
            "imported_count": imported_count,
            "errors": errors,
        }
    except Exception as e:
        return {"status": "error", "error": f"文件解析失败：{str(e)}"}
    finally:
        db.close()