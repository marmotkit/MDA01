// 語音識別相關變量
let recognition = null;
let isRecording = false;
let currentSide = null;

// 初始化語音識別
function initSpeechRecognition() {
    if ('webkitSpeechRecognition' in window) {
        try {
            recognition = new webkitSpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;

            recognition.onstart = () => {
                isRecording = true;
                updateRecordingUI();
                // 移除警告訊息（如果存在）
                const warningDiv = document.querySelector('.speech-warning');
                if (warningDiv) {
                    warningDiv.remove();
                }
            };

            recognition.onend = () => {
                isRecording = false;
                currentSide = null;
                updateRecordingUI();
                // 如果是意外停止，自動重新開始
                if (currentSide) {
                    startRecording(currentSide);
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

// 初始化語音播放器
let audioPlayer = new Audio();
let speaking = false;

// 朗讀文字
async function speakText(text, lang) {
    try {
        console.log('開始 TTS 請求:', { text, lang });
        
        // 取消當前播放
        if (speaking) {
            audioPlayer.pause();
            audioPlayer.currentTime = 0;
        }

        // 發送 TTS 請求
        console.log('發送 TTS 請求...');
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

        // 獲取音頻 blob
        const blob = await response.blob();
        console.log('收到音頻數據，大小:', blob.size, '字節');
        
        if (blob.size === 0) {
            throw new Error('收到空的音頻數據');
        }

        const url = URL.createObjectURL(blob);
        console.log('創建的音頻 URL:', url);

        // 創建新的音頻元素
        audioPlayer = new Audio();
        
        // 設置音頻事件處理
        audioPlayer.onloadedmetadata = () => {
            console.log('音頻元數據加載完成，時長:', audioPlayer.duration);
        };

        audioPlayer.oncanplay = () => {
            console.log('音頻可以開始播放');
        };

        audioPlayer.onplay = () => {
            speaking = true;
            console.log('開始播放音頻');
        };

        audioPlayer.onended = () => {
            speaking = false;
            console.log('音頻播放完成');
            URL.revokeObjectURL(url);
        };

        audioPlayer.onerror = (error) => {
            speaking = false;
            console.error('音頻播放錯誤:', error);
            URL.revokeObjectURL(url);
        };

        // 設置音頻源
        audioPlayer.src = url;
        
        // iOS Safari 特殊處理
        if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
            console.log('檢測到 iOS 設備，使用特殊播放邏輯');
            
            // 預加載音頻
            await audioPlayer.load();
            
            // 嘗試播放
            try {
                // 使用 Promise 包裝播放操作
                await new Promise((resolve, reject) => {
                    // 設置超時檢查
                    const timeoutId = setTimeout(() => {
                        reject(new Error('播放超時'));
                    }, 3000);

                    // 監聽播放開始事件
                    const playStarted = () => {
                        clearTimeout(timeoutId);
                        resolve();
                    };

                    audioPlayer.addEventListener('playing', playStarted, { once: true });
                    
                    // 嘗試播放
                    const playPromise = audioPlayer.play();
                    if (playPromise !== undefined) {
                        playPromise.catch(error => {
                            clearTimeout(timeoutId);
                            console.error('播放失敗，等待用戶交互:', error);
                            
                            // 創建播放按鈕
                            const playButton = document.createElement('button');
                            playButton.className = 'btn btn-primary mt-2';
                            playButton.innerHTML = '<i class="fas fa-play"></i> 點擊播放音頻';
                            playButton.onclick = async () => {
                                try {
                                    await audioPlayer.play();
                                    playButton.remove();
                                } catch (err) {
                                    console.error('手動播放失敗:', err);
                                }
                            };
                            
                            // 將按鈕添加到最新的聊天氣泡旁
                            const chatBubbles = document.getElementsByClassName('chat-bubble');
                            if (chatBubbles.length > 0) {
                                const latestBubble = chatBubbles[0];
                                latestBubble.appendChild(playButton);
                            }
                        });
                    }
                });
            } catch (error) {
                console.error('iOS 播放失敗:', error);
            }
        } else {
            // 非 iOS 設備直接播放
            console.log('非 iOS 設備，直接播放');
            await audioPlayer.play();
        }
    } catch (error) {
        console.error('TTS 處理錯誤:', error);
        speaking = false;
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
