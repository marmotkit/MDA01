// 語音識別相關變量
let recognition = null;
let isRecording = false;
let currentSide = null;

// 初始化語音識別
function initSpeechRecognition() {
    if (!recognition) {
        try {
            recognition = new webkitSpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = true;

            recognition.onstart = function() {
                console.log('開始錄音');
                isRecording = true;
                updateRecordingUI();
            };

            recognition.onend = function() {
                console.log('錄音結束');
                isRecording = false;
                updateRecordingUI();
            };

            recognition.onerror = function(event) {
                console.error('錄音錯誤:', event.error);
                isRecording = false;
                currentSide = null;
                updateRecordingUI();
            };

            recognition.onresult = async function(event) {
                console.log('收到識別結果');
                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript;
                        console.log('最終結果:', finalTranscript);
                        
                        // 添加最終結果到聊天
                        if (currentSide) {
                            addChatBubble(finalTranscript, currentSide);
                            
                            try {
                                // 翻譯文本
                                const translatedText = await translateText(
                                    finalTranscript,
                                    document.getElementById(currentSide === 'left' ? 'leftLanguage' : 'rightLanguage').value,
                                    document.getElementById(currentSide === 'left' ? 'rightLanguage' : 'leftLanguage').value
                                );
                                
                                // 添加翻譯結果到聊天
                                addChatBubble(translatedText, currentSide === 'left' ? 'right' : 'left');
                                
                                // 如果不是靜音模式，播放翻譯
                                if (!document.getElementById('muteModeBidirectional').checked) {
                                    speakText(translatedText, document.getElementById(currentSide === 'left' ? 'rightLanguage' : 'leftLanguage').value);
                                }
                            } catch (error) {
                                console.error('翻譯過程錯誤:', error);
                            }
                        }
                    } else {
                        interimTranscript += transcript;
                        console.log('臨時結果:', interimTranscript);
                        
                        // 更新臨時結果
                        if (currentSide) {
                            addChatBubble(interimTranscript, currentSide, true);
                        }
                    }
                }
            };
        } catch (error) {
            console.error('初始化語音識別時出錯:', error);
        }
    }
}

// 開始錄音
function startRecording(side = null) {
    if (!recognition) {
        initSpeechRecognition();
    }

    console.log('開始錄音，側邊：', side);
    
    try {
        // 如果當前正在錄音，先停止
        if (isRecording) {
            recognition.stop();
            // 添加延遲以確保錄音完全停止
            setTimeout(() => {
                startNewRecording(side);
            }, 200);
        } else {
            startNewRecording(side);
        }
    } catch (error) {
        console.error('開始錄音時出錯:', error);
        isRecording = false;
        currentSide = null;
        updateRecordingUI();
    }
}

// 開始新的錄音
function startNewRecording(side) {
    currentSide = side;
    
    // 設置語言
    if (side) {
        recognition.lang = document.getElementById(side === 'left' ? 'leftLanguage' : 'rightLanguage').value;
    } else {
        recognition.lang = document.getElementById('sourceLanguage').value;
    }
    
    recognition.start();
    updateRecordingUI();
}

// 停止錄音
function stopRecording() {
    console.log('停止錄音');
    if (recognition && isRecording) {
        recognition.stop();
    }
    isRecording = false;
    currentSide = null;
    updateRecordingUI();
}

// 朗讀文字
function speakText(text, lang) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    window.speechSynthesis.speak(utterance);
}

// 更新錄音 UI
function updateRecordingUI() {
    const leftButton = document.getElementById('speakLeft');
    const rightButton = document.getElementById('speakRight');
    const stopButton = document.getElementById('stopConversation');
    
    if (leftButton && rightButton && stopButton) {
        leftButton.disabled = isRecording && currentSide !== 'left';
        rightButton.disabled = isRecording && currentSide !== 'right';
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
function addChatBubble(text, side, isInterim = false) {
    const chatContainer = document.getElementById('chatContainer');
    const bubble = document.createElement('div');
    
    if (isInterim) {
        bubble.className = `interim-text ${side}`;
        bubble.textContent = text;
        
        // 移除之前的臨時文本
        const prevInterim = chatContainer.querySelector('.interim-text');
        if (prevInterim) {
            prevInterim.remove();
        }
    } else {
        bubble.className = `chat-bubble ${side}`;
        const language = side === 'left' ? 
            document.getElementById('leftLanguage').options[document.getElementById('leftLanguage').selectedIndex].text :
            document.getElementById('rightLanguage').options[document.getElementById('rightLanguage').selectedIndex].text;
        
        bubble.innerHTML = `
            <div class="bubble-header">
                <span class="language-tag">${language}</span>
            </div>
            <div class="bubble-content">${text}</div>
        `;
    }
    
    // 將新的氣泡插入到容器的最前面
    if (chatContainer.firstChild) {
        chatContainer.insertBefore(bubble, chatContainer.firstChild);
    } else {
        chatContainer.appendChild(bubble);
    }
    
    // 滾動到頂部
    chatContainer.scrollTop = 0;
}

// 更新語音識別的語言
function updateRecognitionLanguage(side) {
    if (!recognition) return;
    
    let lang;
    if (side === 'left') {
        lang = document.getElementById('leftLanguage').value;
    } else if (side === 'right') {
        lang = document.getElementById('rightLanguage').value;
    } else {
        lang = document.getElementById('sourceLanguage').value;
    }
    
    console.log('設置語音識別語言:', lang);
    recognition.lang = lang;
}

// 交換雙向翻譯的語言
function swapBidirectionalLanguages() {
    const leftLang = document.getElementById('leftLanguage');
    const rightLang = document.getElementById('rightLanguage');
    
    if (leftLang && rightLang) {
        const tempValue = leftLang.value;
        leftLang.value = rightLang.value;
        rightLang.value = tempValue;
    }
}

// 交換單向翻譯的語言
function swapUnidirectionalLanguages() {
    const sourceLang = document.getElementById('sourceLanguage');
    const targetLang = document.getElementById('targetLanguage');
    
    if (sourceLang && targetLang) {
        const tempValue = sourceLang.value;
        sourceLang.value = targetLang.value;
        targetLang.value = tempValue;
    }
}

// 翻譯文本
async function translateText(text, sourceLang, targetLang) {
    try {
        console.log(`發送翻譯請求 - 文本: ${text}, 源語言: ${sourceLang}, 目標語言: ${targetLang}`);
        
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
            const errorData = await response.json().catch(() => null);
            const errorMessage = errorData?.error || '未知錯誤';
            console.error(`翻譯請求失敗: ${response.status} - ${errorMessage}`);
            throw new Error(`翻譯請求失敗 (${response.status}): ${errorMessage}`);
        }
        
        const data = await response.json();
        console.log('翻譯成功:', data);
        
        if (!data.translation) {
            throw new Error('翻譯結果為空');
        }
        
        return data.translation;
    } catch (error) {
        console.error('翻譯錯誤:', error);
        throw error;
    }
}

// 事件監聽器設置
document.addEventListener('DOMContentLoaded', function() {
    // 初始化語音識別
    initSpeechRecognition();
    
    // 雙向翻譯按鈕
    const stopConversationBtn = document.getElementById('stopConversation');
    const speakLeftBtn = document.getElementById('speakLeft');
    const speakRightBtn = document.getElementById('speakRight');
    
    if (stopConversationBtn) {
        stopConversationBtn.addEventListener('click', stopRecording);
    }
    
    if (speakLeftBtn) {
        speakLeftBtn.addEventListener('click', () => startRecording('left'));
    }
    
    if (speakRightBtn) {
        speakRightBtn.addEventListener('click', () => startRecording('right'));
    }

    // 單向翻譯按鈕
    const startSingleBtn = document.getElementById('startRecordingSingle');
    const stopSingleBtn = document.getElementById('stopRecordingSingle');
    
    if (startSingleBtn) {
        startSingleBtn.addEventListener('click', () => startRecording());
    }
    
    if (stopSingleBtn) {
        stopSingleBtn.addEventListener('click', stopRecording);
    }

    // 語言切換按鈕
    const swapBidirectionalBtn = document.getElementById('swapBidirectionalLanguages');
    const swapUnidirectionalBtn = document.getElementById('swapUnidirectionalLanguages');
    
    if (swapBidirectionalBtn) {
        swapBidirectionalBtn.addEventListener('click', swapBidirectionalLanguages);
    }
    
    if (swapUnidirectionalBtn) {
        swapUnidirectionalBtn.addEventListener('click', swapUnidirectionalLanguages);
    }

    // 初始化 UI
    updateRecordingUI();
});
