import random
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, Candidate

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./database.db")
engine = create_engine(DATABASE_URL, echo=False, connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

FIRST_NAMES = ["张", "李", "王", "刘", "陈", "杨", "黄", "赵", "周", "吴",
               "徐", "孙", "胡", "朱", "高", "林", "何", "郭", "马", "罗",
               "梁", "宋", "郑", "谢", "韩", "唐", "冯", "于", "董", "萧"]
LAST_NAMES = ["伟", "芳", "娜", "敏", "静", "强", "磊", "军", "洋", "勇",
              "艳", "杰", "娟", "涛", "明", "超", "秀英", "霞", "平", "刚",
              "桂英", "博", "文", "宇", "浩", "晨", "轩", "涵", "欣", "怡"]

POSITIONS = ["前端工程师", "后端工程师", "产品经理", "测试工程师", "运维工程师",
             "数据分析师", "算法工程师", "UI设计师", "Java开发", "Python开发",
             "Go开发", "HRBP", "运营专员", "市场经理", "销售经理", "架构师",
             "项目经理", "iOS开发", "Android开发", "DBA"]

INDUSTRIES = ["互联网", "金融", "电商", "教育", "云计算", "医疗", "AI", "游戏",
              "大数据", "新能源", "汽车", "房地产", "零售", "物流", "传媒"]

CITIES = ["北京", "上海", "杭州", "深圳", "广州", "成都", "武汉", "西安",
          "南京", "苏州", "重庆", "天津", "长沙", "郑州", "青岛", "厦门"]

CHANNELS = ["BOSS直聘", "拉勾", "猎聘", "智联", "内推", "站酷", "GitHub",
            "LinkedIn", "脉脉", "校招", "猎头", "51job"]

STAGES = ["简历初筛", "HR初面已约", "HR初面已完成", "业务一面已约",
          "业务一面已完成", "业务二面待安排", "业务二面已完成", "终面已安排",
          "终面已完成", "Offer审批中", "Offer已发", "已入职", "已拒绝", "未面试"]

STAGE_WEIGHTS = {
    "简历初筛": 25,
    "HR初面已约": 20,
    "HR初面已完成": 15,
    "业务一面已约": 10,
    "业务一面已完成": 8,
    "业务二面待安排": 6,
    "业务二面已完成": 4,
    "终面已安排": 3,
    "终面已完成": 2,
    "Offer审批中": 1,
    "Offer已发": 0.5,
    "已入职": 0.3,
    "已拒绝": 2,
    "未面试": 2,
}

def weighted_random_choice(weights):
    total_weight = sum(weights.values())
    random_num = random.uniform(0, total_weight)
    current_sum = 0
    for key, weight in weights.items():
        current_sum += weight
        if random_num < current_sum:
            return key
    return list(weights.keys())[-1]

def random_phone():
    return "1" + random.choice(["3", "5", "7", "8", "9"]) + "".join([str(random.randint(0, 9)) for _ in range(9)])

def random_email(name_pinyin):
    domains = ["example.com", "test.com", "demo.com", "mail.com", "qq.com", "163.com"]
    return f"{name_pinyin}{random.randint(1, 999)}@{random.choice(domains)}"

def random_date(days_range=180):
    from datetime import date, timedelta
    today = date.today()
    days = random.randint(0, days_range)
    return (today - timedelta(days=days)).isoformat()

def generate_mock_data(count=500):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existing = db.query(Candidate).first()
        if existing:
            print(f"数据库已有数据，跳过生成。如需重新生成，请删除 database.db")
            return

        candidates = []
        for i in range(count):
            first = random.choice(FIRST_NAMES)
            last = random.choice(LAST_NAMES)
            name = first + last
            position = random.choice(POSITIONS)
            industry = random.choice(INDUSTRIES)
            city = random.choice(CITIES)
            channel = random.choice(CHANNELS)
            stage = weighted_random_choice(STAGE_WEIGHTS)
            last_contact_date = random_date(120)
            interact_count = random.randint(0, 10)
            intent_score = random.randint(1, 5)
            current_salary = random.randint(10, 80)
            expect_salary = current_salary + random.randint(3, 20)

            candidate = Candidate(
                name=name,
                phone=random_phone(),
                email=random_email(f"user{i}"),
                position=position,
                industry=industry,
                city=city,
                channel=channel,
                interview_stage=stage,
                last_contact_date=last_contact_date,
                interact_count=interact_count,
                intent_score=intent_score,
                current_salary_k=current_salary,
                expect_salary_k=expect_salary,
                note=f"备注信息-{i+1}: {position}方向，{city}地区，{industry}行业背景",
            )
            candidate.update_calculated_fields()
            candidates.append(candidate)

        db.add_all(candidates)
        db.commit()
        print(f"成功生成 {count} 条候选人数据！")
        print(f"总人数: {db.query(Candidate).count()}")
        
        from sqlalchemy import func
        segments = db.query(Candidate.segment, func.count(Candidate.id)).group_by(Candidate.segment).all()
        print("\nRFM分层统计:")
        for seg, cnt in segments:
            print(f"  {seg}: {cnt}人")
    finally:
        db.close()

if __name__ == "__main__":
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 500
    generate_mock_data(count)
