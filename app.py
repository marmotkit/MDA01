from flask import Flask, render_template, request, jsonify
from openai import OpenAI
import os
from dotenv import load_dotenv
import logging
import sys

app = Flask(__name__)

# 設置日誌級別為 DEBUG 並輸出到控制台
app.logger.setLevel(logging.DEBUG)
handler = logging.StreamHandler(sys.stdout)
handler.setLevel(logging.DEBUG)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
handler.setFormatter(formatter)
app.logger.addHandler(handler)

# 載入環境變數
load_dotenv()

# 檢查 API 金鑰並初始化 OpenAI client
api_key = os.getenv('OPENAI_API_KEY')
client = OpenAI()  # 不需要顯式傳遞 api_key，它會自動從環境變量中讀取
app.logger.info(f"API key loaded: {'Yes' if api_key else 'No'}")

@app.route('/')
def index():
    return render_template('index.html')

# 翻譯路由
@app.route('/translate', methods=['POST'])
def translate():
    if not api_key:
        return jsonify({"error": "未設置 OpenAI API 金鑰"}), 500

    try:
        # 獲取目標語言的名稱
        language_names = {
            'zh-TW': '繁體中文',
            'zh-CN': '簡體中文',
            'en-US': '英文',
            'ja-JP': '日文',
            'ko-KR': '韓文',
            'th-TH': '泰文',
            'vi-VN': '越南文'
        }

        data = request.get_json()
        text = data.get('text', '')
        source_lang = data.get('source_lang', 'auto')
        target_lang = data.get('target_lang', 'en-US')

        if not text:
            return jsonify({"error": "請輸入要翻譯的文字"}), 400

        source_lang_name = language_names.get(source_lang, source_lang)
        target_lang_name = language_names.get(target_lang, target_lang)

        # 構建翻譯提示
        if source_lang == 'auto':
            system_prompt = f"""你是一個翻譯助手。請將用戶的文字翻譯成{target_lang_name}。
            要求：
            1. 只輸出翻譯後的文字，不要有任何其他解釋或說明
            2. 保持原文的語氣和格式
            3. 使用地道的表達方式"""
        else:
            system_prompt = f"""你是一個翻譯助手。請將用戶的{source_lang_name}文字翻譯成{target_lang_name}。
            要求：
            1. 只輸出翻譯後的文字，不要有任何其他解釋或說明
            2. 保持原文的語氣和格式
            3. 使用地道的表達方式"""

        # 調用 OpenAI API
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text}
            ]
        )

        translation = response.choices[0].message.content.strip()
        return jsonify({"translation": translation})

    except Exception as e:
        app.logger.error(f"Translation error: {str(e)}")
        return jsonify({"error": f"翻譯過程中發生錯誤：{str(e)}"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=10000)
