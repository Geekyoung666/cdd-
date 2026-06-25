import os
import json


def get_gemini_client():
    try:
        import google.generativeai as genai
    except Exception as e:
        return None, f"Gemini 库加载失败：{str(e)}"

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None, "GEMINI_API_KEY 环境变量未设置"
    genai.configure(api_key=api_key)
    return genai.GenerativeModel("gemini-1.5-flash"), None


def generate_strategy(candidate: dict, rfm: dict) -> dict:
    client, error = get_gemini_client()
    if error:
        return {"error": error}

    try:
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

        response = client.generate_content(prompt)
        if not response or not response.text:
            return {"error": "Gemini 未返回有效内容"}

        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:-3].strip()
        elif text.startswith("```"):
            text = text[3:-3].strip()

        result = json.loads(text)
        return result

    except json.JSONDecodeError:
        return {"error": "Gemini 返回格式解析失败，请检查模型输出"}
    except Exception as e:
        return {"error": f"Gemini 调用失败：{str(e)}"}