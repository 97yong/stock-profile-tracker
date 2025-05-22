import { CONFIG } from './config.js';

export const ChartManager = {
  lineChart: null,
  pieChart: null,
  candleData: {},

  initLineChart() {
    const canvas = document.getElementById("lineChart");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    // 캔버스 크기를 DPR에 맞게 조정
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);  // 컨텍스트 스케일 조정

    this.lineChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "현재 평가금액",
            data: [],
            borderColor: "#3182f6",
            backgroundColor: "rgba(49,130,246,0.1)",
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: "#3182f6",
            pointHoverBorderColor: "#fff",
            pointHoverBorderWidth: 2
          },
          {
            label: "초기 평가금액",
            data: [],
            borderColor: "#6b7684",
            backgroundColor: "rgba(107,118,132,0.05)",
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: "#6b7684",
            pointHoverBorderColor: "#fff",
            pointHoverBorderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        devicePixelRatio: 2,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              boxWidth: 12,
              padding: 15,
              font: {
                size: 13,
                family: 'Pretendard',
                weight: '600'
              },
              usePointStyle: true,
              pointStyle: 'circle',
              color: '#1f2d37'
            }
          },
          tooltip: {
            backgroundColor: 'rgba(255,255,255,0.95)',
            titleColor: '#1f2d37',
            bodyColor: '#1f2d37',
            borderColor: '#e5e7eb',
            borderWidth: 1,
            padding: 12,
            boxPadding: 6,
            usePointStyle: true,
            titleFont: {
              size: 13,
              weight: '600',
              family: 'Pretendard'
            },
            bodyFont: {
              size: 12,
              weight: '500',
              family: 'Pretendard'
            },
            callbacks: {
              label: function(context) {
                return context.dataset.label + ': ' + context.parsed.y.toLocaleString() + '원';
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              maxRotation: 0,
              font: {
                size: 12,
                family: 'Pretendard',
                weight: '500'
              },
              padding: 8,
              color: '#6b7684'
            }
          },
          y: {
            beginAtZero: false,
            grid: {
              color: '#f1f4f6'
            },
            ticks: {
              font: {
                size: 12,
                family: 'Pretendard',
                weight: '500'
              },
              padding: 8,
              color: '#6b7684',
              callback: function(value) {
                return value.toLocaleString() + '원';
              }
            }
          }
        },
        layout: {
          padding: {
            top: 10,
            right: 10,
            bottom: 10,
            left: 10
          }
        }
      }
    });
  },

  initPieChart() {
    const canvas = document.getElementById("pieChart");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    // 캔버스 크기를 DPR에 맞게 조정
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);  // 컨텍스트 스케일 조정

    this.pieChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: [
            "#3182f6",  // 파란색
            "#ff3b30",  // 빨간색
            "#ffcd56",  // 노란색
            "#4caf50",  // 초록색
            "#9c27b0",  // 보라색
            "#ff9800",  // 주황색
            "#00bcd4",  // 청록색
            "#795548"   // 갈색
          ],
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        devicePixelRatio: 2,  // 고해상도 디스플레이를 위한 DPR 설정
        layout: { 
          padding: {
            top: 20,
            bottom: 20
          }
        },
        radius: "85%",
        cutout: "65%",
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              padding: 20,
              font: {
                size: 12,
                family: 'Pretendard',
                weight: '500'
              },
              color: '#1f2d37',
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            backgroundColor: 'rgba(255,255,255,0.95)',
            titleColor: '#1f2d37',
            bodyColor: '#1f2d37',
            borderColor: '#e5e7eb',
            borderWidth: 1,
            padding: 12,
            boxPadding: 6,
            titleFont: {
              size: 13,
              weight: '600',
              family: 'Pretendard'
            },
            bodyFont: {
              size: 12,
              weight: '500',
              family: 'Pretendard'
            },
            callbacks: {
              label: function(context) {
                const value = context.raw;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return `${context.label}: ${value.toLocaleString()}원 (${percentage}%)`;
              }
            }
          },
          datalabels: {
            color: "#1f2d37",
            font: { 
              weight: "600", 
              size: 12,
              family: 'Pretendard'
            },
            formatter: (value, ctx) => {
              const sum = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
              const pct = ((value / sum) * 100).toFixed(1);
              return pct >= 5 ? `${pct}%` : '';  // 5% 미만은 표시하지 않음
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

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    // 캔버스 크기를 DPR에 맞게 조정
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);  // 컨텍스트 스케일 조정

    const w = rect.width, h = rect.height;
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