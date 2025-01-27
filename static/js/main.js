// 語音識別相關變量
let recognition = null;
let isRecording = false;
let currentSide = null;

// 初始化語音識別
function initSpeechRecognition() {
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => {
            isRecording = true;
            updateRecordingUI();
        };

        recognition.onend = () => {
            isRecording = false;
            currentSide = null;
            updateRecordingUI();
        };

        recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            if (finalTranscript) {
                addChatBubble(finalTranscript, currentSide);
                translateAndSpeak(finalTranscript, currentSide);
            }
            if (interimTranscript) {
                updateInterimTranscript(interimTranscript);
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            stopRecording();
        };
    }
}

// 開始錄音
function startRecording(side) {
    if (!recognition) return;
    
    // 如果正在錄音但是不同側，先停止當前錄音
    if (isRecording && currentSide !== side) {
        recognition.stop();
    }

    // 如果沒有在錄音或者切換了側邊，開始新的錄音
    if (!isRecording || currentSide !== side) {
        currentSide = side;
        const sourceLang = side === 'left' ? 
            document.getElementById('leftLanguage').value : 
            document.getElementById('rightLanguage').value;

        recognition.lang = sourceLang;
        recognition.start();
    }
}

// 停止錄音
function stopRecording() {
    if (recognition && isRecording) {
        recognition.stop();
        isRecording = false;
        currentSide = null;
        updateRecordingUI();
    }
}

// 翻譯並朗讀
async function translateAndSpeak(text, side) {
    if (!text || !side) return;

    const sourceLang = side === 'left' ? 
        document.getElementById('leftLanguage').value : 
        document.getElementById('rightLanguage').value;
    const targetLang = side === 'left' ? 
        document.getElementById('rightLanguage').value : 
        document.getElementById('leftLanguage').value;

    try {
        const response = await fetch('/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text,
                source_lang: sourceLang,
                target_lang: targetLang
            })
        });

        if (!response.ok) throw new Error('Translation failed');

        const data = await response.json();
        if (data.translation) {
            addChatBubble(data.translation, side === 'left' ? 'right' : 'left');
            
            const muteMode = document.getElementById('muteModeBidirectional').checked;
            if (!muteMode) {
                speakText(data.translation, targetLang);
            }
        }
    } catch (error) {
        console.error('Translation error:', error);
        addChatBubble('翻譯錯誤，請重試', side === 'left' ? 'right' : 'left');
    }
}

// 朗讀文字
function speakText(text, lang) {
    // 檢查瀏覽器是否支持語音合成
    if (!window.speechSynthesis) {
        console.error('瀏覽器不支持語音合成');
        return;
    }

    // 取消之前的朗讀
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    
    // 在 iOS Safari 上的特殊處理
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
        // 確保語音合成已經準備好
        if (speechSynthesis.speaking) {
            speechSynthesis.cancel();
        }
        // 等待一小段時間再開始朗讀
        setTimeout(() => {
            window.speechSynthesis.speak(utterance);
        }, 100);
    } else {
        window.speechSynthesis.speak(utterance);
    }
}

// 清除對話
function clearChat() {
    const chatContainer = document.getElementById('chatContainer');
    if (chatContainer) {
        chatContainer.innerHTML = '';
    }
}

// 更新錄音 UI
function updateRecordingUI() {
    const leftButton = document.getElementById('speakLeft');
    const rightButton = document.getElementById('speakRight');
    const stopButton = document.getElementById('stopConversation');
    
    if (leftButton && rightButton && stopButton) {
        // 更新按鈕樣式
        if (isRecording) {
            // 更新錄音側按鈕
            if (currentSide === 'left') {
                leftButton.classList.remove('btn-primary');
                leftButton.classList.add('btn-danger');
                leftButton.innerHTML = '<i class="fas fa-microphone-slash"></i> 停止左側';
                rightButton.classList.add('btn-primary');
                rightButton.classList.remove('btn-danger');
                rightButton.innerHTML = '<i class="fas fa-microphone"></i> 右側發言';
            } else if (currentSide === 'right') {
                rightButton.classList.remove('btn-primary');
                rightButton.classList.add('btn-danger');
                rightButton.innerHTML = '<i class="fas fa-microphone-slash"></i> 停止右側';
                leftButton.classList.add('btn-primary');
                leftButton.classList.remove('btn-danger');
                leftButton.innerHTML = '<i class="fas fa-microphone"></i> 左側發言';
            }
            
            // 更新停止按鈕
            stopButton.classList.remove('btn-danger');
            stopButton.classList.add('btn-warning');
            stopButton.innerHTML = '<i class="fas fa-stop-circle fa-pulse"></i> 正在對話';
        } else {
            // 重置所有按鈕
            leftButton.classList.add('btn-primary');
            leftButton.classList.remove('btn-danger');
            leftButton.innerHTML = '<i class="fas fa-microphone"></i> 左側發言';
            
            rightButton.classList.add('btn-primary');
            rightButton.classList.remove('btn-danger');
            rightButton.innerHTML = '<i class="fas fa-microphone"></i> 右側發言';
            
            stopButton.classList.add('btn-danger');
            stopButton.classList.remove('btn-warning');
            stopButton.innerHTML = '<i class="fas fa-stop-circle"></i> 停止對話';
        }
    }
}

// 添加聊天氣泡
function addChatBubble(text, side) {
    const chatContainer = document.getElementById('chatContainer');
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${side}`;
    bubble.textContent = text;
    
    // 將新氣泡添加到頂部
    if (chatContainer.firstChild) {
        chatContainer.insertBefore(bubble, chatContainer.firstChild);
    } else {
        chatContainer.appendChild(bubble);
    }
    
    // 保持滾動在頂部
    chatContainer.scrollTop = 0;
}

// 更新臨時文字
function updateInterimTranscript(text) {
    const chatContainer = document.getElementById('chatContainer');
    let interimBubble = chatContainer.querySelector('.interim');
    
    if (!interimBubble) {
        interimBubble = document.createElement('div');
        interimBubble.className = `chat-bubble ${currentSide} interim`;
        // 將臨時氣泡添加到頂部
        if (chatContainer.firstChild) {
            chatContainer.insertBefore(interimBubble, chatContainer.firstChild);
        } else {
            chatContainer.appendChild(interimBubble);
        }
    }
    
    interimBubble.textContent = text;
    // 保持滾動在頂部
    chatContainer.scrollTop = 0;
}

// 切換雙向翻譯語言
function swapBidirectionalLanguages() {
    const leftLang = document.getElementById('leftLanguage');
    const rightLang = document.getElementById('rightLanguage');
    const tempValue = leftLang.value;
    leftLang.value = rightLang.value;
    rightLang.value = tempValue;
}

// 事件監聽器設置
document.addEventListener('DOMContentLoaded', function() {
    // 初始化語音識別
    initSpeechRecognition();
    
    // 雙向翻譯按鈕
    const stopConversationBtn = document.getElementById('stopConversation');
    const speakLeftBtn = document.getElementById('speakLeft');
    const speakRightBtn = document.getElementById('speakRight');
    const clearChatBtn = document.getElementById('clearChat');
    
    if (stopConversationBtn) {
        stopConversationBtn.addEventListener('click', stopRecording);
    }
    
    if (speakLeftBtn) {
        speakLeftBtn.addEventListener('click', () => startRecording('left'));
    }
    
    if (speakRightBtn) {
        speakRightBtn.addEventListener('click', () => startRecording('right'));
    }

    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', clearChat);
    }

    // 語言切換按鈕
    const swapBidirectionalBtn = document.getElementById('swapBidirectionalLanguages');
    
    if (swapBidirectionalBtn) {
        swapBidirectionalBtn.addEventListener('click', swapBidirectionalLanguages);
    }

    // 初始化 UI
    updateRecordingUI();
});
