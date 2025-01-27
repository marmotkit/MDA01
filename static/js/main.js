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
            console.error('Speech recognition error:', event.error);
            if (event.error === 'not-allowed') {
                alert('請允許使用麥克風以啟用語音功能');
            }
            stopRecording();
        };

        // 在頁面加載時請求麥克風權限
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                stream.getTracks().forEach(track => track.stop());
                console.log('麥克風權限已獲得');
            })
            .catch(err => {
                console.error('無法獲得麥克風權限:', err);
                alert('請允許使用麥克風以啟用語音功能');
            });
    } else {
        alert('您的瀏覽器不支持語音識別功能');
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

// 初始化語音合成
let synth = window.speechSynthesis;
let speaking = false;

// 在頁面加載時初始化語音合成
document.addEventListener('DOMContentLoaded', () => {
    // 在 iOS 上預熱語音合成
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
        // 創建一個空的語音實例並播放，這樣可以初始化語音引擎
        const utterance = new SpeechSynthesisUtterance('');
        synth.speak(utterance);
    }
});

// 確保語音合成在頁面隱藏時暫停，顯示時恢復
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (speaking) {
            synth.pause();
        }
    } else {
        if (speaking) {
            synth.resume();
        }
    }
});

// 朗讀文字
function speakText(text, lang) {
    return new Promise((resolve, reject) => {
        if (!synth) {
            console.error('瀏覽器不支持語音合成');
            reject('瀏覽器不支持語音合成');
            return;
        }

        // 取消之前的朗讀
        synth.cancel();
        speaking = false;

        // 在 iOS 上，需要先解鎖音頻上下文
        if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
            // 創建一個音頻上下文並播放一個短暫的聲音
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            oscillator.connect(audioContext.destination);
            oscillator.start();
            oscillator.stop(0.1);
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        // 處理各種事件
        utterance.onstart = () => {
            speaking = true;
            console.log('開始朗讀');
        };

        utterance.onend = () => {
            speaking = false;
            console.log('朗讀完成');
            resolve();
        };

        utterance.onerror = (event) => {
            speaking = false;
            console.error('朗讀錯誤:', event);
            reject(event);
        };

        // 在 iOS Safari 上的特殊處理
        if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
            // 確保語音合成已經準備好
            synth.cancel();

            // 使用 setTimeout 來確保語音命令被正確處理
            setTimeout(() => {
                try {
                    // 強制刷新語音狀態
                    synth.pause();
                    synth.resume();
                    
                    // 開始朗讀
                    synth.speak(utterance);

                    // 如果 5 秒後還沒有開始朗讀，就重試
                    setTimeout(() => {
                        if (!speaking) {
                            console.log('重試朗讀');
                            synth.cancel();
                            synth.speak(utterance);
                        }
                    }, 5000);
                } catch (error) {
                    console.error('語音合成錯誤:', error);
                    reject(error);
                }
            }, 100);
        } else {
            // 非 iOS 設備直接朗讀
            synth.speak(utterance);
        }
    });
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

// 取得左側語言
function getLeftLanguage() {
    return document.getElementById('leftLanguage').value;
}

// 取得右側語言
function getRightLanguage() {
    return document.getElementById('rightLanguage').value;
}
