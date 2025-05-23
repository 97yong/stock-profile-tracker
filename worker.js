// Environment variables
const PASSWORD_HASH = '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8'; // sha256 of "9703"

export default {
  async fetch(request) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    // 비밀번호 확인
    if (pathname === "/check-password") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
      }

      try {
        const { password } = await request.json();
        if (!password) {
          return new Response(JSON.stringify({ error: "Password required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const ok = password === "9703";
        return new Response(JSON.stringify({ ok }), {
          status: ok ? 200 : 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: "Invalid request" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // 주식 데이터 조회
    if (pathname === "/quotes") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
      }

      try {
        const { codes } = await request.json();
        if (!Array.isArray(codes) || codes.length === 0) {
          return new Response(JSON.stringify({
            success: false,
            error: "Invalid stock codes"
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // 유효한 종목 코드인지 확인
        const validCodes = codes.filter(code => /^\d{6}$/.test(code));
        if (validCodes.length === 0) {
          return new Response(JSON.stringify({
            success: false,
            error: "No valid stock codes provided"
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // 병렬로 데이터 가져오기
        const results = {};
        await Promise.all(validCodes.map(async (code) => {
          try {
            const res = await fetch(`https://finance.naver.com/item/main.naver?code=${code}`, {
              headers: { 
                "User-Agent": "Mozilla/5.0",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "ko-KR,ko;q=0.8,en-US;q=0.5,en;q=0.3"
              }
            });

            if (!res.ok) {
              throw new Error(`Failed to fetch stock data: ${res.status}`);
            }

            const html = await res.text();
            
            function extractNumberFromBlock(block) {
              if (!block) return null;
              const matches = [...block.matchAll(/<span[^>]*>(\d+|[.,])<\/span>/g)];
              const joined = matches.map(m => m[1] === 'jum' ? '.' : m[1]).join('');
              return parseFloat(joined.replace(/,/g, ''));
            }

            function extractFieldByTd(label) {
              const tdRegex = new RegExp(`<td[^>]*>\\s*<span class=\\"sptxt ${label}\\">[^<]*<\\/span>[\\s\\S]*?<em[^>]*>([\\s\\S]*?)<\\/em>`);
              const tdMatch = html.match(tdRegex);
              return tdMatch ? extractNumberFromBlock(tdMatch[1]) : null;
            }

            const priceMatch = html.match(/<p class=\"no_today\">([\s\S]*?)<\/p>/);
            const price = priceMatch ? extractNumberFromBlock(priceMatch[1]) : null;

            if (!price) {
              throw new Error("Failed to extract price data");
            }

            const prevClose = extractFieldByTd("sp_txt2");
            const open = extractFieldByTd("sp_txt3");
            const high = extractFieldByTd("sp_txt4");
            const low = extractFieldByTd("sp_txt5");
            const volume = extractFieldByTd("sp_txt9");

            let change = 0, rate = 0;
            if (price !== null && prevClose !== null) {
              change = price - prevClose;
              rate = prevClose !== 0 ? (change / prevClose) * 100 : 0;
            }

            results[code] = {
              price,
              change,
              rate,
              open,
              high,
              low,
              volume,
              prevClose,
              timestamp: Date.now()
            };
          } catch (err) {
            console.error(`Error fetching data for ${code}:`, err);
            results[code] = null;
          }
        }));

        return new Response(JSON.stringify({
          success: true,
          data: results
        }), {
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "Cache-Control": "no-store, must-revalidate"
          }
        });
      } catch (err) {
        console.error('Error processing request:', err);
        return new Response(JSON.stringify({ 
          success: false,
          error: "Internal server error",
          details: err.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  }
};