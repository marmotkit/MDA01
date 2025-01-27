from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
import os
from datetime import datetime
import qrcode
from PIL import Image
import io
import base64
import logging
import traceback
import sys
from openai import OpenAI

app = Flask(__name__)

# 設置日誌級別為 DEBUG 並輸出到控制台
app.logger.setLevel(logging.DEBUG)
handler = logging.StreamHandler(sys.stdout)
handler.setLevel(logging.DEBUG)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
handler.setFormatter(formatter)
app.logger.addHandler(handler)

# 配置數據庫
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///app.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# 載入環境變數
from dotenv import load_dotenv
load_dotenv()

# 檢查 API 金鑰並初始化 OpenAI client
api_key = os.getenv('OPENAI_API_KEY')
client = OpenAI(api_key=api_key) if api_key else None
app.logger.info(f"API key loaded: {'Yes' if api_key else 'No'}")
app.logger.debug(f"API key value: {api_key[:5]}..." if api_key else "No API key")

# 資料模型
class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    deadline = db.Column(db.DateTime, nullable=False)
    reminder_frequency = db.Column(db.String(50))
    completed = db.Column(db.Boolean, default=False)

class BusinessCard(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    title = db.Column(db.String(100))
    company = db.Column(db.String(200))
    phone = db.Column(db.String(50))
    email = db.Column(db.String(120))
    qr_code = db.Column(db.Text)

with app.app_context():
    db.create_all()

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
            'en-US': '英文',
            'ja-JP': '日文',
            'ko-KR': '韓文',
            'fr-FR': '法文',
            'de-DE': '德文',
            'es-ES': '西班牙文',
            'it-IT': '義大利文',
            'ru-RU': '俄文',
            'pt-PT': '葡萄牙文',
            'nl-NL': '荷蘭文'
        }

        data = request.get_json()
        text = data.get('text', '')
        source_lang = data.get('source_lang', 'zh-TW')
        target_lang = data.get('target_lang', 'en-US')

        if not text:
            return jsonify({"error": "請輸入要翻譯的文字"}), 400

        source_lang_name = language_names.get(source_lang, source_lang)
        target_lang_name = language_names.get(target_lang, target_lang)

        # 構建翻譯提示
        system_prompt = f"""你是一個翻譯助手。請將用戶的{source_lang_name}文字翻譯成{target_lang_name}。
        要求：
        1. 只輸出翻譯後的文字，不要有任何其他解釋或說明
        2. 保持原文的語氣和格式
        3. 使用地道的表達方式
        4. 如果原文中包含特殊符號或表情符號，在翻譯中保留它們"""

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
        app.logger.error(f"翻譯錯誤: {str(e)}")
        app.logger.error(traceback.format_exc())
        return jsonify({"error": "翻譯過程發生錯誤", "details": str(e)}), 500

# 待辦事項路由
@app.route('/tasks', methods=['GET', 'POST', 'PUT', 'DELETE'])
def tasks():
    if request.method == 'GET':
        tasks = Task.query.all()
        return jsonify([{
            'id': task.id,
            'title': task.title,
            'deadline': task.deadline.isoformat(),
            'reminder_frequency': task.reminder_frequency,
            'completed': task.completed
        } for task in tasks])
    
    elif request.method == 'POST':
        data = request.json
        task = Task(
            title=data['title'],
            deadline=datetime.fromisoformat(data['deadline']),
            reminder_frequency=data['reminder_frequency']
        )
        db.session.add(task)
        db.session.commit()
        return jsonify({"success": True, "id": task.id})
    
    elif request.method == 'PUT':
        task_id = request.args.get('id')
        task = Task.query.get_or_404(task_id)
        task.completed = not task.completed
        db.session.commit()
        return jsonify({"success": True})
    
    elif request.method == 'DELETE':
        task_id = request.args.get('id')
        task = Task.query.get_or_404(task_id)
        db.session.delete(task)
        db.session.commit()
        return jsonify({"success": True})

# 電子名片路由
@app.route('/business-card', methods=['POST'])
def create_business_card():
    data = request.json
    
    # 創建名片資訊字串
    card_info = f"""
    姓名: {data['name']}
    職稱: {data['title']}
    公司: {data['company']}
    電話: {data['phone']}
    電子郵件: {data['email']}
    """
    
    # 生成 QR Code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(card_info)
    qr.make(fit=True)
    
    # 創建 QR Code 圖片
    qr_image = qr.make_image(fill_color="black", back_color="white")
    
    # 將圖片轉換為 base64 字串
    buffered = io.BytesIO()
    qr_image.save(buffered, format="PNG")
    qr_base64 = base64.b64encode(buffered.getvalue()).decode()
    
    # 儲存到資料庫
    business_card = BusinessCard(
        name=data['name'],
        title=data['title'],
        company=data['company'],
        phone=data['phone'],
        email=data['email'],
        qr_code=qr_base64
    )
    db.session.add(business_card)
    db.session.commit()
    
    return jsonify({"success": True, "qr_code": qr_base64})

if __name__ == '__main__':
    app.run(debug=True)
