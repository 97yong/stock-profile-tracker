/* ------------------ 설정 ------------------ */
const WORKER_URL   = "https://jolly-hall-61f4.313nara.workers.dev/";
const MARKET_START = 9 * 60;          // 09:00
const MARKET_END   = 15 * 60 + 30;    // 15:30

/* ------------------ DOM ------------------ */
const tbody     = document.querySelector("#inputTable tbody");
const proStatus = document.getElementById("proStatus");
const output    = document.getElementById("output");

/* ------------------ 차트 ------------------ */
const lineChart = new Chart(document.getElementById("lineChart"),{
  type:"line",
  data:{labels:[],datasets:[{
    label:"총 평가금액",
    borderColor:"#3182f6",
    backgroundColor:"rgba(49,130,246,.1)",
    fill:true,data:[]
  }]},
  options:{responsive:true,animation:false}
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
    <td><button class="btn del">❌</button></td>`;
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

  const pw    = document.getElementById("pw").value;
  const isPro = await verifyPassword(pw);
  const period= isPro ? 10_000 : 60_000;
  proStatus.textContent = isPro
    ? "✅ Pro (10초 갱신)"
    : "⏳ 일반 (1분 갱신, 5분 종료)";

  await track();
  timer=setInterval(track,period);
  if(!isPro){
    stopper=setTimeout(()=>stop("⏱️ 자동 업데이트 종료"),5*60*1000);
  }
};
function stop(msg){clearInterval(timer);timer=null;clearTimeout(stopper);
  alert(msg);proStatus.textContent="";}

async function track(){
  const now=new Date(), cur=now.getHours()*60+now.getMinutes();
  if(cur<MARKET_START){alert("📉 9시 이전입니다.");return;}
  if(cur>MARKET_END){stop("📈 장 마감!");return;}

  const rows=[...tbody.querySelectorAll("tr")].map(tr=>{
    const [n,c,q,a]=tr.querySelectorAll("input");
    return {name:n.value.trim(),code:c.value.trim(),qty:+q.value,avg:+a.value};
  }).filter(r=>r.name&&r.code&&r.qty&&r.avg);

  let html="",totVal=0,totCost=0,totQty=0,totChg=0,pieData=[];
  for(const {name,code,qty,avg} of rows){
    try{
      const {price,change=0}=await fetchQuote(code);
      const val=price*qty;                         // ★ 평가금액
      const prof=((price-avg)/avg*100).toFixed(2);

      totQty+=qty;totVal+=val;totCost+=avg*qty;totChg+=change*qty;
      pieData.push({label:name,value:val});       // ★ pieData에 저장

      const pc=change>0?"price-up":change<0?"price-down":"";
      const rc=prof>0?"profit-up":prof<0?"profit-down":"";
      const sym=change>0?"▲":change<0?"▼":"-";
      html+=`<tr>
        <td>${name}</td>
        <td class="${pc}">${price.toLocaleString()} (${sym}${Math.abs(change).toLocaleString()})</td>
        <td>${qty}</td><td>${avg.toLocaleString()}</td>
        <td class="${rc}">${prof}%</td><td>${val.toLocaleString()}</td></tr>`;
    }catch{html+=`<tr><td colspan="6">${code} - 오류</td></tr>`;}
  }

  const totRate=((totVal-totCost)/totCost*100).toFixed(2);
  const sign=totRate>0?"+":"",arrow=totChg>0?"▲":totChg<0?"▼":"-";
  const col=totChg>0?"var(--danger)":totChg<0?"var(--profit)":"black";

  output.innerHTML=`
    <h3>📋 결과 (${now.toLocaleTimeString()})</h3>
    <table>
      <tr><th>종목명</th><th>현재가</th><th>수량</th><th>평균 단가</th><th>수익률</th><th>평가금액</th></tr>
      ${html}
      <tr class="total-row">
        <td>전체</td>
        <td style="color:${col}">${arrow}${Math.abs(totChg).toLocaleString()}</td>
        <td>${totQty}</td><td>-</td>
        <td style="color:${col}">${sign}${Math.abs(totRate)}%</td>
        <td>${totVal.toLocaleString()}</td>
      </tr>
    </table>`;

  lineChart.data.labels.push(now.toLocaleTimeString());
  lineChart.data.datasets[0].data.push(totVal);
  lineChart.update();

  updatePie(pieData);                 // ★ 평가금액 기반 도넛 갱신
}

async function fetchQuote(code){
  const r=await fetch(WORKER_URL,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({code})
  });
  return r.json();                    // {price, change, rate}
}
