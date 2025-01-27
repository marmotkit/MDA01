// 語音識別相關變量
let recognition = null;
let isRecording = false;
let currentSide = null;

// 初始化語音識別
function initSpeechRecognition() {
    try {
        if (!('webkitSpeechRecognition' in window)) {
            throw new Error('您的瀏覽器不支持語音識別功能');
        }

        recognition = new webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => {
            console.log('語音識別已啟動');
            isRecording = true;
            updateRecordingUI();
        };

        recognition.onend = () => {
            console.log('語音識別已停止');
            isRecording = false;
            updateRecordingUI();
            
            // 如果仍在錄音狀態，則自動重新啟動
            if (currentSide) {
                console.log('重新啟動語音識別');
                recognition.start();
            }
        };

        recognition.onerror = (event) => {
            console.error('語音識別錯誤:', event.error);
            let errorMessage = '語音識別出錯';
            
            switch (event.error) {
                case 'network':
                    errorMessage = '網絡連接出錯，請檢查您的網絡';
                    break;
                case 'not-allowed':
                    errorMessage = '請允許使用麥克風';
                    break;
                case 'no-speech':
                    errorMessage = '未檢測到語音';
                    break;
                case 'aborted':
                    errorMessage = '語音識別被中斷';
                    break;
            }
            
            addChatBubble(errorMessage, currentSide);
        };

        recognition.onresult = async (event) => {
            try {
                const result = event.results[event.results.length - 1];
                const transcript = result[0].transcript;
                
                if (result.isFinal) {
                    console.log('最終識別結果:', transcript);
                    addChatBubble(transcript, currentSide);
                    
                    // 獲取源語言和目標語言
                    const sourceLang = currentSide === 'left' ? 
                        document.getElementById('leftLanguage').value :
                        document.getElementById('rightLanguage').value;
                    
                    const targetLang = currentSide === 'left' ? 
                        document.getElementById('rightLanguage').value :
                        document.getElementById('leftLanguage').value;
                    
                    try {
                        const translation = await translateText(transcript, sourceLang, targetLang);
                        addChatBubble(translation, currentSide === 'left' ? 'right' : 'left');
                        
                        // 朗讀翻譯結果
                        speakText(translation, targetLang);
                    } catch (error) {
                        console.error('翻譯過程錯誤:', error);
                        addChatBubble(`翻譯錯誤: ${error.message}`, currentSide === 'left' ? 'right' : 'left');
                    }
                } else {
                    // 顯示臨時結果
                    addChatBubble(transcript, currentSide, true);
                }
            } catch (error) {
                console.error('處理語音識別結果時出錯:', error);
                addChatBubble('處理語音識別結果時出錯', currentSide);
            }
        };

    } catch (error) {
        console.error('初始化語音識別時出錯:', error);
        alert(error.message);
    }
}

// 開始錄音
async function startRecording(side = null) {
    try {
        console.log('開始錄音, side:', side);
        
        // 如果已經在錄音，先停止當前錄音
        if (isRecording) {
            console.log('停止當前錄音');
            await stopRecording();
            // 等待一小段時間確保完全停止
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        currentSide = side;
        initSpeechRecognition();
        updateRecognitionLanguage(side);
        
        console.log('啟動語音識別');
        await recognition.start();
        isRecording = true;
        updateRecordingUI();
        console.log('錄音開始成功');
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

// 更新錄音 UI
function updateRecordingUI() {
    const leftButton = document.getElementById('startLeftRecording');
    const rightButton = document.getElementById('startRightRecording');
    const stopButton = document.getElementById('stopConversation');
    
    if (!isRecording) {
        leftButton.disabled = false;
        rightButton.disabled = false;
        stopButton.disabled = true;
        leftButton.classList.remove('btn-secondary');
        rightButton.classList.remove('btn-secondary');
        leftButton.classList.add('btn-primary');
        rightButton.classList.add('btn-primary');
    } else {
        leftButton.disabled = currentSide !== 'left';
        rightButton.disabled = currentSide !== 'right';
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
    
    // 停止對話按鈕
    document.getElementById('stopConversation').addEventListener('click', function() {
        stopRecording();
    });
    
    // 左側發言按鈕
    document.getElementById('startLeftRecording').addEventListener('click', function() {
        startRecording('left');
    });
    
    // 右側發言按鈕
    document.getElementById('startRightRecording').addEventListener('click', function() {
        startRecording('right');
    });

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
