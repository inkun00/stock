"""
FastAPI 메인 서버 & REST API
- KOSPI 모닝 알파 TOP 5 추천 API
- 인터랙티브 차트 데이터 제공
- 수동 즉시 분석 트리거 & 진행률 SSE/폴링
- 과거 추천 사후 검증(Track Record)
- 프론트엔드 정적 웹앱 서빙
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.data_collector import KospiDataCollector
from backend.scheduler_service import StockAnalysisService

FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))

service = StockAnalysisService()
collector = KospiDataCollector()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 서버 기동 시 스케줄러 등록
    print("[Startup] KOSPI Morning Alpha 서버 기동")
    service.start_scheduler()
    yield
    print("[Shutdown] KOSPI Morning Alpha 서버 종료")


app = FastAPI(
    title="KOSPI Morning Alpha API",
    description="매일 아침 KOSPI 전 종목 상승 확률 TOP 5 주식 추천 엔진",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/overview")
def get_market_overview():
    """최신 KOSPI 지수 및 TOP 5 추천 종목 반환"""
    data = service.get_latest_data()
    return data


@app.get("/api/stock/{code}/candles")
def get_stock_candles(code: str, count: int = 60):
    """특정 종목의 최근 일봉 캔들 데이터 조회 (차트 렌더링용)"""
    candles = collector.fetch_stock_candles(code, count=count)
    if not candles:
        raise HTTPException(status_code=404, detail=f"종목 코드 {code}의 캔들 데이터를 찾을 수 없습니다.")
    return {"code": code, "candles": candles}


@app.post("/api/analyze/now")
def trigger_analysis(background_tasks: BackgroundTasks):
    """사용자 요청에 따른 즉시 재분석 트리거"""
    status = service.get_analysis_status()
    if status.get("isRunning"):
        return {"success": False, "message": "이미 분석 작업이 백그라운드에서 진행 중입니다."}

    background_tasks.add_task(service.execute_daily_analysis)
    return {"success": True, "message": "KOSPI 전 종목 정밀 재분석이 시작되었습니다."}


@app.get("/api/status")
def get_status():
    """현재 분석 진행 상태 및 다음 스케줄 확인"""
    return service.get_analysis_status()


@app.get("/api/history")
def get_history():
    """과거 추천 종목 성과 및 적중률 추적 데이터"""
    return service.get_history_data()


@app.get("/api/screener")
def get_screener():
    """KOSPI 상위 20개 퀀트 스코어링 스크리너"""
    data = service.get_latest_data()
    return {"date": data.get("date"), "screener": data.get("screener", [])}


# 프론트엔드 정적 파일 서빙
if os.path.exists(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

    @app.get("/favicon.ico")
    def serve_favicon():
        return FileResponse(os.path.join(FRONTEND_DIR, "favicon.svg"), media_type="image/svg+xml")

    @app.get("/")
    def serve_index():
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
