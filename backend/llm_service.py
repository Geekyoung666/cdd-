import os
import json
import httpx
from dotenv import load_dotenv

load_dotenv()

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "openai")
API_KEY = os.getenv("DEEPSEEK_API_KEY") or os.getenv("API_KEY")
API_BASE_URL = os.getenv("DEEPSEEK_API_BASE_URL") or os.getenv("API_BASE_URL")
MODEL_NAME = os.getenv("MODEL_NAME") or os.getenv("DEEPSEEK_MODEL") or "deepseek-chat"


def generate_strategy(candidate: dict, rfm: dict) -> dict:
    if not API_KEY:
        return {"error": "DEEPSEEK_API_KEY 或 API_KEY 环境变量未设置"}

    prompt = f"""
你是一位资深的招聘运营专家，擅长分析候选人状态并生成个性化的召回策略。

请根据以下候选人信息，生成一份完整的召回策略：

【候选人基本信息】
姓名：{candidate.get('name', '')}
意向岗位：{candidate.get('position', '')}
面试阶段：{candidate.get('interview_stage', '未面试')}
最近联系天数：{candidate.get('last_contact_days', 0)}天
互动次数：{candidate.get('interact_count', 0)}次
意向评分：{candidate.get('intent_score', 0)}/5
是否逾期：{'是' if candidate.get('overdue_followup') else '否'}
备注：{candidate.get('remark', '无')}

【RFM 分层分析】
R(最近联系)：{rfm.get('r')}分
F(互动频率)：{rfm.get('f')}分
I(意向程度)：{rfm.get('i')}分
总分：{rfm.get('total')}分
分层标签：{rfm.get('segment')}

请输出 JSON 格式，包含以下字段：
1. risk_judgement：一句话风险判断，分析他为什么可能流失
2. channel：推荐触达渠道，从「微信」「电话」「邮件」「飞书」中选择
3. timing：推荐触达时机
4. script：一段可直接发给候选人的召回话术，口吻要自然、个性化，结合他的岗位和意向

要求：
- 话术要针对该候选人的具体情况，不要使用通用模板
- 要体现出对候选人的关注和了解
- 语气专业但友好
- 严格输出 JSON 格式，不要包含其他文字
"""

    try:
        if LLM_PROVIDER.lower() == "gemini":
            return call_gemini(prompt)
        elif LLM_PROVIDER.lower() == "spark":
            return call_spark(prompt)
        else:
            return call_openai_compatible(prompt)

    except Exception as e:
        return {"error": f"API 调用失败：{str(e)}"}


def call_openai_compatible(prompt: str) -> dict:
    base_url = (API_BASE_URL or "https://api.deepseek.com").rstrip("/")
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": "你是一位资深的招聘运营专家"},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.7,
    }

    with httpx.Client() as client:
        response = client.post(f"{base_url}/chat/completions", headers=headers, json=payload, timeout=30)
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            detail = exc.response.text[:500] if exc.response is not None else str(exc)
            raise RuntimeError(f"DeepSeek API 返回错误 {exc.response.status_code}: {detail}") from exc
        data = response.json()

    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError(f"DeepSeek API 响应格式异常：{json.dumps(data, ensure_ascii=False)[:500]}") from exc
    return parse_json_response(content)


def call_gemini(prompt: str) -> dict:
    try:
        import google.generativeai as genai
        genai.configure(api_key=API_KEY)
        model = genai.GenerativeModel(MODEL_NAME or "gemini-1.5-flash")
        response = model.generate_content(prompt)
        return parse_json_response(response.text)
    except ImportError:
        return {"error": "google-generativeai 库未安装，请安装后重试"}


def call_spark(prompt: str) -> dict:
    base_url = API_BASE_URL or "https://spark-api-open.xf-yun.com/v3.5/chat/completions"
    
    import hashlib
    import time
    import uuid
    
    api_key = API_KEY
    api_secret = os.getenv("API_SECRET")
    
    if not api_secret:
        return {"error": "SparkAI 需要设置 API_SECRET 环境变量"}

    timestamp = str(int(time.time()))
    signature = calculate_spark_signature(api_key, api_secret, timestamp)

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {signature}",
        "X-Token": api_key,
        "X-Timestamp": timestamp,
        "X-User-Id": str(uuid.uuid4()),
    }

    payload = {
        "model": MODEL_NAME or "spark-3.5",
        "messages": [
            {"role": "system", "content": "你是一位资深的招聘运营专家"},
            {"role": "user", "content": prompt},
        ],
    }

    with httpx.Client() as client:
        response = client.post(base_url, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        data = response.json()

    content = data["choices"][0]["message"]["content"]
    return parse_json_response(content)


def calculate_spark_signature(api_key: str, api_secret: str, timestamp: str) -> str:
    import hmac
    import base64
    message = f"{api_key}{timestamp}"
    signature = hmac.new(api_secret.encode(), message.encode(), hashlib.sha256).digest()
    return base64.b64encode(signature).decode()


def parse_json_response(text: str) -> dict:
    if not text:
        return {"error": "模型未返回有效内容"}

    text = text.strip()
    if text.startswith("```json"):
        text = text[7:-3].strip()
    elif text.startswith("```"):
        text = text[3:-3].strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text[start:end + 1])
            except json.JSONDecodeError:
                pass
        return {"error": f"JSON 解析失败：{text[:200]}"}
