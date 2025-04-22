# Flask 기반 웹 주식 트래커 백엔드 (Python)

from flask import Flask, request, jsonify, render_template
import requests
from bs4 import BeautifulSoup

app = Flask(__name__)

# 네이버 금융에서 주식 가격 가져오기
@app.route('/api/stock', methods=['POST'])
def get_stock_info():
    data = request.get_json()
    codes = data.get("codes", [])
    avgs = data.get("avgs", [])
    qtys = data.get("qtys", [])

    results = []
    for i, code in enumerate(codes):
        url = f"https://finance.naver.com/item/main.nhn?code={code}"
        headers = {"User-Agent": "Mozilla/5.0"}
        try:
            response = requests.get(url, headers=headers)
            soup = BeautifulSoup(response.text, "html.parser")
            price_tag = soup.select_one("p.no_today span.blind")
            price = int(price_tag.text.replace(",", "")) if price_tag else 0
            avg = int(avgs[i])
            qty = int(qtys[i])
            profit = round(((price - avg) / avg) * 100, 2)
            current_value = price * qty

            results.append({
                "code": code,
                "price": price,
                "avg": avg,
                "qty": qty,
                "profit": profit,
                "value": current_value
            })
        except:
            results.append({"code": code, "error": True})

    return jsonify(results)

@app.route('/')
def home():
    return render_template("index.html")

if __name__ == '__main__':
    app.run(debug=True)