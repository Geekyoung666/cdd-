from __future__ import annotations

import json
import os
import re
from typing import Optional

import httpx
from dotenv import load_dotenv

load_dotenv()

SYSTEM_PROMPT = "你是一位资深的招聘运营专家"

PROVIDER_DEFAULTS = {
    "openai": {
        "base_url": "https://api.openai.com/v1",
        "model": "gpt-4o-mini",
    },
    "deepseek": {
        "base_url": "https://api.deepseek.com/v1",
        "model": "deepseek-chat",
    },
    "gemini": {
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai",
        "model": "gemini-2.0-flash",
    },
    "claude": {
        "base_url": "https://api.anthropic.com/v1",
        "model": "claude-3-5-sonnet-latest",
    },
    "openai-compatible": {
        "base_url": "https://api.openai.com/v1",
        "model": "gpt-4o-mini",
    },
}

OPENAI_COMPATIBLE_PROVIDERS = {"openai", "deepseek", "gemini", "openai-compatible"}
ANTHROPIC_PROVIDERS = {"claude", "anthropic"}


def normalize_provider(provider: Optional[str]) -> str:
    value = (provider or "").strip().lower()
    aliases = {
        "anthropic": "claude",
        "google": "gemini",
        "google-openai": "gemini",
        "custom": "openai-compatible",
        "openai_compatible": "openai-compatible",
    }
    return aliases.get(value, value or "openai")


def build_strategy_prompt(candidate: dict, rfm: dict) -> str:
    return f"""
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
备注：{candidate.get('note', '无')}

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
""".strip()


def resolve_runtime_config(runtime_config: Optional[dict] = None) -> dict:
    runtime_config = runtime_config or {}
    provider = normalize_provider(runtime_config.get("provider") or os.getenv("LLM_PROVIDER"))
    defaults = PROVIDER_DEFAULTS.get(provider, PROVIDER_DEFAULTS["openai-compatible"])

    api_key = (
        runtime_config.get("apiKey")
        or runtime_config.get("api_key")
        or os.getenv("API_KEY")
        or (os.getenv("DEEPSEEK_API_KEY") if provider == "deepseek" else None)
        or ""
    ).strip()
    base_url = (
        runtime_config.get("baseUrl")
        or runtime_config.get("base_url")
        or os.getenv("API_BASE_URL")
        or (os.getenv("DEEPSEEK_API_BASE_URL") if provider == "deepseek" else None)
        or defaults["base_url"]
    ).strip()
    model = (
        runtime_config.get("model")
        or runtime_config.get("model_name")
        or os.getenv("MODEL_NAME")
        or (os.getenv("DEEPSEEK_MODEL") if provider == "deepseek" else None)
        or defaults["model"]
    ).strip()

    return {
        "provider": provider,
        "api_key": api_key,
        "base_url": base_url,
        "model": model,
    }


def generate_strategy(candidate: dict, rfm: dict, runtime_config: Optional[dict] = None) -> dict:
    config = resolve_runtime_config(runtime_config)
    if not config["api_key"]:
        return {"error": "缺少 API Key，请在请求体或环境变量中提供 apiKey/API_KEY"}

    prompt = build_strategy_prompt(candidate, rfm)

    try:
        provider = config["provider"]
        if provider in OPENAI_COMPATIBLE_PROVIDERS:
            result = call_openai_compatible(prompt, config)
        elif provider in ANTHROPIC_PROVIDERS:
            result = call_anthropic(prompt, config)
        else:
            return {"error": f"暂不支持的 provider：{provider}"}

        if "error" not in result:
            result["provider"] = provider
            result["model"] = config["model"]
        return result
    except Exception as e:
        return {"error": f"API 调用失败：{str(e)}"}


def build_openai_compatible_url(base_url: str) -> str:
    base_url = (base_url or "").rstrip("/")
    if not base_url:
        return "https://api.openai.com/v1/chat/completions"
    if base_url.endswith("/chat/completions"):
        return base_url
    return f"{base_url}/chat/completions"


def call_openai_compatible(prompt: str, config: dict) -> dict:
    headers = {
        "Authorization": f"Bearer {config['api_key']}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": config["model"],
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.7,
    }

    with httpx.Client() as client:
        response = client.post(
            build_openai_compatible_url(config["base_url"]),
            headers=headers,
            json=payload,
            timeout=60,
        )
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            detail = exc.response.text[:500] if exc.response is not None else str(exc)
            status_code = exc.response.status_code if exc.response is not None else "unknown"
            raise RuntimeError(f"{config['provider']} API 返回错误 {status_code}: {detail}") from exc
        data = response.json()

    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError(f"{config['provider']} API 响应格式异常：{json.dumps(data, ensure_ascii=False)[:500]}") from exc
    return parse_json_response(content)


def build_anthropic_messages_url(base_url: str) -> str:
    base_url = (base_url or "").rstrip("/")
    if not base_url:
        return "https://api.anthropic.com/v1/messages"
    if base_url.endswith("/messages"):
        return base_url
    return f"{base_url}/messages"


def call_anthropic(prompt: str, config: dict) -> dict:
    headers = {
        "x-api-key": config["api_key"],
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    payload = {
        "model": config["model"],
        "system": SYSTEM_PROMPT,
        "messages": [
            {"role": "user", "content": prompt},
        ],
        "max_tokens": 1200,
        "temperature": 0.7,
    }

    with httpx.Client() as client:
        response = client.post(
            build_anthropic_messages_url(config["base_url"]),
            headers=headers,
            json=payload,
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()

    content_blocks = data.get("content", [])
    text = "".join(block.get("text", "") for block in content_blocks if block.get("type") == "text")
    return parse_json_response(text)


def parse_json_response(text: str) -> dict:
    if not text:
        return {"error": "模型未返回有效内容"}

    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    if text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", text)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass
        return {"error": f"JSON 解析失败：{text[:200]}"}
