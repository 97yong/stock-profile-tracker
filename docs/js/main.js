/* ------------------ 설정 ------------------ */
const WORKER_URL   = "https://jolly-hall-61f4.313nara.workers.dev/";
const MARKET_START = 9 * 60;          // 09:00
const MARKET_END   = 20 * 60 + 30;    // 20:30

/* ------------------ DOM ------------------ */
const tbody     = document.querySelector("#inputTable tbody");
const proStatus = document.getElementById("proStatus");
const output    = document.getElementById("output");

// 캔들차트 데이터 저장소
const candleData = {};
let prevTotal = 0;

/* ------------------ 차트 ------------------ */
// 캔들차트 그리기 함수
function drawCandleChart(canvas, data) {
  const {price, open, high, low, change} = data;
  if (!canvas || !price || !open || !high || !low) return;

  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
-
  // 배경 지우기
  ctx.clearRect(0, 0, w, h);

  // 캔들 그리기
  const isUp = change > 0;
  const candleColor = isUp ? '#ff3b30' : change < 0 ? '#007aff' : '#000';
  const x = Math.floor(w / 2);  // 오른쪽으로 이동

  ctx.strokeStyle = candleColor;
  ctx.fillStyle = candleColor;
  ctx.lineWidth = 1;

  // 전체 가격 범위 계산
  const min = Math.min(low, open, price);
  const max = Math.max(high, open, price);
  const range = max - min;
  const padding = Math.max(range * 0.1, 1);  // 최소 1의 여백
  
  // y축 계산 함수
  const getY = price => {
    if (!range) return h/2;  // 가격 변동이 없는 경우
    return Math.floor(4 + (h-8) * (1 - (price - (min - padding)) / (range + padding * 2)));
  };

  // 위아래 선
  ctx.beginPath();
  ctx.moveTo(x, getY(high));
  ctx.lineTo(x, getY(low));
  ctx.stroke();

  // 캔들 본체
  const priceY = getY(price);
  const openY = getY(open);
  const bodyY = Math.min(priceY, openY);
  const bodyHeight = Math.max(Math.abs(priceY - openY), 1);

  const bodyWidth = 8;
  ctx.fillRect(x - bodyWidth / 2, bodyY, bodyWidth, bodyHeight);
}

// 동적으로 canvas 해상도 설정 (카드 폭 × dpr)
window.addEventListener('DOMContentLoaded', () => {
  const chartCard = document.querySelector('.chart-card');
  const canvas = document.getElementById('lineChart');
  const dpr = window.devicePixelRatio || 1;
  const displayWidth = chartCard.clientWidth * 0.98; // 98% 카드 폭
  const displayHeight = 260; // 원하는 높이(px)
  canvas.width = displayWidth * dpr;
  canvas.height = displayHeight * dpr;
  canvas.style.width = displayWidth + 'px';
  canvas.style.height = displayHeight + 'px';

  window.lineChart = new Chart(canvas, {
    type: 'line',
    data: {labels:[],datasets:[{
      label: "총 평가금액",
      borderColor: "#3182f6",
      backgroundColor: "rgba(49,130,246,.1)",
      fill: true, data: []
    },
      {
        label: "전일 평가금액",
        borderColor: "#aaa",
        borderDash: [5, 5], // 점선
        borderWidth: 1,
        pointRadius: 0,
        fill: false,
        data: []
      }
  ]},
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: true,
      
    }
  });
  canvas.style.background = "#fff";
});

let pieChart=null;
function updatePie(data){
  if(!pieChart){
    pieChart=new Chart(document.getElementById("pieChart"),{
      type:"doughnut",
      data:{labels:[],datasets:[{data:[],backgroundColor:[
        "#3182f6","#ff3b30","#ffcd56","#4caf50","#f44336"]}]},
      options:{
        responsive:true,
        maintainAspectRatio:true,
        layout:{padding:20},
        radius:"85%",
        cutout:"60%",
        plugins:{
          legend:{position:"bottom"},
          datalabels:{
            color:"#333",
            font:{weight:"600",size:12},
            formatter:(value,ctx)=>{
              const sum=ctx.chart.data.datasets[0].data
                         .reduce((a,b)=>a+b,0);
              const pct=((value/sum)*100).toFixed(1);
              return `${pct}%`;
            }
          }
        }
      },
      plugins:[ChartDataLabels]
    });
    document.getElementById("pieChart").style.background = "#fff";
  }

  pieChart.data.labels  = data.map(d=>d.label);
  pieChart.data.datasets[0].data = data.map(d=>d.value);
  pieChart.update();
}

/* ------------------ 행 추가/삭제 ------------------ */
function addRow(n="",c="",q="",a=""){
  const tr=document.createElement("tr");
  tr.innerHTML=`
    <td><input type="text"   value="${n}"></td>
    <td><input type="text"   value="${c}"></td>
    <td><input type="number" value="${q}"></td>
    <td><input type="number" value="${a}"></td>
    <td><button class="btn btn-del del">×</button></td>`;
  tbody.appendChild(tr);
}
document.getElementById("addBtn").onclick = () => addRow();
tbody.onclick=e=>{
  if(e.target.classList.contains("del")) e.target.closest("tr").remove();
};

/* ------------------ 기본 종목 로드 ------------------ */
window.addEventListener("DOMContentLoaded",async()=>{
  try{
    const res = await fetch("data/default_stocks.json");
    const list= await res.json();
    list.forEach(s=>addRow(s.name,s.code,s.qty,s.avg));
  }catch(e){console.error("기본 종목 로드 실패",e);}
});

/* ------------------ Pro 모드 확인 ------------------ */
async function verifyPassword(pw){
  try{
    const r=await fetch(WORKER_URL+"check-password",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({password:pw})
    });
    const {ok}=await r.json();
    return !!ok;
  }catch{ return false; }
}

/* ------------------ 조회 로직 ------------------ */
let timer=null, stopper=null;
document.getElementById("runBtn").onclick = async ()=>{
  if(timer) return;

  // 로딩중 메시지 표시
  output.innerHTML = '<div class="loading"><div class="spinner"></div><div class="loading-text">로딩중...</div></div>';

  const pw    = document.getElementById("pw").value;
  const isPro = await verifyPassword(pw);
  const period= isPro ? 10_000 : 60_000;
  proStatus.textContent = isPro
    ? "🚀 Pro 모드 진입 (10초 갱신)"
    : "⏳ 일반 모드 실행 (1분 갱신, 5분 종료)";

  await track();
  timer=setInterval(track,period);
  if(!isPro){
    stopper=setTimeout(()=>stop("⏱️ 자동 업데이트 종료"),5*60*1000);
  }
};
function stop(msg){clearInterval(timer);timer=null;clearTimeout(stopper);
  alert(msg);proStatus.textContent="";}

async function track(){

  document.getElementById("lineLoading").style.display = "flex";
  document.getElementById("lineChart").style.display = "none";

  document.getElementById("pieLoading").style.display = "flex";
  document.getElementById("pieChart").style.display = "none";

  document.getElementById("seedCalcLoading").style.display = "flex";
  document.getElementById("seedTable").style.display = "none";

  const now=new Date(), cur=now.getHours()*60+now.getMinutes();
  if(cur<MARKET_START){alert("📉 9시 이전입니다.");return;}
  if(cur>MARKET_END){stop("📈 장 마감!");return;}

  const rows=[...tbody.querySelectorAll("tr")].map(tr=>{
    const [n,c,q,a]=tr.querySelectorAll("input");
    return {name:n.value.trim(),code:c.value.trim(),qty:+q.value,avg:+a.value};
  }).filter(r=>r.name&&r.code&&r.qty&&r.avg);

  let totVal=0,totCost=0,totQty=0,totChg=0,pieData=[];

  // 기존 캔버스 참조 저장
  const existingCanvases = {};
  rows.forEach(({code}) => {
    const canvas = document.getElementById(`chart-${code}`);
    if (canvas) existingCanvases[code] = canvas;
  });

  let html="";
  for(const {name,code,qty,avg} of rows){
    try{
      const data = await fetchQuote(code);
      const {price, change, rate, open, high, low, volume, prevClose} = data;
      
      // 캔들차트 데이터 업데이트
      if (!candleData[code]) {
        // 첫 데이터는 모두 저장
        candleData[code] = {open, high, low, lastPrice: price, prevClose};

      } else {
        // 이후에는 고가/저가만 업데이트
        candleData[code].high = Math.max(candleData[code].high, price);
        candleData[code].low = Math.min(candleData[code].low, price);
        candleData[code].lastPrice = price;
      }
      
      // 캔들차트 데이터 준비
      const chartData = {
        price: candleData[code].lastPrice,
        open: candleData[code].open,
        high: candleData[code].high,
        low: candleData[code].low,
        change
      };
      const val=price*qty;                         // ★ 평가금액
      const prof=((price-avg)/avg*100).toFixed(2);

      totQty+=qty;totVal+=val;totCost+=avg*qty;totChg+=change*qty;
      pieData.push({label:name,value:val});       // ★ pieData에 저장

      const pc = change > 0 ? "price-up" : change < 0 ? "price-down" : "";
      const rc = prof > 0 ? "profit-up" : prof < 0 ? "profit-down" : "";
      const sym = change > 0 ? "▲" : change < 0 ? "▼" : "-";  // 상승/하락 방향에 따라 화살표 변경
      html+=`<tr>
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
    }catch(err){html+=`<tr><td colspan="8">${code} - 오류: ${err.message}</td></tr>`;}
  }

  if (prevTotal === 0) {
    for (const { code, qty } of rows) {
      const candle = candleData[code];
      if (candle && candle.prevClose) {
        prevTotal += candle.prevClose * qty;
      }
    }
  }

  const totRate=((totVal-totCost)/totCost*100).toFixed(2);
  const sign=totRate>0?"+":"",arrow=totChg>0?"▲":totChg<0?"▼":"-";
  const col=totChg>0?"var(--danger)":totChg<0?"var(--profit)":"black";

  output.innerHTML=`
    <h3>결과 (${now.toLocaleTimeString()})</h3>
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
    </table>`;

  // 캔들차트 다시 그리기
  rows.forEach(({code}) => {
    const canvas = document.getElementById(`chart-${code}`);
    if (canvas && candleData[code]) {
      const chartData = {
        price: candleData[code].lastPrice,
        open: candleData[code].open,
        high: candleData[code].high,
        low: candleData[code].low,
        change: candleData[code].lastPrice - candleData[code].open
      };
      drawCandleChart(canvas, chartData);
    }
  });

  window.lineChart.data.labels.push(now.toLocaleTimeString());
  window.lineChart.data.datasets[0].data.push(totVal);
  window.lineChart.data.datasets[1].data.push(prevTotal);  // 기준선
  window.lineChart.update();

  updatePie(pieData);                 // ★ 평가금액 기반 도넛 갱신

  document.getElementById("lineLoading").style.display = "none";
  document.getElementById("lineChart").style.display = "block";

  document.getElementById("pieLoading").style.display = "none";
  document.getElementById("pieChart").style.display = "block";

  document.getElementById("seedCalcLoading").style.display = "none";
  document.getElementById("seedTable").style.display = "table";

}

async function fetchQuote(code){
  const r=await fetch(WORKER_URL,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({code})
  });
  const data = await r.json();
  console.log('서버 응답:', code, data);  // 응답 데이터 확인
  if (!data.price) throw new Error('가격 정보를 가져올 수 없습니다');
  return data;                    // {price, change, rate, open, high, low, volume}
}


function seedCalcHandler(){
  const seedInput = document.getElementById("seedAmount");
  const seed = parseInt((seedInput.value || "0").replace(/,/g, ""), 10);
  if (!seed) {
    alert("투자 금액을 입력하세요!");
    seedInput.focus();
    return;
  }

  const rows = Array.from(document.querySelectorAll("#inputTable tbody tr"));
  if (!rows.length) {
    alert("먼저 종목을 입력하세요!");
    return;
  }

  const portfolio = [];
  let totalVal = 0;

  rows.forEach((tr) => {
    const tds = tr.querySelectorAll("td");
    const getVal = (cellIdx) => {
      const el = tds[cellIdx].querySelector("input");
      return (el ? el.value : tds[cellIdx].textContent).trim();
    };
    const name = getVal(0);
    const qty = parseFloat(getVal(2).replace(/,/g, ""));
    const avg = parseFloat(getVal(3).replace(/,/g, ""));
    if (!isFinite(qty) || !isFinite(avg) || qty <= 0 || avg <= 0) return;
    const val = qty * avg;
    portfolio.push({ name, avg, val });
    totalVal += val;
  });

  if (!portfolio.length || totalVal === 0) {
    alert("수량 또는 평균단가가 올바르지 않습니다.");
    return;
  }

  // ⬇️ 로딩 중 표시
  const tbody = document.querySelector("#seedTable tbody");
  tbody.innerHTML = `
    <tr><td colspan="3">
      <div class="loading">
        <div class="spinner"></div>
        <div class="loading-text">계산중...</div>
      </div>
    </td></tr>
  `;

  setTimeout(() => {
    tbody.innerHTML = "";
    portfolio.forEach(({ name, avg, val }) => {
      const weight = val / totalVal;
      const buyQty = Math.floor((seed * weight) / avg);
      const buyVal = buyQty * avg;
      const ratio = (buyVal / seed) * 100;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${name}</td>
        <td>${buyQty.toLocaleString()}</td>
        <td>${buyVal.toLocaleString()}</td>
        <td>${ratio.toFixed(1)}%</td>`;
      tbody.appendChild(tr);
    });
  }, 300);
}
document.getElementById("seedCalcBtn").addEventListener("click", seedCalcHandler);

const seedInput = document.getElementById("seedAmount");

seedInput.addEventListener("input", () => {
  const raw = seedInput.value.replace(/[^\d]/g, ""); // 숫자만 추출
  if (raw === "") {
    seedInput.value = "";
    return;
  }
  seedInput.value = parseInt(raw, 10).toLocaleString();
});
