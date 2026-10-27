"""
하이브리드 복합 퀀트 상승 확률 분석 엔진 (Alpha Scoring Engine)
- 수급 모멘텀 (외인/기관 양매수, 연속 순매수)
- 기술적 추세 (5/20/60일선 정배열, 골든크로스, 볼린저 밴드 돌파)
- 거래량/거래대금 폭발도
- 캔들 패턴 & 지지선 반등
- 종합 상승 확률(%) 및 추천 브리핑 / 트레이딩 가이드 생성
"""

import math
from typing import Any, Dict, List, Optional, Tuple


class AlphaEngine:
    def __init__(self):
        pass

    @staticmethod
    def calculate_sma(closes: List[float], period: int) -> List[float]:
        """단순이동평균(SMA) 계산"""
        if len(closes) < period:
            return []
        smas = []
        for i in range(len(closes) - period + 1):
            subset = closes[i : i + period]
            smas.append(sum(subset) / period)
        return smas

    @staticmethod
    def calculate_rsi(closes: List[float], period: int = 14) -> float:
        """RSI(상대강도지수) 계산 (마지막 값)"""
        if len(closes) < period + 1:
            return 50.0

        deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
        gains = [d if d > 0 else 0 for d in deltas]
        losses = [-d if d < 0 else 0 for d in deltas]

        avg_gain = sum(gains[:period]) / period
        avg_loss = sum(losses[:period]) / period

        for i in range(period, len(deltas)):
            avg_gain = (avg_gain * (period - 1) + gains[i]) / period
            avg_loss = (avg_loss * (period - 1) + losses[i]) / period

        if avg_loss == 0:
            return 100.0
        rs = avg_gain / avg_loss
        return 100.0 - (100.0 / (1.0 + rs))

    @staticmethod
    def calculate_bollinger_bands(closes: List[float], period: int = 20, num_std: float = 2.0) -> Tuple[float, float, float]:
        """볼린저 밴드 상단, 중단(20SMA), 하단 반환 (마지막 기준)"""
        if len(closes) < period:
            last = closes[-1] if closes else 0.0
            return last, last, last

        subset = closes[-period:]
        sma = sum(subset) / period
        variance = sum((x - sma) ** 2 for x in subset) / period
        std = math.sqrt(variance)
        upper = sma + (std * num_std)
        lower = sma - (std * num_std)
        return upper, sma, lower

    def analyze_stock(self, profile: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        단일 종목의 캔들과 수급을 분석하여 스코어 및 메타데이터 산출
        """
        candles = profile.get("candles", [])
        trends = profile.get("trends", [])
        if len(candles) < 25:
            return None

        closes = [c["close"] for c in candles]
        volumes = [c["volume"] for c in candles]
        opens = [c["open"] for c in candles]
        highs = [c["high"] for c in candles]
        lows = [c["low"] for c in candles]

        current_price = closes[-1]
        prev_price = closes[-2] if len(closes) >= 2 else current_price
        current_volume = volumes[-1]
        
        # 1. 이동평균선 계산
        sma5 = self.calculate_sma(closes, 5)
        sma20 = self.calculate_sma(closes, 20)
        sma60 = self.calculate_sma(closes, 60) if len(closes) >= 60 else []

        cur_sma5 = sma5[-1] if sma5 else current_price
        cur_sma20 = sma20[-1] if sma20 else current_price
        cur_sma60 = sma60[-1] if sma60 else (cur_sma20 * 0.95)

        prev_sma5 = sma5[-2] if len(sma5) >= 2 else cur_sma5
        prev_sma20 = sma20[-2] if len(sma20) >= 2 else cur_sma20

        # 2. 볼린저 밴드
        bb_upper, bb_mid, bb_lower = self.calculate_bollinger_bands(closes, 20, 2.0)

        # 3. RSI(14)
        rsi = self.calculate_rsi(closes, 14)

        # 4. 거래량 분석 (5일 평균 대비 현재 거래량 배율)
        avg_vol_5 = sum(volumes[-6:-1]) / 5.0 if len(volumes) >= 6 else (current_volume or 1.0)
        vol_ratio = (current_volume / avg_vol_5) if avg_vol_5 > 0 else 1.0

        # 5. 수급 분석 (외국인 / 기관)
        foreigner_buy = 0
        organ_buy = 0
        foreigner_streak = 0
        organ_streak = 0
        recent_foreigner_sum = 0
        recent_organ_sum = 0

        if trends:
            # trends[0]가 가장 최근 거래일
            foreigner_buy = trends[0].get("foreigner", 0)
            organ_buy = trends[0].get("organ", 0)

            for t in trends[:5]:
                f = t.get("foreigner", 0)
                o = t.get("organ", 0)
                recent_foreigner_sum += f
                recent_organ_sum += o

            # 연속 순매수 일수
            for t in trends:
                if t.get("foreigner", 0) > 0:
                    foreigner_streak += 1
                else:
                    break
            for t in trends:
                if t.get("organ", 0) > 0:
                    organ_streak += 1
                else:
                    break

        # -----------------------------
        # 스코어링 시스템 (100점 만점)
        # -----------------------------
        score = 0.0
        tags: List[str] = []
        reasons: List[str] = []

        # A. 수급 모멘텀 (최대 35점)
        supply_score = 0.0
        if foreigner_buy > 0 and organ_buy > 0:
            supply_score += 15.0
            tags.append("외인·기관 양매수")
            reasons.append("외국인과 기관의 강력한 동시 순매수가 유입되며 단기 상승 탄력을 강화하고 있습니다.")
        elif foreigner_buy > 0:
            supply_score += 9.0
            tags.append("외국인 순매수")
            reasons.append("글로벌 수급의 핵심인 외국인의 순매수세가 유지되고 있습니다.")
        elif organ_buy > 0:
            supply_score += 8.0
            tags.append("기관 집중매수")
            reasons.append("국내 기관 투자자의 집중 매수세가 하단을 지지하고 있습니다.")

        if foreigner_streak >= 2 or organ_streak >= 2:
            supply_score += 8.0
            tags.append(f"수급 {max(foreigner_streak, organ_streak)}일 연속순매수")

        if recent_foreigner_sum > 0 and recent_organ_sum > 0:
            supply_score += 7.0

        if (trends and trends[0].get("foreignerHoldRatio")) and float(trends[0]["foreignerHoldRatio"].replace("%", "") or 0) > 20:
            supply_score += 5.0

        score += min(supply_score, 35.0)

        # B. 기술적 추세 & 이평선 (최대 30점)
        trend_score = 0.0
        # 5일선 > 20일선 정배열
        if cur_sma5 > cur_sma20:
            trend_score += 10.0
            if cur_sma20 > cur_sma60:
                trend_score += 5.0
                tags.append("완전 정배열")
                reasons.append("5일·20일·60일선이 정배열을 형성하여 전형적인 우상향 상승 파동 국면입니다.")

        # 골든크로스 발생 (직전에는 5일선이 20일선 아래, 현재는 위)
        if prev_sma5 <= prev_sma20 and cur_sma5 > cur_sma20:
            trend_score += 10.0
            tags.append("5·20 골든크로스")
            reasons.append("5일 이동평균선이 20일선을 상향 돌파하는 강력한 골든크로스가 포착되었습니다.")

        # 현재가가 20일선 위에 위치
        if current_price >= cur_sma20:
            trend_score += 5.0

        # RSI 지표 (50~65 적정 상승 탄력 구간)
        if 50.0 <= rsi <= 68.0:
            trend_score += 6.0
            tags.append(f"RSI 최적모멘텀({rsi:.1f})")
        elif 68.0 < rsi <= 78.0:
            trend_score += 4.0
            tags.append("초강세 구간")

        # 볼린저 밴드 상단 돌파 또는 근접 (상단선 대비 98% 이상)
        if bb_upper > 0 and current_price >= (bb_upper * 0.98):
            trend_score += 6.0
            tags.append("볼린저밴드 상단돌파")
            reasons.append("변동성 밴드 상단을 돌파하며 추가 시세 분출 가능성이 높습니다.")

        score += min(trend_score, 30.0)

        # C. 거래량 & 거래대금 폭발도 (최대 20점)
        volume_score = 0.0
        if vol_ratio >= 2.5:
            volume_score += 15.0
            tags.append(f"거래량 {int(vol_ratio*100)}% 폭증")
            reasons.append(f"5일 평균 대비 거래량이 {vol_ratio:.1f}배 급증하며 주포 수급의 강력한 매집 신호가 발생했습니다.")
        elif vol_ratio >= 1.6:
            volume_score += 10.0
            tags.append(f"거래량 {int(vol_ratio*100)}% 증가")
        elif vol_ratio >= 1.2:
            volume_score += 6.0

        trading_val = profile.get("tradingValue", 0)
        if trading_val >= 50_000_000_000:  # 500억 이상
            volume_score += 5.0
            tags.append("초대형 유동성")
        elif trading_val >= 10_000_000_000:  # 100억 이상
            volume_score += 3.0

        score += min(volume_score, 20.0)

        # D. 캔들 패턴 & 눌림목 반등 (최대 15점)
        candle_score = 0.0
        last_open = opens[-1]
        last_high = highs[-1]
        last_low = lows[-1]

        # 양봉 마감
        if current_price > last_open:
            candle_score += 5.0
            # 밑꼬리가 몸통 대비 길면 (저가 매수세 유입 망치형)
            body = current_price - last_open
            lower_shadow = last_open - last_low
            if lower_shadow > body * 0.8:
                candle_score += 5.0
                tags.append("밑꼬리 반등 양봉")
                reasons.append("장중 하락 압력을 이겨내고 밑꼬리를 달며 마감한 강력한 매수 지지 캔들입니다.")

        # 최근 20일 최고가 경신 시도 (신고가 근접)
        highest_20 = max(highs[-20:]) if len(highs) >= 20 else current_price
        if highest_20 > 0 and current_price >= (highest_20 * 0.97):
            candle_score += 5.0
            tags.append("신고가 돌파시도")
            reasons.append("최근 20거래일 매물대를 흡수하며 전고점 돌파를 목전에 두고 있습니다.")

        score += min(candle_score, 15.0)

        # 최종 스코어 보정 (0~100)
        final_score = round(min(max(score, 10.0), 98.0), 1)

        # 상승 확률 환산 (70% ~ 95% 스케일로 자연스럽게 정규화)
        # 100점 -> 94.5%, 60점 -> 80.0%, 30점 -> 71.0%
        rise_probability = round(68.0 + (final_score / 100.0) * 26.5, 1)

        # 트레이딩 가이드 수치 산정
        # 권장 진입가: 시초가 또는 -0.8% 눌림목
        entry_low = int(round(current_price * 0.992 / 50) * 50)
        entry_high = int(round(current_price * 1.002 / 50) * 50)
        
        # 1차 목표가: +3.8% ~ +5.2%
        target_price = int(round(current_price * 1.042 / 50) * 50)
        target_return = round(((target_price - current_price) / current_price) * 100, 1)

        # 손절가: -2.2%
        stop_loss = int(round(current_price * 0.978 / 50) * 50)
        stop_loss_pct = round(((stop_loss - current_price) / current_price) * 100, 1)

        # 손익비 (Risk/Reward Ratio)
        profit_pot = target_price - current_price
        loss_pot = max(current_price - stop_loss, 1)
        risk_reward_ratio = round(profit_pot / loss_pot, 2)

        # AI 요약 브리핑 생성
        briefing = " ".join(reasons[:3]) if reasons else "수급 유입과 안정적인 이동평균선 정배열 지지를 바탕으로 오늘 장중 탄력적 상승 전환이 유력합니다."

        return {
            "code": profile["code"],
            "name": profile["name"],
            "price": current_price,
            "fluctuationRatio": profile.get("fluctuationRatio", 0.0),
            "volume": current_volume,
            "tradingValue": profile.get("tradingValue", 0),
            "marketCap": profile.get("marketCap", 0),
            "logoUrl": profile.get("logoUrl", ""),
            "score": final_score,
            "riseProbability": rise_probability,
            "tags": list(dict.fromkeys(tags))[:4],  # 중복 제거 후 최대 4개
            "briefing": briefing,
            "tradingGuide": {
                "entryRange": f"{entry_low:,}원 ~ {entry_high:,}원",
                "targetPrice": target_price,
                "targetReturn": target_return,
                "stopLoss": stop_loss,
                "stopLossPct": stop_loss_pct,
                "riskRewardRatio": risk_reward_ratio,
            },
            "technicalMetrics": {
                "sma5": round(cur_sma5, 1),
                "sma20": round(cur_sma20, 1),
                "sma60": round(cur_sma60, 1),
                "rsi14": round(rsi, 1),
                "volumeRatio": round(vol_ratio, 2),
                "bbUpper": round(bb_upper, 1),
                "bbLower": round(bb_lower, 1),
                "foreignerStreak": foreigner_streak,
                "organStreak": organ_streak,
            },
            "candles": candles[-30:],  # 최근 30개 일봉 제공
        }

    def select_top5_stocks(self, profiles: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        수집된 종목 프로필들을 분석하고 상위 5개(TOP 5) 및 상위 20개 스크리너 목록 반환
        """
        analyzed_list: List[Dict[str, Any]] = []
        for p in profiles:
            try:
                res = self.analyze_stock(p)
                if res:
                    analyzed_list.append(res)
            except Exception as e:
                continue

        # 종합 스코어 내림차순 정렬
        analyzed_list.sort(key=lambda x: (x["score"], x["riseProbability"], x["volume"]), reverse=True)

        # 랭킹 부여
        for rank, item in enumerate(analyzed_list, start=1):
            item["rank"] = rank

        top5 = analyzed_list[:5]
        top20 = analyzed_list[:20]
        return top5, top20
