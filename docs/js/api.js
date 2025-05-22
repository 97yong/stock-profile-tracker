import { CONFIG } from './config.js';

export const ApiManager = {
  async verifyPassword(pw) {
    try {
      const r = await fetch(CONFIG.WORKER_URL + "check-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw })
      });
      const { ok } = await r.json();
      return !!ok;
    } catch {
      return false;
    }
  },

  async fetchQuote(code) {
    try {
      const r = await fetch(CONFIG.WORKER_URL + "quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });
      const data = await r.json();
      console.log('서버 응답:', code, data);  // 응답 데이터 확인
      if (!data.price) throw new Error('가격 정보를 가져올 수 없습니다');
      return data;
    } catch (e) {
      console.error("종목 조회 실패:", e);
      return null;
    }
  }
}; 