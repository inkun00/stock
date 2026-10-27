/**
 * KOSPI Morning Alpha - High-Performance Canvas Candlestick & Volume Chart
 * Supports retina displays, moving averages (MA5, MA20, MA60), crosshair, and tooltips.
 */

class StockCandleChart {
  constructor(canvasId, tooltipId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.tooltip = document.getElementById(tooltipId);
    this.candles = [];
    this.hoverIndex = -1;

    this.padding = { top: 30, right: 65, bottom: 50, left: 20 };
    this.volumeHeightRatio = 0.22; // 하단 22%는 거래량

    this.initEvents();
  }

  setData(candles) {
    this.candles = candles || [];
    this.calculateMAs();
    this.render();
  }

  calculateMAs() {
    const calc = (period) => {
      return this.candles.map((c, i, arr) => {
        if (i < period - 1) return null;
        const sum = arr.slice(i - period + 1, i + 1).reduce((acc, curr) => acc + curr.close, 0);
        return sum / period;
      });
    };
    this.ma5 = calc(5);
    this.ma20 = calc(20);
    this.ma60 = calc(60);
  }

  initEvents() {
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
    window.addEventListener('resize', () => this.render());
  }

  handleMouseMove(e) {
    if (!this.candles.length) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const chartWidth = rect.width - this.padding.left - this.padding.right;
    const barWidth = chartWidth / this.candles.length;

    const index = Math.floor((x - this.padding.left) / barWidth);
    if (index >= 0 && index < this.candles.length) {
      this.hoverIndex = index;
      this.showTooltip(this.candles[index], e.clientX - rect.left, e.clientY - rect.top);
      this.render();
    } else {
      this.handleMouseLeave();
    }
  }

  handleMouseLeave() {
    this.hoverIndex = -1;
    if (this.tooltip) this.tooltip.style.display = 'none';
    this.render();
  }

  showTooltip(candle, mouseX, mouseY) {
    if (!this.tooltip) return;
    const change = candle.close - candle.open;
    const changePct = ((change / candle.open) * 100).toFixed(2);
    const isUp = change >= 0;

    const formattedDate = candle.date.length === 8 
      ? `${candle.date.slice(0, 4)}.${candle.date.slice(4, 6)}.${candle.date.slice(6, 8)}`
      : candle.date;

    this.tooltip.innerHTML = `
      <div style="font-weight:700; color:#00f0ff; margin-bottom:4px;">${formattedDate}</div>
      <div style="color:#94a3b8;">시가: <span style="color:#fff; font-weight:600;">${candle.open.toLocaleString()}원</span></div>
      <div style="color:#94a3b8;">고가: <span style="color:#f43f5e; font-weight:600;">${candle.high.toLocaleString()}원</span></div>
      <div style="color:#94a3b8;">저가: <span style="color:#3b82f6; font-weight:600;">${candle.low.toLocaleString()}원</span></div>
      <div style="color:#94a3b8;">종가: <span style="color:${isUp ? '#f43f5e' : '#3b82f6'}; font-weight:700;">${candle.close.toLocaleString()}원 (${isUp ? '+' : ''}${changePct}%)</span></div>
      <div style="color:#94a3b8;">거래량: <span style="color:#e2e8f0; font-weight:600;">${candle.volume.toLocaleString()}주</span></div>
    `;

    this.tooltip.style.display = 'block';
    
    // 툴팁 위치 조정 (화면 밖으로 나가지 않게)
    const rect = this.canvas.getBoundingClientRect();
    if (mouseX + 160 > rect.width) {
      this.tooltip.style.left = `${mouseX - 170}px`;
    } else {
      this.tooltip.style.left = `${mouseX + 15}px`;
    }
    this.tooltip.style.top = `${Math.min(mouseY, rect.height - 120)}px`;
  }

  render() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const ctx = this.ctx;

    // 배경 지우기
    ctx.clearRect(0, 0, width, height);

    if (!this.candles.length) {
      ctx.fillStyle = '#64748b';
      ctx.font = '14px Plus Jakarta Sans';
      ctx.textAlign = 'center';
      ctx.fillText('캔들 데이터를 불러오는 중...', width / 2, height / 2);
      return;
    }

    const chartWidth = width - this.padding.left - this.padding.right;
    const totalChartHeight = height - this.padding.top - this.padding.bottom;
    const volumeHeight = totalChartHeight * this.volumeHeightRatio;
    const priceHeight = totalChartHeight - volumeHeight - 15; // 캔들과 볼륨 사이 여백 15px

    // 최고가/최저가 및 최대 거래량 계산
    const highs = this.candles.map(c => c.high);
    const lows = this.candles.map(c => c.low);
    const volumes = this.candles.map(c => c.volume);

    let maxPrice = Math.max(...highs);
    let minPrice = Math.min(...lows);
    let maxVolume = Math.max(...volumes);

    // 가격 여백 5%
    const priceRange = (maxPrice - minPrice) || 1;
    maxPrice += priceRange * 0.05;
    minPrice -= priceRange * 0.05;

    const barWidth = chartWidth / this.candles.length;
    const candleWidth = Math.max(barWidth * 0.72, 3);

    // 가격 -> Y좌표 변환 함수
    const getY = (val) => {
      return this.padding.top + (1 - (val - minPrice) / (maxPrice - minPrice)) * priceHeight;
    };

    // 거래량 -> Y좌표 변환 함수
    const getVolY = (vol) => {
      const volBaseY = this.padding.top + priceHeight + 15 + volumeHeight;
      return volBaseY - (vol / (maxVolume || 1)) * volumeHeight;
    };

    // 1. 배경 그리드 및 가격 라벨
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '11px Outfit, sans-serif';
    ctx.textAlign = 'left';

    const gridSteps = 4;
    for (let i = 0; i <= gridSteps; i++) {
      const p = minPrice + (priceRange * (i / gridSteps));
      const y = getY(p);
      ctx.beginPath();
      ctx.moveTo(this.padding.left, y);
      ctx.lineTo(width - this.padding.right, y);
      ctx.stroke();

      // 우측 가격 라벨
      ctx.fillText(Math.round(p).toLocaleString(), width - this.padding.right + 8, y + 4);
    }

    // 2. 거래량 렌더링
    const volBaseY = this.padding.top + priceHeight + 15 + volumeHeight;
    this.candles.forEach((c, i) => {
      const x = this.padding.left + i * barWidth + barWidth / 2;
      const vY = getVolY(c.volume);
      const isUp = c.close >= c.open;

      ctx.fillStyle = isUp ? 'rgba(244, 63, 94, 0.35)' : 'rgba(59, 130, 246, 0.35)';
      ctx.fillRect(x - candleWidth / 2, vY, candleWidth, volBaseY - vY);
    });

    // 3. 캔들스틱 렌더링
    this.candles.forEach((c, i) => {
      const x = this.padding.left + i * barWidth + barWidth / 2;
      const isUp = c.close >= c.open;
      const color = isUp ? '#f43f5e' : '#3b82f6';

      const openY = getY(c.open);
      const closeY = getY(c.close);
      const highY = getY(c.high);
      const lowY = getY(c.low);

      // 윗꼬리 / 밑꼬리 (Wick)
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // 몸통 (Body)
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(Math.abs(closeY - openY), 2);

      ctx.fillStyle = color;
      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
    });

    // 4. 이동평균선 라인 그리기 (MA5: 주황, MA20: 시안, MA60: 보라)
    const drawMALine = (maData, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      let started = false;

      maData.forEach((val, i) => {
        if (val === null) return;
        const x = this.padding.left + i * barWidth + barWidth / 2;
        const y = getY(val);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    };

    drawMALine(this.ma5, '#f59e0b');
    drawMALine(this.ma20, '#00f0ff');
    drawMALine(this.ma60, '#a855f7');

    // 5. 날짜 축 라벨 (하단)
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    const dateStep = Math.max(Math.floor(this.candles.length / 5), 1);
    this.candles.forEach((c, i) => {
      if (i % dateStep === 0 || i === this.candles.length - 1) {
        const x = this.padding.left + i * barWidth + barWidth / 2;
        const formattedDate = c.date.length === 8 ? `${c.date.slice(4, 6)}/${c.date.slice(6, 8)}` : c.date;
        ctx.fillText(formattedDate, x, height - 12);
      }
    });

    // 6. 호버 인덱스 십자선 (Crosshair)
    if (this.hoverIndex >= 0 && this.hoverIndex < this.candles.length) {
      const hoverX = this.padding.left + this.hoverIndex * barWidth + barWidth / 2;
      const hoverCandle = this.candles[this.hoverIndex];
      const hoverY = getY(hoverCandle.close);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;

      // 세로선
      ctx.beginPath();
      ctx.moveTo(hoverX, this.padding.top);
      ctx.lineTo(hoverX, volBaseY);
      ctx.stroke();

      // 가로선
      ctx.beginPath();
      ctx.moveTo(this.padding.left, hoverY);
      ctx.lineTo(width - this.padding.right, hoverY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

window.StockCandleChart = StockCandleChart;
