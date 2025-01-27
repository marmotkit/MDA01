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
    
    // 如果已經在錄音，而且是同一側，就停止錄音
    if (isRecording && currentSide === side) {
        stopRecording();
        return;
    }
    
    // 如果在錄音但是不同側，先停止當前錄音
    if (isRecording) {
        recognition.stop();
    }

    // 設置新的錄音側
    currentSide = side;
    const sourceLang = side === 'left' ? 
        document.getElementById('leftLanguage').value : 
        document.getElementById('rightLanguage').value;

    recognition.lang = sourceLang;
    recognition.start();
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
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    window.speechSynthesis.speak(utterance);
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
        // 停止按鈕永遠可用
        stopButton.disabled = false;
        
        // 更新按鈕樣式
        if (isRecording) {
            if (currentSide === 'left') {
                leftButton.classList.remove('btn-primary');
                leftButton.classList.add('btn-danger');
                rightButton.classList.add('btn-primary');
                rightButton.classList.remove('btn-danger');
            } else if (currentSide === 'right') {
                rightButton.classList.remove('btn-primary');
                rightButton.classList.add('btn-danger');
                leftButton.classList.add('btn-primary');
                leftButton.classList.remove('btn-danger');
            }
        } else {
            leftButton.classList.add('btn-primary');
            leftButton.classList.remove('btn-danger');
            rightButton.classList.add('btn-primary');
            rightButton.classList.remove('btn-danger');
        }
    }
}

// 添加聊天氣泡
function addChatBubble(text, side) {
    const chatContainer = document.getElementById('chatContainer');
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${side}`;
    bubble.textContent = text;
    chatContainer.appendChild(bubble);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// 更新臨時文字
function updateInterimTranscript(text) {
    const chatContainer = document.getElementById('chatContainer');
    let interimBubble = chatContainer.querySelector('.interim');
    
    if (!interimBubble) {
        interimBubble = document.createElement('div');
        interimBubble.className = `chat-bubble ${currentSide} interim`;
        chatContainer.appendChild(interimBubble);
    }
    
    interimBubble.textContent = text;
    chatContainer.scrollTop = chatContainer.scrollHeight;
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
