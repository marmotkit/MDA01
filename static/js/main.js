// 語音識別相關變量
let recognition = null;
let isRecording = false;
let currentSide = null;

// 初始化語音識別
function initSpeechRecognition() {
    // 如果已經存在實例，先清理
    if (recognition) {
        recognition.onend = null;
        recognition.onerror = null;
        recognition.onresult = null;
        recognition = null;
    }

    window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new window.SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    
    // 添加錯誤處理
    recognition.onerror = function(event) {
        console.error('語音識別錯誤:', event.error);
        if (event.error === 'network') {
            // 網絡錯誤時，等待後重試
            setTimeout(() => {
                if (isRecording) {
                    try {
                        recognition.start();
                    } catch (e) {
                        console.error('重試啟動失敗:', e);
                        isRecording = false;
                        updateRecordingUI();
                    }
                }
            }, 1000);
        } else {
            isRecording = false;
            updateRecordingUI();
        }
    };
    
    // 添加結束處理
    recognition.onend = function() {
        console.log('語音識別結束');
        if (isRecording) {
            try {
                recognition.start();
            } catch (e) {
                console.error('重新啟動失敗:', e);
                isRecording = false;
                updateRecordingUI();
            }
        }
    };
    
    // 語音識別結果處理
    recognition.onresult = async function(event) {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript = transcript;
            } else {
                interimTranscript = transcript;
            }
        }
        
        if (interimTranscript !== '') {
            if (currentSide) {
                addChatBubble(interimTranscript, currentSide, true);
            } else {
                document.getElementById('inputText').value = interimTranscript;
            }
        }
        
        if (finalTranscript !== '') {
            if (currentSide) {
                // 雙向對話模式
                const sourceLang = currentSide === 'left' ? 
                    document.getElementById('leftLanguage').value :
                    document.getElementById('rightLanguage').value;
                const targetLang = currentSide === 'left' ? 
                    document.getElementById('rightLanguage').value :
                    document.getElementById('leftLanguage').value;
                
                addChatBubble(finalTranscript, currentSide);
                
                const translation = await translateText(finalTranscript, sourceLang, targetLang);
                addChatBubble(translation, currentSide === 'left' ? 'right' : 'left');
                speakText(translation, targetLang);
            } else {
                // 單向翻譯模式
                document.getElementById('inputText').value = finalTranscript;
                // 自動進行翻譯
                const sourceLang = document.getElementById('sourceLanguage').value;
                const targetLang = document.getElementById('targetLanguage').value;
                const translation = await translateText(finalTranscript, sourceLang, targetLang);
                document.getElementById('translationResult').textContent = translation;
                speakText(translation, targetLang);
            }
        }
    };
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
async function stopRecording() {
    console.log('停止錄音');
    if (recognition) {
        try {
            isRecording = false;
            currentSide = null;
            updateRecordingUI();
            recognition.stop();
            // 清理實例
            recognition.onend = null;
            recognition.onerror = null;
            recognition.onresult = null;
            recognition = null;
            await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
            console.error('停止錄音時出錯:', error);
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

// 更新錄音 UI
function updateRecordingUI() {
    const leftButton = document.getElementById('speakLeft');
    const rightButton = document.getElementById('speakRight');
    const recordButton = document.getElementById('startRecording');
    
    // 重置所有按鈕狀態
    leftButton.classList.remove('recording');
    rightButton.classList.remove('recording');
    recordButton.classList.remove('recording');
    
    // 更新錄音狀態顯示
    if (isRecording) {
        if (currentSide === 'left') {
            document.getElementById('leftStatus').style.display = 'inline-block';
            document.getElementById('rightStatus').style.display = 'none';
            leftButton.classList.add('recording');
        } else if (currentSide === 'right') {
            document.getElementById('leftStatus').style.display = 'none';
            document.getElementById('rightStatus').style.display = 'inline-block';
            rightButton.classList.add('recording');
        } else {
            document.getElementById('recordingStatus').style.display = 'inline-block';
            recordButton.classList.add('recording');
            document.getElementById('startRecording').disabled = true;
            document.getElementById('stopRecording').disabled = false;
        }
    } else {
        // 停止錄音時隱藏所有狀態指示
        document.getElementById('leftStatus').style.display = 'none';
        document.getElementById('rightStatus').style.display = 'none';
        document.getElementById('recordingStatus').style.display = 'none';
        if (!currentSide) {
            document.getElementById('startRecording').disabled = false;
            document.getElementById('stopRecording').disabled = true;
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
        return data.translation;
    } catch (error) {
        console.error('翻譯錯誤:', error);
        return '翻譯錯誤，請稍後再試';
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
    
    // 按鈕事件監聽器
    document.getElementById('speakLeft').addEventListener('click', () => startRecording('left'));
    document.getElementById('speakRight').addEventListener('click', () => startRecording('right'));
    document.getElementById('stopConversation').addEventListener('click', stopRecording);
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
