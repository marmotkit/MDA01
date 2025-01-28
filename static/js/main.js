// 語音識別相關變量
let recognition = null;
let isRecording = false;
let currentSide = null;
let audioContext = null;
let audioQueue = [];
let isProcessingAudio = false;

// 初始化音頻上下文
function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
}

// 初始化語音識別
function initSpeechRecognition() {
    if ('webkitSpeechRecognition' in window) {
        try {
            recognition = new webkitSpeechRecognition();
            recognition.continuous = true;  // 改回連續模式
            recognition.interimResults = true;

            recognition.onstart = () => {
                isRecording = true;
                updateRecordingUI();
                const warningDiv = document.querySelector('.speech-warning');
                if (warningDiv) {
                    warningDiv.remove();
                }
                console.log('語音識別開始，當前側:', currentSide);
            };

            recognition.onend = () => {
                console.log('語音識別結束，isRecording:', isRecording, 'currentSide:', currentSide);
                isRecording = false;
                updateRecordingUI();
                
                // 如果當前有指定側別且不在處理音頻，則重新開始錄音
                if (currentSide && !isProcessingAudio) {
                    console.log('準備重新開始錄音');
                    setTimeout(() => {
                        try {
                            recognition.start();
                            console.log('成功重新開始錄音');
                        } catch (error) {
                            console.error('重新開始錄音失敗:', error);
                            currentSide = null;
                            updateRecordingUI();
                        }
                    }, 300);
                }
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
                console.error('語音識別錯誤:', event.error);
                isRecording = false;
                updateRecordingUI();

                // 根據錯誤類型顯示不同的提示
                let errorMessage = '';
                switch (event.error) {
                    case 'not-allowed':
                        errorMessage = '請允許使用麥克風以啟用語音功能';
                        showSpeechWarning(errorMessage);
                        break;
                    case 'no-speech':
                        errorMessage = '未檢測到語音，請靠近麥克風或檢查麥克風設置';
                        break;
                    case 'network':
                        errorMessage = '網絡連接問題，請檢查您的網絡連接';
                        break;
                    default:
                        errorMessage = '語音識別發生錯誤，請使用文字輸入或重試';
                }
                
                if (errorMessage && event.error !== 'no-speech') {
                    showSpeechWarning(errorMessage);
                }
            };

            // 請求麥克風權限
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    stream.getTracks().forEach(track => track.stop());
                    console.log('麥克風權限已獲得');
                })
                .catch(err => {
                    console.error('無法獲得麥克風權限:', err);
                    showSpeechWarning('請允許使用麥克風以啟用語音功能');
                });

        } catch (error) {
            console.error('初始化語音識別失敗:', error);
            showSpeechWarning('您的瀏覽器可能不完全支持語音識別功能，請使用文字輸入');
        }
    } else {
        console.log('瀏覽器不支持語音識別功能');
        showSpeechWarning('您的瀏覽器不支持語音識別功能，請使用文字輸入');
    }
}

// 顯示語音警告訊息
function showSpeechWarning(message) {
    // 移除現有的警告（如果有）
    const existingWarning = document.querySelector('.speech-warning');
    if (existingWarning) {
        existingWarning.remove();
    }

    // 創建新的警告訊息
    const warningDiv = document.createElement('div');
    warningDiv.className = 'speech-warning';
    warningDiv.style.cssText = 'background-color: #fff3cd; color: #856404; padding: 10px; margin: 10px; border-radius: 5px; text-align: center; position: relative;';
    
    // 添加關閉按鈕
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '×';
    closeButton.style.cssText = 'position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; font-size: 20px; cursor: pointer; color: #856404;';
    closeButton.onclick = () => warningDiv.remove();
    
    // 設置警告內容
    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    
    warningDiv.appendChild(messageSpan);
    warningDiv.appendChild(closeButton);
    document.body.insertBefore(warningDiv, document.body.firstChild);
}

// 開始錄音
function startRecording(side) {
    if (!recognition) {
        initSpeechRecognition();
    }
    
    console.log('開始錄音，側別:', side);
    
    // 如果正在處理音頻，等待處理完成
    if (isProcessingAudio) {
        console.log('正在處理音頻，稍後自動開始錄音');
        currentSide = side;
        return;
    }
    
    try {
        // 如果當前正在錄音，且側別不同，則先停止當前錄音
        if (isRecording) {
            if (currentSide !== side) {
                recognition.stop();
                setTimeout(() => {
                    currentSide = side;
                    startRecordingWithLang(side);
                }, 300);
            }
        } else {
            currentSide = side;
            startRecordingWithLang(side);
        }
    } catch (error) {
        console.error('開始錄音失敗:', error);
        currentSide = null;
        updateRecordingUI();
    }
}

// 使用指定語言開始錄音
function startRecordingWithLang(side) {
    try {
        const sourceLang = side === 'left' ? 
            document.getElementById('leftLanguage').value : 
            document.getElementById('rightLanguage').value;
        recognition.lang = sourceLang;
        recognition.start();
        console.log('開始新的錄音，語言:', sourceLang);
    } catch (error) {
        console.error('設置語言並開始錄音失敗:', error);
        currentSide = null;
        updateRecordingUI();
    }
}

// 停止錄音
function stopRecording() {
    console.log('停止錄音');
    if (recognition && isRecording) {
        currentSide = null;
        recognition.stop();
        isRecording = false;
        updateRecordingUI();
    }
}

// 翻譯並朗讀文字
async function translateAndSpeak(text, side) {
    try {
        const sourceLang = side === 'left' ? getLeftLanguage() : getRightLanguage();
        const targetLang = side === 'left' ? getRightLanguage() : getLeftLanguage();

        const response = await fetch('/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: text,
                source_lang: sourceLang,
                target_lang: targetLang
            })
        });

        if (!response.ok) {
            throw new Error('翻譯請求失敗');
        }

        const data = await response.json();
        
        if (data.translation) {
            // 添加翻譯結果到對話框
            addChatBubble(data.translation, side === 'left' ? 'right' : 'left');
            
            // 檢查是否處於靜音模式
            const muteMode = document.getElementById('muteModeBidirectional').checked;
            if (!muteMode) {
                try {
                    // 使用新的朗讀方式
                    await speakText(data.translation, targetLang);
                } catch (error) {
                    console.error('朗讀錯誤:', error);
                    // 如果朗讀失敗，嘗試重新朗讀
                    try {
                        await speakText(data.translation, targetLang);
                    } catch (retryError) {
                        console.error('重試朗讀失敗:', retryError);
                    }
                }
            }
        }
    } catch (error) {
        console.error('翻譯錯誤:', error);
        alert('翻譯過程中發生錯誤');
    }
}

// 朗讀文字
async function speakText(text, lang) {
    try {
        console.log('開始 TTS 請求:', { text, lang });
        isProcessingAudio = true;
        
        // 暫時停止錄音
        const tempSide = currentSide;
        if (isRecording) {
            recognition.stop();
        }

        const response = await fetch('/tts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: text,
                lang: lang
            })
        });

        if (!response.ok) {
            throw new Error(`TTS 請求失敗: ${response.status}`);
        }

        const blob = await response.blob();
        if (blob.size === 0) {
            throw new Error('收到空的音頻數據');
        }

        const url = URL.createObjectURL(blob);
        const audio = new Audio();
        audio.src = url;
        
        // 確保音頻已加載
        await new Promise((resolve) => {
            audio.addEventListener('canplaythrough', resolve, { once: true });
            audio.load();
        });

        // 使用 Web Audio API 播放音頻
        const context = initAudioContext();
        const source = context.createMediaElementSource(audio);
        source.connect(context.destination);
        
        // 自動播放
        try {
            await context.resume();
            await audio.play();
            console.log('音頻開始自動播放');
        } catch (playError) {
            console.error('自動播放失敗，添加播放按鈕:', playError);
            const playButton = document.createElement('button');
            playButton.className = 'btn btn-primary mt-2';
            playButton.innerHTML = '<i class="fas fa-play"></i> 點擊播放音頻';
            
            playButton.onclick = async () => {
                try {
                    await context.resume();
                    await audio.play();
                    playButton.remove();
                } catch (err) {
                    console.error('手動播放失敗:', err);
                }
            };
            
            const chatBubbles = document.getElementsByClassName('chat-bubble');
            if (chatBubbles.length > 0) {
                chatBubbles[chatBubbles.length - 1].appendChild(playButton);
            }
        }

        // 等待播放完成
        await new Promise((resolve) => {
            audio.onended = () => {
                console.log('音頻播放完成');
                URL.revokeObjectURL(url);
                resolve();
            };
        });

        // 清理並恢復錄音
        isProcessingAudio = false;
        if (tempSide) {
            setTimeout(() => {
                startRecording(tempSide);
            }, 300);
        }
    } catch (error) {
        console.error('TTS 處理錯誤:', error);
        isProcessingAudio = false;
        if (currentSide) {
            setTimeout(() => {
                startRecording(currentSide);
            }, 300);
        }
    }
}

// 標記用戶已交互
document.addEventListener('click', () => {
    document.body.classList.add('user-interacted');
}, { once: true });

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

    // 左側文字輸入處理
    const leftTextInput = document.getElementById('leftTextInput');
    const sendLeftText = document.getElementById('sendLeftText');
    
    if (sendLeftText) {
        sendLeftText.addEventListener('click', () => handleTextInput('left'));
    }
    
    if (leftTextInput) {
        leftTextInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleTextInput('left');
            }
        });
    }
    
    // 右側文字輸入處理
    const rightTextInput = document.getElementById('rightTextInput');
    const sendRightText = document.getElementById('sendRightText');
    
    if (sendRightText) {
        sendRightText.addEventListener('click', () => handleTextInput('right'));
    }
    
    if (rightTextInput) {
        rightTextInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleTextInput('right');
            }
        });
    }

    // 初始化 UI
    updateRecordingUI();
});

// 處理文字輸入的函數
function handleTextInput(side) {
    const inputElement = document.getElementById(side + 'TextInput');
    if (!inputElement) return;
    
    const text = inputElement.value.trim();
    if (text) {
        addChatBubble(text, side);
        translateAndSpeak(text, side);
        inputElement.value = ''; // 清空輸入框
    }
}

// 取得左側語言
function getLeftLanguage() {
    return document.getElementById('leftLanguage').value;
}

// 取得右側語言
function getRightLanguage() {
    return document.getElementById('rightLanguage').value;
}

// 在頁面加載時初始化音頻上下文
document.addEventListener('DOMContentLoaded', () => {
    // 初始化語音識別
    initSpeechRecognition();
    
    // 初始化音頻上下文（需要用戶交互）
    document.body.addEventListener('click', () => {
        const context = initAudioContext();
        if (context.state === 'suspended') {
            context.resume();
        }
    }, { once: true });
});
