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
  isInitialLoad: true,

  async start() {
    if (this.timer) return;

    const output = document.getElementById("output");
    output.style.display = "none";

    const pw = document.getElementById("pw").value;
    const isPro = await ApiManager.verifyPassword(pw);
    const period = isPro ? 10_000 : 30_000;
    
    document.getElementById("proStatus").textContent = isPro
      ? "🚀 Pro 모드 진입 (10초 갱신)"
      : "⏳ 일반 모드 실행 (30초 갱신, 3시간 종료)";

    this.isInitialLoad = true;
    await this.track();
    this.timer = setInterval(() => this.track(), period);
    
    if (!isPro) {
      this.stopper = setTimeout(() => this.stop("⏱️ 자동 업데이트 종료"), 3 * 60 * 60 * 1000);
    }
  },

  stop(msg) {
    clearInterval(this.timer);
    this.timer = null;
    clearTimeout(this.stopper);
    this.hideLoading();
    // 스피너 비활성화
    const spinner = document.querySelector('.mini-spinner');
    if (spinner) spinner.classList.remove('active');
    
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
    const output = document.getElementById("output");
    
    // Show loading state only for initial load
    if (this.isInitialLoad) {
      this.showLoading();
      output.style.display = "block";
      
      // 스켈레톤 UI 생성
      const rows = TableManager.getRows();
      const skeletonRows = rows.map(() => `
        <tr class="skeleton-row">
          <td><div class="skeleton-text"></div></td>
          <td><div class="skeleton-text"></div></td>
          <td><div class="skeleton-text"></div></td>
          <td><div class="skeleton-chart"></div></td>
          <td><div class="skeleton-text"></div></td>
          <td><div class="skeleton-text"></div></td>
          <td><div class="skeleton-text"></div></td>
          <td><div class="skeleton-text"></div></td>
        </tr>
      `).join('');

      output.innerHTML = `
        <div class="result-card">
          <h3>실시간 포트폴리오<span class="time">${new Date().toLocaleTimeString()}</span></h3>
          <table>
            <tr><th>종목명</th><th>현재가</th><th>등락률</th><th>차트</th><th>수량</th><th>평균 단가</th><th>수익률</th><th>평가금액</th></tr>
            ${skeletonRows}
            <tr class="total-row skeleton-row">
              <td>전체</td>
              <td><div class="skeleton-text"></div></td>
              <td><div class="skeleton-text"></div></td>
              <td></td>
              <td><div class="skeleton-text"></div></td>
              <td><div class="skeleton-text"></div></td>
              <td><div class="skeleton-text"></div></td>
              <td><div class="skeleton-text"></div></td>
            </tr>
          </table>
        </div>`;
      this.isInitialLoad = false;
    }

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

    // 초기 로딩 상태 해제
    this.hideLoading();

    const rows = TableManager.getRows();
    let totVal = 0, totCost = 0, totQty = 0, totChg = 0, pieData = [];

    // 기존 캔버스 참조 저장
    const existingCanvases = {};
    rows.forEach(({code}) => {
      const canvas = document.getElementById(`chart-${code}`);
      if (canvas) existingCanvases[code] = canvas;
    });

    // 데이터 업데이트 시작 전에 스피너 표시
    const titleElement = output.querySelector('h3');
    if (titleElement) {
      titleElement.innerHTML = `실시간 포트폴리오<div class="mini-spinner active"></div><span class="time">${now.toLocaleTimeString()}</span>`;
    }

    try {
      // 모든 종목 데이터를 한 번에 가져오기
      const codes = rows.map(row => row.code);
      const stockData = await ApiManager.fetchQuotes(codes);
      
      let html = "";
      rows.forEach(({name, code, qty, avg}) => {
        const data = stockData[code];
        if (!data) {
          html += `<tr><td colspan="8">${code} - 데이터를 가져올 수 없습니다</td></tr>`;
          return;
        }

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
        const rateSign = rate > 0 ? "+" : "";
        const profSign = prof > 0 ? "+" : "";
        html += `<tr>
          <td>${name}</td>
          <td class="current-price ${change > 0 ? 'positive' : change < 0 ? 'negative' : ''}">${price.toLocaleString()}</td>
          <td class="change-cell">
            <div class="change-info">
              <div class="main-change ${pc}">${sym}${Math.abs(change).toLocaleString()}</div>
              <div class="rate-info ${pc}">${rateSign}${Math.abs(rate).toFixed(2)}%</div>
            </div>
          </td>
          <td class="mini-chart-cell"><div class="mini-chart"><canvas id="chart-${code}" width="60" height="40" style="width:60px;height:40px;"></canvas></div></td>
          <td>${qty}</td>
          <td>${avg.toLocaleString()}</td>
          <td class="profit-rate ${prof > 0 ? 'positive' : prof < 0 ? 'negative' : ''}">${profSign}${Math.abs(prof)}%</td>
          <td>${val.toLocaleString()}</td>
        </tr>`;
      });

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

      // 파이 차트 데이터 정렬 및 라벨 축소
      pieData.sort((a, b) => b.value - a.value);
      pieData = pieData.map(item => ({
        ...item,
        label: item.label.length > 4 ? item.label.substring(0, 4) + '...' : item.label
      }));

      // 투자금액 대비 가중평균 수익률 계산
      let weightedProfitRate = 0;
      let totalInvestment = 0;
      rows.forEach(({code, qty, avg}) => {
        const data = this.candleData[code];
        if (data && data.lastPrice) {
          const investment = qty * avg;  // 투자금액
          const profitRate = ((data.lastPrice - avg) / avg * 100);
          weightedProfitRate += profitRate * investment;
          totalInvestment += investment;
        }
      });
      weightedProfitRate = totalInvestment > 0 ? (weightedProfitRate / totalInvestment).toFixed(2) : 0;

      // 데이터 로드가 완료되면 결과 표시
      output.innerHTML = `
        <div class="result-card">
          <h3>실시간 포트폴리오<span class="time">${now.toLocaleTimeString()}</span></h3>
          <table>
            <tr><th>종목명</th><th>현재가</th><th>등락률</th><th>차트</th><th>수량</th><th>평균 단가</th><th>수익률</th><th>평가금액</th></tr>
            ${html}
            <tr class="total-row">
              <td>전체</td>
              <td class="current-price ${totChg > 0 ? 'positive' : totChg < 0 ? 'negative' : ''}">${arrow}${Math.abs(totChg).toLocaleString()}</td>
              <td>-</td>
              <td></td>
              <td>${totQty}</td>
              <td>-</td>
              <td class="profit-rate ${totRate > 0 ? 'positive' : totRate < 0 ? 'negative' : ''}">${sign}${Math.abs(totRate)}%</td>
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
    } catch (err) {
      console.error('Error fetching stock data:', err);
      output.innerHTML = `
        <div class="result-card">
          <h3>실시간 포트폴리오<span class="time">${now.toLocaleTimeString()}</span></h3>
          <div class="error-message">데이터를 불러오는 중 오류가 발생했습니다: ${err.message}</div>
          ${lastPortfolioHTML ? lastPortfolioHTML : ''}
        </div>
      `;
    }
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