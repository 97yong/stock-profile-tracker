import { CONFIG } from './config.js';

// Cache for stock data with shorter TTL
const stockCache = new Map();
const CACHE_TTL = 3 * 1000; // 3초로 단축

// Rate limiting
const rateLimits = new Map();
const RATE_LIMIT = 10; // requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute

// 장 운영 시간 체크
const isMarketOpen = () => {
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  return cur >= CONFIG.MARKET_START && cur <= CONFIG.MARKET_END;
};

export const ApiManager = {
  async verifyPassword(pw) {
    try {
      const response = await fetch(CONFIG.WORKER_URL + "check-password", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw })
      });
      const data = await response.json();
      return data.ok;
    } catch (err) {
      console.error('Password verification failed:', err);
      return false;
    }
  },

  async fetchQuotes(codes) {
    try {
      // 캐시된 데이터 확인
      const now = Date.now();
      const results = {};
      const codesToFetch = [];

      // 각 코드별로 캐시 확인
      for (const code of codes) {
        const cached = stockCache.get(code);
        if (cached && now - cached.timestamp < CACHE_TTL) {
          results[code] = cached.data;
        } else {
          codesToFetch.push(code);
        }
      }

      // 캐시되지 않은 코드가 있는 경우에만 API 호출
      if (codesToFetch.length > 0) {
        const response = await fetch(`${CONFIG.WORKER_URL}quotes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ codes: codesToFetch })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch stock data');
        }

        // 응답 데이터를 각 코드별로 분리하여 캐시에 저장
        for (const code of codesToFetch) {
          const stockData = data.data[code];
          if (stockData) {
            stockCache.set(code, {
              data: stockData,
              timestamp: now
            });
            results[code] = stockData;
          }
        }
      }

      return results;
    } catch (error) {
      console.error('Error in fetchQuotes:', error);
      throw error;
    }
  },

  async fetchQuote(code) {
    const results = await this.fetchQuotes([code]);
    return results[code];
  },

  getLastQuote(code) {
    const cached = stockCache.get(code);
    return cached ? cached.data : null;
  },

  // 캐시 초기화 (필요한 경우 사용)
  clearCache() {
    stockCache.clear();
  }
}; 