"""
KOSPI Morning Alpha - GitHub Actions & Daily CLI Job
매일 아침 KOSPI 전 종목을 자동 분석하고 data/latest_top5.json 및 data/history.json을 갱신합니다.
"""

import json
import os
import shutil
from datetime import datetime

from backend.scheduler_service import StockAnalysisService

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "data"))
BACKEND_CACHE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "backend", "cache"))


def run():
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] KOSPI 아침 분석 잡 시작...")
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(BACKEND_CACHE_DIR, exist_ok=True)

    service = StockAnalysisService()
    # KOSPI 유니버스 상위 페이지 수집 및 분석 (안정적 4페이지 = 약 400종목)
    result = service.execute_daily_analysis(max_pages=4)

    if not result.get("success"):
        print(f"[Error] 분석 실패: {result.get('message')}")
        return False

    data = result["data"]
    top5 = data.get("top5", [])
    print(f"[Success] 분석 완료! 도출된 TOP 5:")
    for s in top5:
        print(f"  - #{s['rank']} {s['name']} ({s['code']}) | 가격: {s['price']:,}원 | 스코어: {s['score']}점 | 상승확률: {s['riseProbability']}%")

    # data 디렉토리로 동기화 복사
    src_latest = os.path.join(BACKEND_CACHE_DIR, "latest_top5.json")
    dst_latest = os.path.join(DATA_DIR, "latest_top5.json")
    if os.path.exists(src_latest):
        shutil.copyfile(src_latest, dst_latest)

    src_history = os.path.join(BACKEND_CACHE_DIR, "history.json")
    dst_history = os.path.join(DATA_DIR, "history.json")
    if os.path.exists(src_history):
        shutil.copyfile(src_history, dst_history)

    print("[Success] data/latest_top5.json 및 data/history.json 갱신 완료")
    return True


if __name__ == "__main__":
    success = run()
    if not success:
        exit(1)
