// 語音識別相關變量
let recognition = null;
let isRecording = false;
let currentSide = null;

// 初始化語音識別
function initSpeechRecognition() {
    if (!recognition) {
        try {
            recognition = new webkitSpeechRecognition();
            recognition.continuous = true;
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
                                    currentSide === 'left' ? 'leftLanguage' : 'rightLanguage',
                                    currentSide === 'left' ? 'rightLanguage' : 'leftLanguage'
                                );
                                
                                // 添加翻譯結果到聊天
                                addChatBubble(translatedText, currentSide === 'left' ? 'right' : 'left');
                                
                                // 如果不是靜音模式，播放翻譯
                                if (!document.getElementById('muteModeBidirectional').checked) {
                                    playText(translatedText, currentSide === 'left' ? 'rightLanguage' : 'leftLanguage');
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
        // 如果是雙向翻譯模式
        if (side) {
            // 如果當前正在錄音，先停止
            if (isRecording) {
                recognition.stop();
            }
            
            // 設置新的錄音側邊
            currentSide = side;
            
            // 設置語言
            recognition.lang = side === 'left' ? 
                document.getElementById('leftLanguage').value : 
                document.getElementById('rightLanguage').value;
                
            // 開始新的錄音
            setTimeout(() => {
                recognition.start();
                updateRecordingUI();
            }, 100);
        } else {
            // 單向翻譯模式
            recognition.lang = document.getElementById('sourceLanguage').value;
            recognition.start();
        }
    } catch (error) {
        console.error('開始錄音時出錯:', error);
        isRecording = false;
        currentSide = null;
        updateRecordingUI();
    }
}

// 停止錄音
function stopRecording() {
    console.log('停止錄音');
    if (recognition) {
        recognition.stop();
    }
    isRecording = false;
    currentSide = null;
    updateRecordingUI();
}

// 更新錄音 UI
function updateRecordingUI() {
    const leftButton = document.getElementById('speakLeft');
    const rightButton = document.getElementById('speakRight');
    const stopButton = document.getElementById('stopConversation');
    
    // 雙向翻譯按鈕
    if (leftButton && rightButton && stopButton) {
        if (!isRecording) {
            leftButton.disabled = false;
            rightButton.disabled = false;
            stopButton.disabled = true;
            leftButton.classList.remove('btn-secondary');
            rightButton.classList.remove('btn-secondary');
            leftButton.classList.add('btn-primary');
            rightButton.classList.add('btn-primary');
        } else {
            stopButton.disabled = false;
            
            if (currentSide === 'left') {
                leftButton.classList.remove('btn-primary');
                leftButton.classList.add('btn-secondary');
                rightButton.classList.add('btn-primary');
                rightButton.classList.remove('btn-secondary');
            } else {
                rightButton.classList.remove('btn-primary');
                rightButton.classList.add('btn-secondary');
                leftButton.classList.add('btn-primary');
                leftButton.classList.remove('btn-secondary');
            }
        }
    }

    // 單向翻譯按鈕
    const startSingleButton = document.getElementById('startRecordingSingle');
    const stopSingleButton = document.getElementById('stopRecordingSingle');
    
    if (startSingleButton && stopSingleButton) {
        if (!isRecording) {
            startSingleButton.disabled = false;
            stopSingleButton.disabled = true;
        } else {
            startSingleButton.disabled = true;
            stopSingleButton.disabled = false;
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

// 互換語言
function swapLanguages() {
    const leftLang = document.getElementById('leftLanguage');
    const rightLang = document.getElementById('rightLanguage');
    
    // 保存當前選中的文本
    const leftText = leftLang.options[leftLang.selectedIndex].text;
    const rightText = rightLang.options[rightLang.selectedIndex].text;
    const leftValue = leftLang.value;
    const rightValue = rightLang.value;
    
    // 交換值和文本
    leftLang.value = rightValue;
    rightLang.value = leftValue;
    
    // 更新顯示的文本
    Array.from(leftLang.options).forEach(option => {
        if (option.value === rightValue) {
            option.selected = true;
        }
    });
    
    Array.from(rightLang.options).forEach(option => {
        if (option.value === leftValue) {
            option.selected = true;
        }
    });
}

// 互換翻譯語言
function swapTranslationLanguages() {
    const sourceLang = document.getElementById('sourceLanguage');
    const targetLang = document.getElementById('targetLanguage');
    
    // 保存當前選中的值
    const sourceValue = sourceLang.value;
    const targetValue = targetLang.value;
    
    // 如果來源語言是自動檢測，則不進行交換
    if (sourceValue === 'auto') {
        return;
    }
    
    // 交換值
    sourceLang.value = targetValue;
    targetLang.value = sourceValue;
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

// 文本轉語音
function speakText(text, lang, forceMute = false) {
    const muteBidirectional = document.getElementById('muteModeBidirectional').checked;
    const muteUnidirectional = document.getElementById('muteModeUnidirectional').checked;
    
    // 如果強制靜音或對應的靜音模式被啟用，則不播放聲音
    if (forceMute || (currentSide !== null && muteBidirectional) || (currentSide === null && muteUnidirectional)) {
        return;
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    speechSynthesis.speak(utterance);
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
        speakLeftBtn.addEventListener('click', () => {
            if (currentSide === 'left') {
                stopRecording();
            } else {
                startRecording('left');
            }
        });
    }
    
    if (speakRightBtn) {
        speakRightBtn.addEventListener('click', () => {
            if (currentSide === 'right') {
                stopRecording();
            } else {
                startRecording('right');
            }
        });
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
    
    // 按鈕事件監聽器
    document.getElementById('startRecording').addEventListener('click', () => startRecording());
    document.getElementById('stopRecording').addEventListener('click', stopRecording);
    
    // 語言互換按鈕事件
    document.getElementById('swapLanguages').addEventListener('click', swapLanguages);
    document.getElementById('swapTranslationLanguages').addEventListener('click', swapTranslationLanguages);
    
    // 靜音模式切換事件
    document.getElementById('muteModeBidirectional').addEventListener('change', function() {
        const icon = this.nextElementSibling.querySelector('i');
        if (this.checked) {
            icon.classList.remove('fa-volume-up');
            icon.classList.add('fa-volume-mute');
        } else {
            icon.classList.remove('fa-volume-mute');
            icon.classList.add('fa-volume-up');
        }
    });
    
    document.getElementById('muteModeUnidirectional').addEventListener('change', function() {
        const icon = this.nextElementSibling.querySelector('i');
        if (this.checked) {
            icon.classList.remove('fa-volume-up');
            icon.classList.add('fa-volume-mute');
        } else {
            icon.classList.remove('fa-volume-mute');
            icon.classList.add('fa-volume-up');
        }
    });
    
    // 其他按鈕事件
    document.getElementById('clearChat').addEventListener('click', function() {
        document.getElementById('chatContainer').innerHTML = '';
    });
    
    document.getElementById('translate').addEventListener('click', async function() {
        const text = document.getElementById('inputText').value;
        const sourceLang = document.getElementById('sourceLanguage').value;
        const targetLang = document.getElementById('targetLanguage').value;
        
        if (text.trim() !== '') {
            const translation = await translateText(text, sourceLang, targetLang);
            document.getElementById('translationResult').textContent = translation;
            speakText(translation, targetLang);
        }
    });
    
    document.getElementById('clearInput').addEventListener('click', function() {
        document.getElementById('inputText').value = '';
        document.getElementById('translationResult').textContent = '';
    });
    
    document.getElementById('speakButton').addEventListener('click', function() {
        const text = document.getElementById('translationResult').textContent;
        const targetLang = document.getElementById('targetLanguage').value;
        if (text.trim() !== '') {
            speakText(text, targetLang);
        }
    });
    
    // 語言選擇變更事件
    document.getElementById('leftLanguage').addEventListener('change', function() {
        if (currentSide === 'left') {
            updateRecognitionLanguage('left');
        }
    });
    
    document.getElementById('rightLanguage').addEventListener('change', function() {
        if (currentSide === 'right') {
            updateRecognitionLanguage('right');
        }
    });
    
    document.getElementById('sourceLanguage').addEventListener('change', function() {
        if (!currentSide) {
            updateRecognitionLanguage();
        }
    });
});
