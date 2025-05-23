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
    if (!Array.isArray(codes)) {
      codes = [codes];
    }

    // 장 운영 시간이 아닌 경우 캐시된 데이터 사용
    if (!isMarketOpen()) {
      const cachedResults = codes.map(code => stockCache.get(code)?.data).filter(Boolean);
      if (cachedResults.length === codes.length) {
        return cachedResults;
      }
    }

    // Check rate limit
    const now = Date.now();
    const userKey = 'default';
    const userRequests = rateLimits.get(userKey) || [];
    const recentRequests = userRequests.filter(time => now - time < RATE_WINDOW);
    
    if (recentRequests.length >= RATE_LIMIT) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    
    // Update rate limit
    recentRequests.push(now);
    rateLimits.set(userKey, recentRequests);

    // Check cache for all codes
    const uncachedCodes = codes.filter(code => {
      const cached = stockCache.get(code);
      return !cached || now - cached.timestamp >= CACHE_TTL;
    });

    if (uncachedCodes.length === 0) {
      return codes.map(code => stockCache.get(code).data);
    }

    try {
      const response = await fetch(CONFIG.WORKER_URL + "quote", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codes: uncachedCodes })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const results = Array.isArray(data) ? data : [data];
      
      // Cache the results
      results.forEach(result => {
        if (!result.error) {
          stockCache.set(result.code, {
            data: result,
            timestamp: now
          });
        }
      });

      // Combine cached and new results
      return codes.map(code => {
        const cached = stockCache.get(code);
        return cached ? cached.data : results.find(r => r.code === code);
      });
    } catch (err) {
      console.error('Failed to fetch stock data:', err);
      // 에러 발생 시 캐시된 데이터가 있다면 사용
      const cachedResults = codes.map(code => stockCache.get(code)?.data).filter(Boolean);
      if (cachedResults.length > 0) {
        console.log('Using cached data due to error');
        return cachedResults;
      }
      throw err;
    }
  },

  async fetchQuote(code) {
    const results = await this.fetchQuotes([code]);
    return results[0];
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