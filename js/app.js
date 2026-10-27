/**
 * KOSPI Morning Alpha - Main Application Controller
 * Handles data fetching, reactive UI updates, tab switching, and chart interactions.
 */

document.addEventListener('DOMContentLoaded', () => {
  const app = new KospiApp();
  app.init();
});

class KospiApp {
  constructor() {
    this.latestData = null;
    this.historyData = [];
    this.screenerData = [];
    this.currentChart = null;
    this.pollingInterval = null;

    // DOM Elements
    this.top5Container = document.getElementById('top5CardsContainer');
    this.screenerTableBody = document.getElementById('screenerTableBody');
    this.historyAccordion = document.getElementById('historyAccordion');
    this.btnRefresh = document.getElementById('btnRefresh');
    this.loadingOverlay = document.getElementById('loadingOverlay');
    this.progressBarFill = document.getElementById('progressBarFill');
    this.progressPercentText = document.getElementById('progressPercentText');
    this.loadingStepText = document.getElementById('loadingStepText');
    this.chartModal = document.getElementById('chartModal');
    this.modalCloseBtn = document.getElementById('modalCloseBtn');
    this.screenerSearchInput = document.getElementById('screenerSearchInput');
  }

  async init() {
    this.initTabs();
    this.initModal();
    this.initRefreshButton();
    this.initSearch();
    this.startCountdownTimer();

    // 초기 데이터 로드
    await this.loadOverview();
    await this.loadHistory();
  }

  /* ========================================================================
     Tabs Navigation
     ======================================================================== */
  initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const target = btn.dataset.tab;
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        const targetEl = document.getElementById(`tab${target.charAt(0).toUpperCase() + target.slice(1)}`);
        if (targetEl) targetEl.classList.add('active');
      });
    });
  }

  /* ========================================================================
     Data Fetching (Supports both Local Backend API & GitHub Pages Static Hosting)
     ======================================================================== */
  async loadOverview() {
    try {
      let data = null;
      // 1순위: 로컬 FastAPI 백엔드 API 시도
      try {
        const res = await fetch('/api/overview');
        if (res.ok) data = await res.json();
      } catch (e) {
        // 백엔드가 없는 정적 호스팅 환경
      }

      // 2순위: GitHub Pages 정적 JSON 데이터 로드
      if (!data) {
        const staticRes = await fetch('./data/latest_top5.json');
        if (staticRes.ok) data = await staticRes.json();
      }

      if (data) {
        this.latestData = data;
        this.renderHeader();
        this.renderTop5();
        this.renderScreener();
      }
    } catch (err) {
      console.error('Overview 로드 실패:', err);
    }
  }

  async loadHistory() {
    try {
      let history = null;
      try {
        const res = await fetch('/api/history');
        if (res.ok) history = await res.json();
      } catch (e) {
        // 정적 호스팅 환경
      }

      if (!history) {
        const staticRes = await fetch('./data/history.json');
        if (staticRes.ok) history = await staticRes.json();
      }

      if (history) {
        this.historyData = history;
        this.renderHistory();
      }
    } catch (err) {
      console.error('History 로드 실패:', err);
    }
  }

  /* ========================================================================
     Header & Meta Rendering
     ======================================================================== */
  renderHeader() {
    if (!this.latestData) return;
    const market = this.latestData.market || {};

    // KOSPI Index
    const priceEl = document.getElementById('kospiPrice');
    const changeEl = document.getElementById('kospiChange');
    if (priceEl) priceEl.textContent = market.closePrice || '2,650.00';
    if (changeEl) {
      const change = market.fluctuationsRatio || '+0.00';
      changeEl.textContent = `${change.startsWith('+') || change.startsWith('-') ? '' : '+'}${change}%`;
      changeEl.className = `index-change ${change.startsWith('-') ? 'down' : 'up'}`;
    }

    // Meta
    const analyzedAtText = document.getElementById('analyzedAtText');
    const analyzedCountText = document.getElementById('analyzedCountText');
    if (analyzedAtText) analyzedAtText.textContent = this.latestData.analyzedAt || '오늘 아침 08:15 KST';
    if (analyzedCountText) analyzedCountText.textContent = `${this.latestData.analyzedCount || 380}`;
  }

  /* ========================================================================
     TOP 5 Cards Rendering
     ======================================================================== */
  renderTop5() {
    if (!this.latestData || !this.latestData.top5 || !this.top5Container) return;
    const top5 = this.latestData.top5;

    this.top5Container.innerHTML = top5.map((stock, idx) => {
      const rank = stock.rank || (idx + 1);
      const isFirst = rank === 1;
      
      const rankBadgeClass = rank === 1 ? 'badge-gold' : rank === 2 ? 'badge-silver' : rank === 3 ? 'badge-bronze' : 'badge-blue';
      const rankBadgeIcon = rank === 1 ? 'fa-crown' : rank === 2 ? 'fa-medal' : rank === 3 ? 'fa-award' : 'fa-star';
      const rankBadgeText = rank === 1 ? '1위 KING ALPHA' : `${rank}위 유망주`;

      const fluct = stock.fluctuationRatio || 0.0;
      const isUp = fluct >= 0;
      const fluctSign = isUp ? '+' : '';

      const prob = stock.riseProbability || 85.0;
      // SVG Circle 계산 (둘레: 2 * PI * 28 ≈ 175.9)
      const circumference = 2 * Math.PI * 28;
      const strokeDashoffset = circumference - (prob / 100) * circumference;
      const strokeColor = rank === 1 ? '#f59e0b' : '#00f0ff';

      const guide = stock.tradingGuide || {
        entryRange: `${stock.price.toLocaleString()}원`,
        targetPrice: Math.round(stock.price * 1.042),
        targetReturn: 4.2,
        stopLoss: Math.round(stock.price * 0.978),
        stopLossPct: -2.2,
        riskRewardRatio: 1.9
      };

      const tagsHtml = (stock.tags || []).map(t => `<span class="tag-chip"><i class="fa-solid fa-tag"></i> ${t}</span>`).join('');
      const logoHtml = stock.logoUrl 
        ? `<img src="${stock.logoUrl}" class="stock-logo" alt="${stock.name}" onerror="this.style.display='none'">` 
        : `<div class="stock-logo" style="display:flex;align-items:center;justify-content:center;font-weight:700;color:#00f0ff;">${stock.name.slice(0, 1)}</div>`;

      return `
        <div class="stock-card rank-${rank} glass-panel">
          <div>
            <div class="card-header-row">
              <div class="stock-title-wrap">
                ${logoHtml}
                <div class="stock-names">
                  <div class="stock-name-row">
                    <span class="stock-name">${stock.name}</span>
                    <span class="stock-code">${stock.code}</span>
                  </div>
                </div>
              </div>
              <div class="rank-badge ${rankBadgeClass}">
                <i class="fa-solid ${rankBadgeIcon}"></i>
                <span>${rankBadgeText}</span>
              </div>
            </div>

            <div class="card-metrics-row">
              <div class="price-block">
                <span class="current-price">${stock.price.toLocaleString()}<span style="font-size:1.1rem;font-weight:500;">원</span></span>
                <span class="price-change-pill ${isUp ? 'change-up' : 'change-down'}">
                  <i class="fa-solid ${isUp ? 'fa-arrow-up' : 'fa-arrow-down'}"></i>
                  <span>${fluctSign}${fluct}%</span>
                  <span style="color:#64748b;font-weight:400;margin-left:4px;">(전일비)</span>
                </span>
              </div>

              <div class="prob-widget">
                <div class="prob-circle-wrap">
                  <svg class="prob-circle-svg" viewBox="0 0 68 68">
                    <circle class="circle-bg" cx="34" cy="34" r="28" />
                    <circle class="circle-progress" cx="34" cy="34" r="28" 
                            stroke="${strokeColor}" 
                            stroke-dasharray="${circumference}" 
                            stroke-dashoffset="${strokeDashoffset}" />
                  </svg>
                  <div class="prob-center-text" style="color:${strokeColor};">${prob}%</div>
                </div>
                <div class="prob-meta">
                  <span class="prob-label">상승 확률 모델</span>
                  <span class="prob-title">당일 상승 유력</span>
                  <span class="quant-score-text">알파 스코어: <strong style="color:#fff;">${stock.score}점</strong></span>
                </div>
              </div>
            </div>

            <div class="tag-chips-wrap">
              ${tagsHtml}
            </div>

            <div class="ai-briefing-box">
              <i class="fa-solid fa-quote-left" style="color:#00f0ff;margin-right:6px;opacity:0.6;"></i>
              ${stock.briefing || '외인·기관의 적극적인 순매수와 이평선 정배열 지지가 결합되어 단기 시세 분출이 유력합니다.'}
            </div>

            <div class="trading-guide-grid">
              <div class="guide-cell">
                <span class="guide-cell-label"><i class="fa-solid fa-right-to-bracket"></i> 권장 진입가</span>
                <span class="guide-cell-val" style="font-size:0.8rem;">${guide.entryRange}</span>
              </div>
              <div class="guide-cell">
                <span class="guide-cell-label"><i class="fa-solid fa-bullseye"></i> 1차 목표가</span>
                <span class="guide-cell-val val-target">${guide.targetPrice.toLocaleString()}원 <small>(+${guide.targetReturn}%)</small></span>
              </div>
              <div class="guide-cell">
                <span class="guide-cell-label"><i class="fa-solid fa-triangle-exclamation"></i> 손절가 기준</span>
                <span class="guide-cell-val val-stop">${guide.stopLoss.toLocaleString()}원 <small>(${guide.stopLossPct}%)</small></span>
              </div>
              <div class="guide-cell">
                <span class="guide-cell-label"><i class="fa-solid fa-scale-unbalanced"></i> 손익비</span>
                <span class="guide-cell-val" style="color:#a855f7;">1 : ${guide.riskRewardRatio}</span>
              </div>
            </div>
          </div>

          <div class="card-actions-row">
            <button class="btn-open-chart" data-code="${stock.code}" data-name="${stock.name}" data-price="${stock.price}" data-change="${fluctSign}${fluct}%" data-logo="${stock.logoUrl || ''}">
              <i class="fa-solid fa-chart-candlestick"></i>
              <span>인터랙티브 캔들 차트 & 보조지표 분석</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // 차트 열기 이벤트 바인딩
    this.top5Container.querySelectorAll('.btn-open-chart').forEach(btn => {
      btn.addEventListener('click', () => {
        this.openChartModal(btn.dataset.code, btn.dataset.name, btn.dataset.price, btn.dataset.change, btn.dataset.logo);
      });
    });
  }

  /* ========================================================================
     Screener Rendering
     ======================================================================== */
  renderScreener() {
    if (!this.latestData || !this.latestData.screener || !this.screenerTableBody) return;
    this.screenerData = this.latestData.screener;
    this.filterAndRenderScreenerTable('');
  }

  filterAndRenderScreenerTable(keyword) {
    const list = this.screenerData.filter(s => {
      if (!keyword) return true;
      const k = keyword.toLowerCase();
      return s.name.toLowerCase().includes(k) || s.code.includes(k);
    });

    if (!list.length) {
      this.screenerTableBody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:30px;color:#64748b;">검색된 종목이 없습니다.</td></tr>`;
      return;
    }

    this.screenerTableBody.innerHTML = list.map(s => {
      const fluct = s.fluctuationRatio || 0.0;
      const isUp = fluct >= 0;
      const rsi = s.technicalMetrics ? s.technicalMetrics.rsi14 : 50;
      const volRatio = s.technicalMetrics ? s.technicalMetrics.volumeRatio : 1.0;
      const tags = (s.tags || []).slice(0, 2).map(t => `<span class="tag-chip" style="font-size:0.7rem;padding:2px 6px;">${t}</span>`).join(' ');

      return `
        <tr>
          <td><strong style="color:${s.rank <= 3 ? '#f59e0b' : '#94a3b8'};">${s.rank}</strong></td>
          <td>
            <div style="font-weight:700;">${s.name}</div>
            <div style="font-size:0.75rem;color:#64748b;font-family:monospace;">${s.code}</div>
          </td>
          <td style="font-family:'Outfit';font-weight:600;">${s.price.toLocaleString()}원</td>
          <td style="font-family:'Outfit';font-weight:700;color:${isUp ? '#f43f5e' : '#3b82f6'};">${isUp ? '+' : ''}${fluct}%</td>
          <td><span style="font-family:'Outfit';font-weight:700;color:#00f0ff;">${s.riseProbability}%</span></td>
          <td><span style="font-weight:700;color:#f8fafc;">${s.score}점</span></td>
          <td><span style="color:${rsi > 65 ? '#f43f5e' : '#94a3b8'};font-weight:600;">${rsi}</span></td>
          <td><span style="color:${volRatio > 2.0 ? '#10b981' : '#94a3b8'};font-weight:600;">${volRatio}배</span></td>
          <td>${tags}</td>
          <td>
            <button class="btn-table-chart" data-code="${s.code}" data-name="${s.name}" data-price="${s.price}" data-change="${isUp ? '+' : ''}${fluct}%" data-logo="${s.logoUrl || ''}">
              <i class="fa-solid fa-chart-simple"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    this.screenerTableBody.querySelectorAll('.btn-table-chart').forEach(btn => {
      btn.addEventListener('click', () => {
        this.openChartModal(btn.dataset.code, btn.dataset.name, btn.dataset.price, btn.dataset.change, btn.dataset.logo);
      });
    });
  }

  initSearch() {
    if (this.screenerSearchInput) {
      this.screenerSearchInput.addEventListener('input', (e) => {
        this.filterAndRenderScreenerTable(e.target.value.trim());
      });
    }
  }

  /* ========================================================================
     History (Track Record) Rendering
     ======================================================================== */
  renderHistory() {
    if (!this.historyAccordion) return;
    if (!this.historyData.length) {
      this.historyAccordion.innerHTML = `<div style="text-align:center;padding:20px;color:#64748b;">과거 추천 이력이 준비 중입니다.</div>`;
      return;
    }

    this.historyAccordion.innerHTML = this.historyData.map((item, idx) => {
      const recommends = item.recommends || [];
      const rows = recommends.map(r => {
        const isUp = r.dayHighReturn >= 0;
        return `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.85rem;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-weight:700;color:${r.rank === 1 ? '#f59e0b' : '#94a3b8'};width:20px;">#${r.rank}</span>
              <span style="font-weight:600;color:#fff;">${r.name}</span>
              <span style="font-size:0.75rem;color:#64748b;font-family:monospace;">${r.code}</span>
            </div>
            <div style="display:flex;align-items:center;gap:18px;">
              <span style="color:#94a3b8;">추천 확률: <strong style="color:#00f0ff;">${r.riseProbability}%</strong></span>
              <span style="color:#94a3b8;">당일 최고 상승률: <strong style="color:#f43f5e;font-family:'Outfit';font-size:0.95rem;">+${r.dayHighReturn}%</strong></span>
              <span style="color:#94a3b8;">종가: <span style="color:${r.dayCloseReturn >= 0 ? '#f43f5e' : '#3b82f6'};">${r.dayCloseReturn >= 0 ? '+' : ''}${r.dayCloseReturn}%</span></span>
              <span class="meta-tag" style="font-size:0.72rem;background:${r.hit ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)'};color:${r.hit ? '#10b981' : '#f43f5e'};">
                ${r.hit ? '<i class="fa-solid fa-check"></i> 적중' : '<i class="fa-solid fa-xmark"></i> 손절'}
              </span>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="history-date-item">
          <div class="history-date-header">
            <div class="history-date-title">
              <i class="fa-regular fa-calendar-days" style="color:#00f0ff;margin-right:8px;"></i>
              ${item.date} 추천 포트폴리오 성과
            </div>
            <div class="history-chips">
              <span class="tab-badge-accent">당일 승률: ${item.winRate}%</span>
              <span class="meta-tag" style="background:rgba(245,158,11,0.15);color:#f59e0b;">평균 최고 상승: +${item.avgHighReturn}%</span>
            </div>
          </div>
          <div>
            ${rows}
          </div>
        </div>
      `;
    }).join('');
  }

  /* ========================================================================
     Interactive Chart Modal
     ======================================================================== */
  initModal() {
    if (this.modalCloseBtn) {
      this.modalCloseBtn.addEventListener('click', () => {
        this.chartModal.classList.remove('open');
      });
    }

    if (this.chartModal) {
      this.chartModal.addEventListener('click', (e) => {
        if (e.target === this.chartModal) {
          this.chartModal.classList.remove('open');
        }
      });
    }

    // ESC 키로 모달 닫기
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.chartModal.classList.contains('open')) {
        this.chartModal.classList.remove('open');
      }
    });

    this.chart = new StockCandleChart('candleCanvas', 'chartTooltip');
  }

  async openChartModal(code, name, price, change, logoUrl) {
    document.getElementById('modalStockName').textContent = name;
    document.getElementById('modalStockCode').textContent = code;
    document.getElementById('modalStockPrice').textContent = `${Number(price).toLocaleString()}원`;
    
    const changeEl = document.getElementById('modalStockChange');
    changeEl.textContent = change;
    changeEl.style.color = change.startsWith('-') ? '#3b82f6' : '#f43f5e';

    const logoEl = document.getElementById('modalStockLogo');
    if (logoUrl) {
      logoEl.src = logoUrl;
      logoEl.style.display = 'block';
    } else {
      logoEl.style.display = 'none';
    }

    this.chartModal.classList.add('open');

    // 1. 이미 메모리에 있는 캔들 데이터 확인 (GitHub Pages 정적 모드 지원)
    let foundCandles = [];
    if (this.latestData) {
      const allStocks = [...(this.latestData.top5 || []), ...(this.latestData.screener || [])];
      const match = allStocks.find(s => s.code === code);
      if (match && match.candles && match.candles.length) {
        foundCandles = match.candles;
      }
    }

    if (foundCandles.length > 0) {
      this.chart.setData(foundCandles);
      return;
    }

    // 2. 백엔드 API 캔들 데이터 로드 시도
    try {
      this.chart.setData([]); // 초기화
      const res = await fetch(`/api/stock/${code}/candles?count=60`);
      if (res.ok) {
        const json = await res.json();
        this.chart.setData(json.candles || []);
      }
    } catch (err) {
      console.error('캔들 데이터 로드 실패:', err);
    }
  }

  /* ========================================================================
     Instant Analysis & Progress Polling
     ======================================================================== */
  initRefreshButton() {
    if (!this.btnRefresh) return;
    this.btnRefresh.addEventListener('click', async () => {
      if (confirm('코스피 전 종목을 실시간으로 다시 분석하시겠습니까? (약 20~40초 소요)')) {
        await this.triggerAnalysis();
      }
    });
  }

  async triggerAnalysis() {
    this.showLoadingOverlay(true);
    try {
      const res = await fetch('/api/analyze/now', { method: 'POST' });
      if (!res.ok) throw new Error('API Unavailable');
      const data = await res.json();
      if (!data.success && data.message.includes('진행 중')) {
        // 이미 진행 중이면 바로 폴링 진입
      }
      this.startStatusPolling();
    } catch (err) {
      // GitHub Pages 정적 환경인 경우
      this.updateProgressBar(80, '최신 저장소 데이터 동기화 중...');
      setTimeout(async () => {
        await this.loadOverview();
        await this.loadHistory();
        this.updateProgressBar(100, '최신 분석 데이터 새로고침 완료!');
        setTimeout(() => {
          this.showLoadingOverlay(false);
          alert('GitHub Pages(정적 모드) 환경입니다.\nGitHub Actions가 매일 아침 08:15 KST에 자동으로 분석을 실행하여 저장소를 갱신합니다.\n(로컬 환경에서는 python run.py 실행 시 30초 내 실시간 재분석이 가능합니다.)');
        }, 600);
      }, 1000);
    }
  }

  startStatusPolling() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);

    this.pollingInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/status');
        if (res.ok) {
          const status = await res.json();
          const prog = status.progress || {};

          this.updateProgressBar(prog.percent || 10, prog.message || '분석 중...');

          if (!status.isRunning && prog.status === 'completed') {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
            setTimeout(async () => {
              this.showLoadingOverlay(false);
              await this.loadOverview();
              await this.loadHistory();
            }, 800);
          } else if (!status.isRunning && prog.status === 'error') {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
            alert(`분석 실패: ${prog.message}`);
            this.showLoadingOverlay(false);
          }
        }
      } catch (e) {
        console.error('Status 폴링 오류:', e);
      }
    }, 1200);
  }

  showLoadingOverlay(show) {
    if (!this.loadingOverlay) return;
    if (show) {
      this.loadingOverlay.classList.add('open');
      this.updateProgressBar(10, 'KOSPI 전 종목 시세 조회 시작...');
    } else {
      this.loadingOverlay.classList.remove('open');
    }
  }

  updateProgressBar(percent, message) {
    if (this.progressBarFill) this.progressBarFill.style.width = `${percent}%`;
    if (this.progressPercentText) this.progressPercentText.textContent = `${percent}%`;
    if (this.loadingStepText) this.loadingStepText.textContent = message;
  }

  /* ========================================================================
     Countdown Timer (To Next 08:15 KST)
     ======================================================================== */
  startCountdownTimer() {
    const countdownEl = document.getElementById('nextRunCountdown');
    if (!countdownEl) return;

    const updateTimer = () => {
      const now = new Date();
      // 다음 08:15 KST 계산
      const target = new Date();
      target.setHours(8, 15, 0, 0);

      // 이미 지났으면 내일 08:15로 설정
      if (now.getTime() >= target.getTime()) {
        target.setDate(target.getDate() + 1);
      }

      // 주말인 경우 월요일로 조정
      const day = target.getDay();
      if (day === 6) { // 토요일이면 +2일
        target.setDate(target.getDate() + 2);
      } else if (day === 0) { // 일요일이면 +1일
        target.setDate(target.getDate() + 1);
      }

      const diff = target.getTime() - now.getTime();
      if (diff <= 0) {
        countdownEl.textContent = '00:00:00';
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      const pad = (n) => String(n).padStart(2, '0');
      countdownEl.textContent = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    };

    updateTimer();
    setInterval(updateTimer, 1000);
  }
}
