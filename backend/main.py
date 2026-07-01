from __future__ import annotations

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
from typing import Optional
import csv
import io
import os
import pathlib
import requests
import jwt
from datetime import datetime, timedelta

from models import Base, Candidate
from rfm import calculate_rfm
from llm_service import generate_strategy

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./database.db")
engine = create_engine(DATABASE_URL, echo=False, connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class CandidateCreate(BaseModel):
    name: str
    position: str
    industry: Optional[str] = None
    city: Optional[str] = None
    channel: Optional[str] = None
    interview_stage: Optional[str] = None
    last_contact_date: Optional[str] = None
    interact_count: int = 0
    intent_score: int = 0
    current_salary_k: Optional[int] = None
    expect_salary_k: Optional[int] = None
    note: Optional[str] = None


class CandidateUpdate(BaseModel):
    name: Optional[str] = None
    position: Optional[str] = None
    industry: Optional[str] = None
    city: Optional[str] = None
    channel: Optional[str] = None
    interview_stage: Optional[str] = None
    last_contact_date: Optional[str] = None
    interact_count: Optional[int] = None
    intent_score: Optional[int] = None
    current_salary_k: Optional[int] = None
    expect_salary_k: Optional[int] = None
    note: Optional[str] = None


class StrategyGenerateRequest(BaseModel):
    provider: Optional[str] = None
    apiKey: Optional[str] = None
    baseUrl: Optional[str] = None
    model: Optional[str] = None

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
    _migrate_database()
    _init_sample_data()


def _migrate_database():
    db = SessionLocal()
    try:
        from sqlalchemy import text
        result = db.execute(text("PRAGMA table_info(candidates)")).fetchall()
        existing_columns = {row[1] for row in result}
        
        new_columns = {
            "r_score": "INTEGER NOT NULL DEFAULT 0",
            "f_score": "INTEGER NOT NULL DEFAULT 0",
            "i_score": "INTEGER NOT NULL DEFAULT 0",
            "rfm_total": "INTEGER NOT NULL DEFAULT 0",
            "segment": "VARCHAR",
        }
        
        for col_name, col_def in new_columns.items():
            if col_name not in existing_columns:
                db.execute(text(f"ALTER TABLE candidates ADD COLUMN {col_name} {col_def}"))
                db.commit()
        
        from models import Candidate
        from rfm import calculate_rfm
        candidates = db.query(Candidate).filter(
            (Candidate.segment.is_(None)) | (Candidate.rfm_total == 0)
        ).all()
        
        for c in candidates:
            rfm = calculate_rfm(c.last_contact_days, c.interact_count, c.intent_score)
            c.r_score = rfm["r"]
            c.f_score = rfm["f"]
            c.i_score = rfm["i"]
            c.rfm_total = rfm["total"]
            c.segment = rfm["segment"]
        
        if candidates:
            db.commit()
    except Exception as e:
        print(f"Migration error: {e}")
    finally:
        db.close()


def _init_sample_data():
    db = SessionLocal()
    try:
        existing = db.query(Candidate).first()
        if existing:
            return
        candidates = [
            Candidate(name="张三", phone="13800000001", email="zhangsan@example.com", 
                      position="前端工程师", industry="互联网", city="北京", channel="BOSS直聘",
                      last_contact_date="2026-06-22", interact_count=5, intent_score=5,
                      current_salary_k=25, expect_salary_k=35, note="React经验丰富"),
            Candidate(name="李四", phone="13800000002", email="lisi@example.com", 
                      position="后端工程师", industry="金融", city="上海", channel="拉勾",
                      last_contact_date="2026-06-20", interact_count=3, intent_score=4,
                      current_salary_k=30, expect_salary_k=40, interview_stage="业务二面待安排"),
            Candidate(name="王五", phone="13800000003", email="wangwu@example.com", 
                      position="产品经理", industry="电商", city="杭州", channel="猎聘",
                      last_contact_date="2026-06-15", interact_count=4, intent_score=4,
                      current_salary_k=28, expect_salary_k=38, interview_stage="业务一面已完成"),
            Candidate(name="赵六", phone="13800000004", email="zhaoliu@example.com", 
                      position="测试工程师", industry="教育", city="深圳", channel="智联",
                      last_contact_date="2026-06-10", interact_count=2, intent_score=3,
                      current_salary_k=18, expect_salary_k=25, interview_stage="HR初面已完成"),
            Candidate(name="钱七", phone="13800000005", email="qianqi@example.com", 
                      position="运维工程师", industry="云计算", city="广州", channel="内推",
                      last_contact_date="2026-05-31", interact_count=3, intent_score=3,
                      current_salary_k=22, expect_salary_k=30),
            Candidate(name="孙八", phone="13800000006", email="sunba@example.com", 
                      position="数据分析师", industry="医疗", city="成都", channel="BOSS直聘",
                      last_contact_date="2026-05-16", interact_count=1, intent_score=2,
                      current_salary_k=20, expect_salary_k=28, interview_stage="终面已完成"),
            Candidate(name="周九", phone="13800000007", email="zhoujiu@example.com", 
                      position="算法工程师", industry="AI", city="北京", channel="拉勾",
                      last_contact_date="2026-04-26", interact_count=1, intent_score=1,
                      current_salary_k=40, expect_salary_k=55),
            Candidate(name="吴十", phone="13800000008", email="wushi@example.com", 
                      position="UI设计师", industry="游戏", city="上海", channel="站酷",
                      last_contact_date="2026-06-23", interact_count=2, intent_score=3,
                      current_salary_k=15, expect_salary_k=22, interview_stage="Offer审批中"),
            Candidate(name="郑十一", phone="13800000009", email="zheng11@example.com", 
                      position="Java开发", industry="金融", city="杭州", channel="猎聘",
                      last_contact_date="2026-06-17", interact_count=4, intent_score=2,
                      current_salary_k=26, expect_salary_k=33, interview_stage="HR初面已约"),
            Candidate(name="冯十二", phone="13800000010", email="feng12@example.com", 
                      position="Python开发", industry="大数据", city="深圳", channel="内推",
                      last_contact_date="2026-05-31", interact_count=2, intent_score=4,
                      current_salary_k=24, expect_salary_k=32),
            Candidate(name="陈十三", phone="13800000011", email="chen13@example.com", 
                      position="Go开发", industry="互联网", city="北京", channel="BOSS直聘",
                      last_contact_date="2026-06-19", interact_count=6, intent_score=5,
                      current_salary_k=32, expect_salary_k=45, interview_stage="业务二面待安排"),
            Candidate(name="褚十四", phone="13800000012", email="chu14@example.com", 
                      position="HRBP", industry="教育", city="武汉", channel="智联",
                      last_contact_date="2026-06-05", interact_count=1, intent_score=2,
                      current_salary_k=12, expect_salary_k=18, interview_stage="简历初筛"),
        ]
        for c in candidates:
            c.update_calculated_fields()
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
        from sqlalchemy import func
        total = db.query(func.count(Candidate.id)).scalar()
        overdue_total = db.query(func.count(Candidate.id)).filter(Candidate.overdue_followup == True).scalar()
        avg_intent = db.query(func.avg(Candidate.intent_score)).scalar()
        
        segment_rows = db.query(Candidate.segment, func.count(Candidate.id)).group_by(Candidate.segment).all()
        segment_counts = {row[0]: row[1] for row in segment_rows if row[0]}
        
        stage_rows = db.query(Candidate.interview_stage, func.count(Candidate.id)).group_by(Candidate.interview_stage).all()
        interview_stage_counts = {row[0]: row[1] for row in stage_rows if row[0]}

        return {
            "segment_counts": segment_counts,
            "overdue_followup_total": overdue_total or 0,
            "interview_stage_counts": interview_stage_counts,
            "total_candidates": total or 0,
            "average_intent_score": round(float(avg_intent or 0), 1),
        }
    finally:
        db.close()


@app.get("/api/candidates")
def get_candidates(
    page: int = 1,
    page_size: int = 50,
    search: str = "",
    segment: str = "",
    stage: str = "",
    intent: int = 0,
    overdue: bool = False,
    sort_by: str = "last_contact_days",
    sort_order: str = "asc",
):
    if page < 1:
        page = 1
    if page_size < 1:
        page_size = 50
    if page_size > 500:
        page_size = 500
    
    allowed_sort_fields = {
        "id", "name", "position", "city", "channel", "interview_stage",
        "last_contact_days", "interact_count", "intent_score",
        "current_salary_k", "expect_salary_k", "rfm_total", "created_at"
    }
    if sort_by not in allowed_sort_fields:
        sort_by = "last_contact_days"
    if sort_order not in {"asc", "desc"}:
        sort_order = "asc"
    
    db = SessionLocal()
    try:
        from sqlalchemy import func, or_
        query = db.query(Candidate)
        
        if search.strip():
            q = f"%{search.strip().lower()}%"
            query = query.filter(
                or_(
                    func.lower(Candidate.name).like(q),
                    func.lower(Candidate.position).like(q),
                    func.lower(Candidate.city).like(q),
                    func.lower(Candidate.channel).like(q),
                )
            )
        
        if segment:
            query = query.filter(Candidate.segment == segment)
        
        if stage:
            query = query.filter(Candidate.interview_stage == stage)
        
        if intent and intent > 0:
            query = query.filter(Candidate.intent_score == intent)
        
        if overdue:
            query = query.filter(Candidate.overdue_followup == True)
        
        total = query.count()
        
        sort_column = getattr(Candidate, sort_by)
        if sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())
        
        offset = (page - 1) * page_size
        candidates = query.offset(offset).limit(page_size).all()
        
        result = [c.to_dict() for c in candidates]
        
        return {
            "items": result,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
        }
    finally:
        db.close()


@app.post("/api/candidates/{id}/strategy")
def get_candidate_strategy(id: int, request: Optional[StrategyGenerateRequest] = None):
    db = SessionLocal()
    try:
        candidate = db.query(Candidate).filter(Candidate.id == id).first()
        if not candidate:
            return {"error": f"候选人 ID {id} 不存在"}

        candidate_dict = candidate.to_dict()
        rfm = calculate_rfm(candidate.last_contact_days, candidate.interact_count, candidate.intent_score)

        config = request.model_dump(exclude_none=True) if request else None
        result = generate_strategy(candidate_dict, rfm, config)

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
                candidate.update_calculated_fields()
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


@app.post("/api/candidates")
def create_candidate(data: CandidateCreate):
    db = SessionLocal()
    try:
        candidate = Candidate(
            name=data.name,
            position=data.position,
            industry=data.industry,
            city=data.city,
            channel=data.channel,
            interview_stage=data.interview_stage,
            last_contact_date=data.last_contact_date,
            interact_count=data.interact_count,
            intent_score=data.intent_score,
            current_salary_k=data.current_salary_k,
            expect_salary_k=data.expect_salary_k,
            note=data.note,
        )
        candidate.update_calculated_fields()
        db.add(candidate)
        db.commit()
        db.refresh(candidate)

        result = candidate.to_dict()
        result.update(calculate_rfm(candidate.last_contact_days, candidate.interact_count, candidate.intent_score))
        return result
    finally:
        db.close()


@app.put("/api/candidates/{id}")
def update_candidate(id: int, data: CandidateUpdate):
    db = SessionLocal()
    try:
        candidate = db.query(Candidate).filter(Candidate.id == id).first()
        if not candidate:
            return {"error": f"候选人 ID {id} 不存在"}

        if data.name is not None:
            candidate.name = data.name
        if data.position is not None:
            candidate.position = data.position
        if data.industry is not None:
            candidate.industry = data.industry
        if data.city is not None:
            candidate.city = data.city
        if data.channel is not None:
            candidate.channel = data.channel
        if data.interview_stage is not None:
            candidate.interview_stage = data.interview_stage
        if data.last_contact_date is not None:
            candidate.last_contact_date = data.last_contact_date
        if data.interact_count is not None:
            candidate.interact_count = data.interact_count
        if data.intent_score is not None:
            candidate.intent_score = data.intent_score
        if data.current_salary_k is not None:
            candidate.current_salary_k = data.current_salary_k
        if data.expect_salary_k is not None:
            candidate.expect_salary_k = data.expect_salary_k
        if data.note is not None:
            candidate.note = data.note

        candidate.update_calculated_fields()
        db.commit()
        db.refresh(candidate)

        result = candidate.to_dict()
        result.update(calculate_rfm(candidate.last_contact_days, candidate.interact_count, candidate.intent_score))
        return result
    finally:
        db.close()


@app.delete("/api/candidates/{id}")
def delete_candidate(id: int):
    db = SessionLocal()
    try:
        candidate = db.query(Candidate).filter(Candidate.id == id).first()
        if not candidate:
            return {"error": f"候选人 ID {id} 不存在"}

        db.delete(candidate)
        db.commit()
        return {"success": True}
    finally:
        db.close()


FEISHU_CLIENT_ID = os.getenv("FEISHU_CLIENT_ID", "")
FEISHU_CLIENT_SECRET = os.getenv("FEISHU_CLIENT_SECRET", "")
FEISHU_REDIRECT_URI = os.getenv("FEISHU_REDIRECT_URI", "http://localhost:5173")
JWT_SECRET = os.getenv("JWT_SECRET", "candidate-recall-workbench-secret")


def create_jwt_token(user_info):
    payload = {
        "user_id": user_info.get("user_id", ""),
        "name": user_info.get("name", ""),
        "email": user_info.get("email", ""),
        "is_guest": bool(user_info.get("is_guest", False)),
        "exp": datetime.utcnow() + timedelta(days=7),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def verify_jwt_token(token):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


class LoginResponse(BaseModel):
    success: bool
    message: str
    token: Optional[str] = None
    user: Optional[dict] = None


@app.get("/api/feishu/login")
def feishu_login():
    if not FEISHU_CLIENT_ID:
        return {"error": "飞书 OAuth 配置未完成"}
    feishu_auth_url = (
        f"https://open.feishu.cn/open-apis/authen/v1/authorize"
        f"?app_id={FEISHU_CLIENT_ID}"
        f"&redirect_uri={FEISHU_REDIRECT_URI}"
        f"&state=random_state"
        f"&response_type=code"
    )
    from fastapi.responses import RedirectResponse
    return RedirectResponse(feishu_auth_url)


@app.get("/api/feishu/callback")
async def feishu_callback(code: str, state: str = ""):
    if not FEISHU_CLIENT_ID or not FEISHU_CLIENT_SECRET:
        return {"error": "飞书 OAuth 配置未完成"}

    token_url = "https://open.feishu.cn/open-apis/authen/v1/access_token"
    try:
        token_response = requests.post(token_url, json={
            "app_id": FEISHU_CLIENT_ID,
            "app_secret": FEISHU_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
        })
        token_data = token_response.json()

        if token_data.get("code") != 0:
            return {"error": f"获取 access_token 失败: {token_data.get('msg')}"}

        access_token = token_data.get("data", {}).get("access_token")
        user_info_url = "https://open.feishu.cn/open-apis/authen/v1/user_info"
        user_response = requests.get(user_info_url, headers={
            "Authorization": f"Bearer {access_token}",
        })
        user_data = user_response.json()

        if user_data.get("code") != 0:
            return {"error": f"获取用户信息失败: {user_data.get('msg')}"}

        user_info = user_data.get("data", {})
        token = create_jwt_token(user_info)

        redirect_url = f"{FEISHU_REDIRECT_URI}?token={token}"
        from fastapi.responses import RedirectResponse
        return RedirectResponse(redirect_url)

    except Exception as e:
        return {"error": f"飞书登录失败: {str(e)}"}


class LoginRequest(BaseModel):
    email: str
    password: str


@app.post("/api/login", response_model=LoginResponse)
def login(request: LoginRequest):
    email = request.email.strip().lower()
    password = request.password
    if email in {"admin", "admin@example.com"} and password == "admin":
        user_info = {
            "user_id": "admin",
            "name": "Admin",
            "email": email,
        }
        token = create_jwt_token(user_info)
        return LoginResponse(
            success=True,
            message="登录成功",
            token=token,
            user=user_info,
        )

    return LoginResponse(
        success=False,
        message="邮箱或密码错误",
    )


@app.post("/api/login/guest", response_model=LoginResponse)
def guest_login():
    user_info = {
        "user_id": "guest",
        "name": "Guest",
        "email": "guest@example.com",
        "is_guest": True,
    }
    token = create_jwt_token(user_info)
    return LoginResponse(
        success=True,
        message="访客登录成功",
        token=token,
        user=user_info,
    )


from fastapi import Request


def get_token_from_request(request: Request):
    token = request.query_params.get("token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]
    return token


@app.get("/api/me")
def get_current_user(request: Request):
    token = get_token_from_request(request)
    if not token:
        return {"error": "未登录"}
    payload = verify_jwt_token(token)
    if not payload:
        return {"error": "token 无效或已过期"}
    return {"success": True, "user": payload}


@app.post("/api/logout")
def logout():
    return {"success": True, "message": "退出成功"}


FRONTEND_DIR = os.getenv("FRONTEND_DIR", "../frontend/dist")
if os.path.isdir(FRONTEND_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="assets")

    @app.get("/")
    async def serve_index():
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        index_path = os.path.join(FRONTEND_DIR, "index.html")
        requested = os.path.join(FRONTEND_DIR, full_path)
        if os.path.isfile(requested):
            return FileResponse(requested)
        return FileResponse(index_path)
