import { CONFIG } from './config.js';
import { ChartManager } from './chart.js';
import { TableManager } from './table.js';
import { ApiManager } from './api.js';

export const TrackerManager = {
  timer: null,
  stopper: null,
  firstTrack: true,
  prevTotal: 0,
  candleData: {},

  async start() {
    if (this.timer) return;

    const output = document.getElementById("output");
    output.style.display = "none";

    const pw = document.getElementById("pw").value;
    const isPro = await ApiManager.verifyPassword(pw);
    const period = isPro ? 10_000 : 60_000;
    
    document.getElementById("proStatus").textContent = isPro
      ? "🚀 Pro 모드 진입 (10초 갱신)"
      : "⏳ 일반 모드 실행 (1분 갱신, 5분 종료)";

    await this.track();
    this.timer = setInterval(() => this.track(), period);
    
    if (!isPro) {
      this.stopper = setTimeout(() => this.stop("⏱️ 자동 업데이트 종료"), 5 * 60 * 1000);
    }
  },

  stop(msg) {
    clearInterval(this.timer);
    this.timer = null;
    clearTimeout(this.stopper);
    this.hideLoading();
    if (msg) {
      const output = document.getElementById("output");
      const now = new Date();
      output.innerHTML = `
        <div class="result-card">
          <h3>실시간 포트폴리오 <span class="time">${now.toLocaleTimeString()}</span></h3>
          <div class="loading-text" style="margin:2rem 0 1.5rem 0; color:#6b7684; font-size:1.05rem;">${msg}</div>
          ${lastPortfolioHTML ? lastPortfolioHTML : ''}
        </div>
      `;
    }
    document.getElementById("proStatus").textContent = "";
  },

  async track() {
    // Show loading state for all charts
    this.showLoading();

    const output = document.getElementById("output");
    output.style.display = "block";
    output.innerHTML = `
      <div class="result-card">
        <h3>실시간 포트폴리오</h3>
        <div class="loading">
          <div class="spinner"></div>
          <div class="loading-text">데이터를 불러오는 중입니다...</div>
        </div>
      </div>
    `;

    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    
    if (cur < CONFIG.MARKET_START) {
      this.stop("📉 9시 이전입니다.");
      return;
    }
    if (cur > CONFIG.MARKET_END) {
      this.stop("📈 장 마감! 현재 장이 마감되어 데이터가 갱신되지 않습니다.");
      return;
    }

    const rows = TableManager.getRows();
    let totVal = 0, totCost = 0, totQty = 0, totChg = 0, pieData = [];

    // 기존 캔버스 참조 저장
    const existingCanvases = {};
    rows.forEach(({code}) => {
      const canvas = document.getElementById(`chart-${code}`);
      if (canvas) existingCanvases[code] = canvas;
    });

    let html = "";
    for(const {name, code, qty, avg} of rows) {
      try {
        const data = await ApiManager.fetchQuote(code);
        const {price, change, rate, open, high, low, volume, prevClose} = data;
        
        // 캔들차트 데이터 업데이트
        if (!this.candleData[code]) {
          this.candleData[code] = {open, high, low, lastPrice: price, prevClose};
        } else {
          this.candleData[code].high = Math.max(this.candleData[code].high, price);
          this.candleData[code].low = Math.min(this.candleData[code].low, price);
          this.candleData[code].lastPrice = price;
        }
        
        const chartData = {
          price: this.candleData[code].lastPrice,
          open: this.candleData[code].open,
          high: this.candleData[code].high,
          low: this.candleData[code].low,
          change
        };

        const val = price * qty;
        const prof = ((price - avg) / avg * 100).toFixed(2);

        totQty += qty;
        totVal += val;
        totCost += avg * qty;
        totChg += change * qty;
        pieData.push({label: name, value: val});

        const pc = change > 0 ? "price-up" : change < 0 ? "price-down" : "";
        const rc = prof > 0 ? "profit-up" : prof < 0 ? "profit-down" : "";
        const sym = change > 0 ? "▲" : change < 0 ? "▼" : "-";
        html += `<tr>
          <td>${name}</td>
          <td class="price-cell">
            <div class="main-price ${pc}">${price.toLocaleString()}</div>
            <div class="volume-info">거래량 ${volume?.toLocaleString() || '-'}</div>
          </td>
          <td class="change-cell">
            <div class="change-info">
              <div class="main-change ${pc}">${sym}${Math.abs(change).toLocaleString()}</div>
              <div class="rate-info ${pc}">${Math.abs(rate).toFixed(2)}%</div>
            </div>
          </td>
          <td class="mini-chart-cell"><div class="mini-chart"><canvas id="chart-${code}" width="60" height="40" style="width:60px;height:40px;"></canvas></div></td>
          <td>${qty}</td>
          <td>${avg.toLocaleString()}</td>
          <td class="${rc}">${prof}%</td>
          <td>${val.toLocaleString()}</td>
        </tr>`;
      } catch(err) {
        html += `<tr><td colspan="8">${code} - 오류: ${err.message}</td></tr>`;
      }
    }

    if (this.prevTotal === 0) {
      for (const { code, qty } of rows) {
        const candle = this.candleData[code];
        if (candle && candle.prevClose) {
          this.prevTotal += candle.prevClose * qty;
        }
      }
    }

    const totRate = ((totVal - totCost) / totCost * 100).toFixed(2);
    const sign = totRate > 0 ? "+" : "";
    const arrow = totChg > 0 ? "▲" : totChg < 0 ? "▼" : "-";
    const col = totChg > 0 ? "var(--danger)" : totChg < 0 ? "var(--profit)" : "black";

    output.innerHTML = `
      <div class="result-card">
        <h3>실시간 포트폴리오<span class="time">${now.toLocaleTimeString()}</span></h3>
        <table>
          <tr><th>종목명</th><th>현재가</th><th>등락률</th><th>차트</th><th>수량</th><th>평균 단가</th><th>수익률</th><th>평가금액</th></tr>
          ${html}
          <tr class="total-row">
            <td>전체</td>
            <td>
              <div class="change-rate" style="color:${col}">${arrow}${Math.abs(totChg).toLocaleString()}</div>
            </td>
            <td>-</td>
            <td></td>
            <td>${totQty}</td><td>-</td>
            <td style="color:${totRate>0?'var(--danger)':totRate<0?'var(--profit)':'black'}">${sign}${Math.abs(totRate)}%</td>
            <td>${totVal.toLocaleString()}</td>
          </tr>
        </table>
      </div>`;

    // 캔들차트 다시 그리기
    rows.forEach(({code}) => {
      const canvas = document.getElementById(`chart-${code}`);
      if (canvas && this.candleData[code]) {
        const chartData = {
          price: this.candleData[code].lastPrice,
          open: this.candleData[code].open,
          high: this.candleData[code].high,
          low: this.candleData[code].low,
          change: this.candleData[code].lastPrice - this.candleData[code].open
        };
        ChartManager.drawCandleChart(canvas, chartData);
      }
    });

    ChartManager.lineChart.data.labels.push(now.toLocaleTimeString());
    ChartManager.lineChart.data.datasets[0].data.push(totVal);
    ChartManager.lineChart.data.datasets[1].data.push(this.prevTotal);
    ChartManager.lineChart.update();

    ChartManager.updatePie(pieData);

    // Hide loading state and show all charts
    this.hideLoading();
  },

  showLoading() {
    // Show loading indicators
    document.getElementById("lineLoading").style.display = "flex";
    document.getElementById("pieLoading").style.display = "flex";
    document.getElementById("seedCalcLoading").style.display = "flex";
    
    // Show chart containers but keep charts hidden
    document.querySelector('.chart-card').style.display = "flex";
    document.querySelector('.chart-row').style.display = "flex";
    document.querySelectorAll('.chart-card.small').forEach(card => {
      card.style.display = "flex";
    });

    // Hide all content initially
    document.getElementById("lineChart").style.display = "none";
    document.getElementById("pieChart").style.display = "none";
    document.getElementById("seedTable").style.display = "none";
  },

  hideLoading() {
    // Hide loading indicators
    document.getElementById("lineLoading").style.display = "none";
    document.getElementById("pieLoading").style.display = "none";
    document.getElementById("seedCalcLoading").style.display = "none";
    
    // Show all content
    document.getElementById("lineChart").style.display = "block";
    document.getElementById("pieChart").style.display = "block";
    document.getElementById("seedTable").style.display = "table";
  },

  updateOutput() {
    const now = new Date();
    const output = document.getElementById("output");
    
    if (!isMarketOpen()) {
      this.hideLoading();
      output.innerHTML = `
        <div class="result-card">
          <h3>실시간 포트폴리오 <span class="time">${now.toLocaleTimeString()}</span></h3>
          <div class="loading-text" style="margin:2rem 0 1.5rem 0; color:#6b7684; font-size:1.05rem;">현재 장이 마감되어 데이터가 갱신되지 않습니다.</div>
          ${lastPortfolioHTML ? lastPortfolioHTML : ''}
        </div>
      `;
      return;
    }

    // 먼저 제목과 로딩 상태만 표시
    const html = `
      <div class="result-card">
        <h3>실시간 포트폴리오<span class="time">${new Date().toLocaleTimeString()}</span></h3>
        <div class="loading">
          <div class="spinner"></div>
          <div class="loading-text">데이터를 불러오는 중입니다...</div>
        </div>
      </div>
    `;

    // 데이터 처리
    const rows = TableManager.getRows();
    let totalValue = 0;
    let totalProfit = 0;
    
    for(const {name, code, qty, avg} of rows) {
      try {
        const data = ApiManager.getLastQuote(code);
        if (!data) throw new Error('데이터를 가져올 수 없습니다');
        
        const {price, changeRate} = data;
        const val = price * qty;
        const prof = ((price - avg) / avg * 100).toFixed(2);
        const rc = prof > 0 ? "profit-up" : prof < 0 ? "profit-down" : "";
        const crc = changeRate > 0 ? "price-up" : changeRate < 0 ? "price-down" : "";
        
        totalValue += val;
        totalProfit += (price - avg) * qty;
        
        html += `<tr>
          <td>${name}</td>
          <td class="${crc}">${price.toLocaleString()}<div class="change-rate">${changeRate > 0 ? '+' : ''}${changeRate}%</div></td>
          <td class="mini-chart-cell"><div class="mini-chart" id="miniChart_${code}"></div></td>
          <td>${qty.toLocaleString()}</td>
          <td>${avg.toLocaleString()}</td>
          <td class="${rc}">${prof}%</td>
          <td>${val.toLocaleString()}</td>
        </tr>`;
      } catch(err) {
        html += `<tr><td colspan="7">${code} - 오류: ${err.message}</td></tr>`;
      }
    }
    
    const totalProfitRate = ((totalProfit / (totalValue - totalProfit)) * 100).toFixed(2);
    const trc = totalProfitRate > 0 ? "profit-up" : totalProfitRate < 0 ? "profit-down" : "";
    
    html += `<tr class="total-row">
      <td>합계</td>
      <td>-</td>
      <td>-</td>
      <td>-</td>
      <td>-</td>
      <td class="${trc}">${totalProfitRate}%</td>
      <td>${totalValue.toLocaleString()}</td>
    </tr>`;
    
    // 데이터가 준비되면 테이블 표시
    lastPortfolioHTML = `<table>
      <tr><th>종목명</th><th>현재가</th><th>차트</th><th>수량</th><th>평균 단가</th><th>수익률</th><th>평가금액</th></tr>
      ${html}
    </table>`;
    output.innerHTML = `
      <div class="result-card">
        <h3>실시간 포트폴리오 <span class="time">${now.toLocaleTimeString()}</span></h3>
        ${lastPortfolioHTML}
      </div>
    `;
    
    // 미니 차트 업데이트
    for(const {code} of rows) {
      const data = ApiManager.getLastQuote(code);
      if (data) {
        ChartManager.updateMiniChart(code, data.prices);
      }
    }
  }
};

// 장 운영 시간 확인 함수
function isMarketOpen() {
  const now = new Date();
  const open = new Date(now);
  open.setHours(9, 0, 0, 0);
  const close = new Date(now);
  close.setHours(20, 30, 0, 0);
  return now >= open && now <= close;
}

let lastPortfolioHTML = ''; 