import { CONFIG } from './config.js';

export const ChartManager = {
  lineChart: null,
  pieChart: null,
  candleData: {},

  initLineChart() {
    const chartCard = document.querySelector('.chart-card');
    const canvas = document.getElementById('lineChart');
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = CONFIG.CHART_WIDTH_RATIO * chartCard.clientWidth;
    const displayHeight = CONFIG.CHART_HEIGHT;

    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    canvas.style.width = displayWidth + 'px';
    canvas.style.height = displayHeight + 'px';

    this.lineChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: "총 평가금액",
          borderColor: "#3182f6",
          backgroundColor: "rgba(49,130,246,.1)",
          fill: true,
          data: []
        }, {
          label: "전일 평가금액",
          borderColor: "#aaa",
          borderDash: [5, 5],
          borderWidth: 1,
          pointRadius: 0,
          fill: false,
          data: []
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: true
      }
    });
    canvas.style.background = "#fff";
  },

  initPieChart() {
    const canvas = document.getElementById("pieChart");
    this.pieChart = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: ["#3182f6", "#ff3b30", "#ffcd56", "#4caf50", "#f44336"]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        layout: { padding: 20 },
        radius: "85%",
        cutout: "60%",
        plugins: {
          legend: { position: "bottom" },
          datalabels: {
            color: "#333",
            font: { weight: "600", size: 12 },
            formatter: (value, ctx) => {
              const sum = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
              const pct = ((value / sum) * 100).toFixed(1);
              return `${pct}%`;
            }
          }
        }
      },
      plugins: [ChartDataLabels]
    });
    canvas.style.background = "#fff";
  },

  updatePie(data) {
    if (!this.pieChart) this.initPieChart();
    this.pieChart.data.labels = data.map(d => d.label);
    this.pieChart.data.datasets[0].data = data.map(d => d.value);
    this.pieChart.update();
  },

  drawCandleChart(canvas, data) {
    const { price, open, high, low, change } = data;
    if (!canvas || !price || !open || !high || !low) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const isUp = change > 0;
    const candleColor = isUp ? '#ff3b30' : change < 0 ? '#007aff' : '#000';
    const x = Math.floor(w / 2);

    ctx.strokeStyle = candleColor;
    ctx.fillStyle = candleColor;
    ctx.lineWidth = 1;

    const min = Math.min(low, open, price);
    const max = Math.max(high, open, price);
    const range = max - min;
    const padding = Math.max(range * 0.1, 1);

    const getY = price => {
      if (!range) return h/2;
      return Math.floor(4 + (h-8) * (1 - (price - (min - padding)) / (range + padding * 2)));
    };

    ctx.beginPath();
    ctx.moveTo(x, getY(high));
    ctx.lineTo(x, getY(low));
    ctx.stroke();

    const priceY = getY(price);
    const openY = getY(open);
    const bodyY = Math.min(priceY, openY);
    const bodyHeight = Math.max(Math.abs(priceY - openY), 1);
    const bodyWidth = 8;
    ctx.fillRect(x - bodyWidth / 2, bodyY, bodyWidth, bodyHeight);
  }
}; 