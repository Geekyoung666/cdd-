from typing import Tuple


def calculate_r_score(last_contact_days: int) -> int:
    if last_contact_days <= 7:
        return 3
    elif 8 <= last_contact_days <= 30:
        return 2
    else:
        return 1


def calculate_f_score(interact_count: int) -> int:
    if interact_count >= 4:
        return 3
    elif 2 <= interact_count <= 3:
        return 2
    else:
        return 1


def calculate_i_score(intent_score: int) -> int:
    if intent_score >= 4:
        return 3
    elif intent_score == 3:
        return 2
    else:
        return 1


def calculate_segment(r: int, f: int, i: int, total: int) -> str:
    if i == 3 and r >= 2:
        return "重点唤醒"
    elif 6 <= total <= 7:
        return "保持温度"
    elif 4 <= total <= 5:
        return "低优先唤醒"
    else:
        return "沉睡观察"


def calculate_rfm(last_contact_days: int, interact_count: int, intent_score: int) -> dict:
    r = calculate_r_score(last_contact_days)
    f = calculate_f_score(interact_count)
    i = calculate_i_score(intent_score)
    total = r + f + i
    segment = calculate_segment(r, f, i, total)
    return {
        "r": r,
        "f": f,
        "i": i,
        "total": total,
        "segment": segment,
    }