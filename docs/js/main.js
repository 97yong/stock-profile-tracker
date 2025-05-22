import { ChartManager } from './chart.js';
import { TableManager } from './table.js';
import { TrackerManager } from './tracker.js';
import { ApiManager } from './api.js';

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const addRowBtn = document.getElementById("addBtn");
const seedCalcBtn = document.getElementById("seedCalcBtn");
const seedTable = document.getElementById("seedTable");
const seedCalcLoading = document.getElementById("seedCalcLoading");
const seedInput = document.getElementById("seedAmount");

// 초기화
ChartManager.initLineChart();
ChartManager.initPieChart();
TableManager.init();

// 기본 종목 로드
window.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await fetch("data/default_stocks.json");
    const list = await res.json();
    list.forEach(s => TableManager.addRow(s.name, s.code, s.qty, s.avg));
  } catch(e) {
    console.error("기본 종목 로드 실패", e);
  }
});

// 이벤트 리스너
startBtn.addEventListener("click", () => TrackerManager.start());
stopBtn.addEventListener("click", () => TrackerManager.stop("⏹️ 수동 중지"));
addRowBtn.addEventListener("click", () => TableManager.addRow());

seedCalcBtn.addEventListener("click", async () => {
  seedCalcLoading.style.display = "flex";
  seedTable.style.display = "none";
  
  const seedAmount = parseInt(seedInput.value.replace(/,/g, "")) || 0;
  if (seedAmount === 0) {
    alert("투자금을 입력해주세요.");
    seedCalcLoading.style.display = "none";
    return;
  }

  const rows = TableManager.getRows();
  let html = "";
  let totalValue = 0;
  let totalInvestment = 0;
  
  // 먼저 현재가로 총 평가금액 계산
  for(const {name, code, qty, avg} of rows) {
    try {
      const data = await ApiManager.fetchQuote(code);
      if (!data) throw new Error('데이터를 가져올 수 없습니다');
      totalValue += data.price * qty;
    } catch(err) {
      console.error(err);
    }
  }

  // 각 종목별 비율 계산 및 수량 조정
  for(const {name, code, qty, avg} of rows) {
    try {
      const data = await ApiManager.fetchQuote(code);
      if (!data) throw new Error('데이터를 가져올 수 없습니다');
      
      const currentValue = data.price * qty;
      const ratio = currentValue / totalValue;
      const newQty = Math.floor((seedAmount * ratio) / data.price);
      const investment = newQty * data.price;
      totalInvestment += investment;
      
      html += `<tr>
        <td>${name}</td>
        <td>${newQty.toLocaleString()}</td>
        <td>${investment.toLocaleString()}</td>
        <td>${(ratio * 100).toFixed(1)}%</td>
      </tr>`;
    } catch(err) {
      html += `<tr><td colspan="4">${code} - 오류: ${err.message}</td></tr>`;
    }
  }
  
  // 합계 행 추가
  html += `<tr class="total-row">
    <td>합계</td>
    <td>-</td>
    <td>${totalInvestment.toLocaleString()}</td>
    <td>100%</td>
  </tr>`;
  
  seedTable.innerHTML = `
    <tr><th>종목명</th><th>매수 수량</th><th>투자액</th><th>비율</th></tr>
    ${html}
  `;
  
  seedCalcLoading.style.display = "none";
  seedTable.style.display = "table";
});

// Seed input formatting: add commas in real-time as user types, and keep cursor position
seedInput.addEventListener("input", (e) => {
  const selectionStart = seedInput.selectionStart;
  const oldLength = seedInput.value.length;

  let raw = seedInput.value.replace(/[^0-9]/g, "");
  if (raw === "") {
    seedInput.value = "";
    return;
  }
  seedInput.value = parseInt(raw, 10).toLocaleString();

  const newLength = seedInput.value.length;
  seedInput.setSelectionRange(selectionStart + (newLength - oldLength), selectionStart + (newLength - oldLength));
});
