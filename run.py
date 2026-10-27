"""
KOSPI Morning Alpha - 원클릭 실행 런처
- 백엔드 FastAPI 서버 실행
- 스케줄러 자동 등록
- 웹 브라우저 대시보드 자동 오픈
"""

import os
import sys
import time
import webbrowser
import uvicorn


def main():
    host = "127.0.0.1"
    port = 8000
    url = f"http://{host}:{port}"

    print("=" * 60)
    print(" 📈 KOSPI Morning Alpha - 상승 확률 TOP 5 주식 추천 엔진")
    print(f" 🌐 대시보드 URL: {url}")
    print(" ⏰ 자동 스케줄러: 평일 매일 아침 08:15 KST 자동 실행")
    print("=" * 60)

    # 브라우저 자동 오픈 (비동기 스레드)
    def open_browser():
        time.sleep(1.5)
        print(f"[Info] 웹 브라우저 대시보드를 엽니다: {url}")
        webbrowser.open(url)

    import threading
    threading.Thread(target=open_browser, daemon=True).start()

    # FastAPI 서버 구동
    uvicorn.run("backend.app:app", host=host, port=port, reload=False)


if __name__ == "__main__":
    main()
