const ENDING_RULES = { S_SCORE: 160, S_TIME: 600, A_SCORE: 120 };
let ROUTE_CONFIG = [];
let gameData = {};
let currentNodeId = 'Start_01';
let lastMainNodeId = null; 
let studentId = ''; 
let userName = '';
let userSchool = '';
let score = 100;
let pathHistory = []; 
let completedNodes = [];
let gameStartTime = null;
let nodeStartTime = 0;    
let penaltyTime = 0;      
let nodeTimings = {};
let nodePenalties = {}; 
let nodeScoreDeductions = {};
let usedHints = {};
let REVIEW_MODE = false;
let timerInterval = null;
let isTimerRunning = false;
let hintsUsed = 0;
let loadedTime = 0;
const MAX_HINTS = 99;

// ★★★ 萬用彈窗模組 (AppModal) ★★★
// 將原本的三個彈窗功能整合為一，讓 UI 呼叫更乾淨
const AppModal = {
    show: function({ title, msg, isHTML = false, showCancel = false, confirmText = '確定', cancelText = '取消', onConfirm = null, onCancel = null }) {
        const m = document.getElementById('custom-modal');
        document.getElementById('modal-title').innerText = title;
        const msgBox = document.getElementById('modal-msg');
        
        if (isHTML) {
            msgBox.innerHTML = msg;
        } else {
            msgBox.innerHTML = String(msg || '').replace(/\n/g, '<br>');
        }
        
        const btnOk = document.getElementById('modal-btn-confirm');
        const btnCancel = document.getElementById('modal-btn-cancel');
        
        if (confirmText) {
            btnOk.innerText = confirmText;
            btnOk.classList.remove('hidden');
            btnOk.onclick = () => { m.classList.add('hidden'); if(onConfirm) onConfirm(); };
        } else {
            btnOk.classList.add('hidden');
        }
        
        if (showCancel) {
            btnCancel.innerText = cancelText;
            btnCancel.classList.remove('hidden');
            btnCancel.onclick = () => { m.classList.add('hidden'); if(onCancel) onCancel(); };
        } else {
            btnCancel.classList.add('hidden');
        }
        
        m.classList.remove('hidden');
    },
    showAlert: function(title, msg, onConfirm) {
        this.show({ title, msg, onConfirm });
    },
    showConfirm: function(title, msg, onConfirm) {
        this.show({ title, msg, showCancel: true, onConfirm });
    },
    showHTML: function(title, htmlContent) {
        this.show({ title, msg: htmlContent, isHTML: true, showCancel: true, confirmText: null, cancelText: '關閉' });
    }
};

window.onload = function() {
    ScannerModule.init(); 
    
    const timeout = setTimeout(() => {
        if (!gameData.nodes) { 
            document.getElementById('loading').innerHTML = '<p style="color:red;">連線逾時，請檢查網路或重新整理。</p>';
        }
    }, 15000);

    api.getGameData().then(data => {
        clearTimeout(timeout); 
        gameData = data;
        ROUTE_CONFIG = data.routes || []; 
        document.getElementById('loading').classList.add('hidden');
        
        // ★ 更好的辦法：檢查瀏覽器是否記住了這個學員
        const savedStudentId = localStorage.getItem('clinical_eval_student_id');
        if (savedStudentId) {
            document.getElementById('student-id').value = savedStudentId;
            checkLogin(); // 直接觸發背景自動登入
        } else {
            document.getElementById('login-screen').classList.remove('hidden');
        }
    }).catch(error => {
        clearTimeout(timeout);
        document.getElementById('loading').innerHTML = 
            '<div style="color:red; text-align:left; margin:20px;">' +
            '<h3>❌ 系統發生錯誤</h3><p>原因：' + error.message + '</p>' +
            '<p>請截圖並聯絡管理員檢查 Excel 資料庫。</p></div>';
    });
};

function hideAllScreens() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('ending-screen').classList.add('hidden');
    document.getElementById('admin-screen').classList.add('hidden');
}

function checkLogin() {
    const inputId = document.getElementById('student-id').value.trim();
    if(!inputId) { AppModal.showAlert('錯誤', '請輸入員工編號'); return; }
    
    studentId = inputId;
    
    // ★ 將學號存在瀏覽器，防手滑重新整理
    localStorage.setItem('clinical_eval_student_id', studentId);
    
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('login-screen').classList.add('hidden');

    api.checkUserStatus(studentId).then(res => {
        document.getElementById('loading').classList.add('hidden');
        
        if (res.status === 'Invalid') {
            localStorage.removeItem('clinical_eval_student_id'); // 驗證失敗就清空暫存
            AppModal.showAlert('驗證失敗', res.message, () => document.getElementById('login-screen').classList.remove('hidden'));
            return;
        }

        userName = res.name;
        userSchool = res.school;
        document.getElementById('user-info-display').innerText = `${studentId} ${userName}`;
        document.getElementById('school-text').innerText = userSchool;
        document.getElementById('btn-logout').classList.remove('hidden'); // 顯示登出按鈕
        
        score = Number(res.score); if (isNaN(score)) score = 100;
        loadedTime = Number(res.totalTime); if (isNaN(loadedTime)) loadedTime = 0;

        nodePenalties = JSON.parse(res.nodePenalties || '{}');
        penaltyTime = 0;
        for (let key in nodePenalties) penaltyTime += (nodePenalties[key] || 0);

        pathHistory = JSON.parse(res.path || '[]');
        completedNodes = JSON.parse(res.completedNodes || '[]');
        nodeTimings = JSON.parse(res.nodeTimings || '{}');
        usedHints = JSON.parse(res.usedHints || '{}');
        nodeScoreDeductions = JSON.parse(res.nodeScoreDeductions || '{}');

        if (res.status === 'Finished') {
            REVIEW_MODE = true;
            stopTimer();
            gameStartTime = null; 
            
            let endingNodeId = 'End_Rank_B'; 
            if (score >= ENDING_RULES.S_SCORE && loadedTime < ENDING_RULES.S_TIME) endingNodeId = 'End_Rank_S';
            else if (score >= ENDING_RULES.A_SCORE) endingNodeId = 'End_Rank_A';
            else endingNodeId = 'End_Rank_B';

            let node = gameData.nodes.find(n => n.id === endingNodeId);
            if (!node) node = gameData.nodes.find(n => n.id === 'End_Good');
            if (!node) node = { title: '評估結束', description: '恭喜完成。', videoUrl: '' };
            updateDisplay(); 
            renderEndingScreen(node, loadedTime);
        } else {
            REVIEW_MODE = false;
            if (res.startTime) { 
                gameStartTime = new Date(res.startTime);
            } else { 
                gameStartTime = null;
            }

            if (res.status === 'New') {
                renderNode('Start_01');
            } else {
                if (!gameStartTime) { 
                    gameStartTime = new Date();
                    saveCurrentProgress(false);
                }
                updateDisplay();
                startTimer();
                renderLobby();
            }
        }
    }).catch(err => {
        document.getElementById('loading').classList.add('hidden');
        AppModal.showAlert('錯誤', '登入連線失敗：' + err);
    });
}

function renderLobby() {
    hideAllScreens();
    document.getElementById('lobby-screen').classList.remove('hidden');
    ScannerModule.closeScanner(); 

    const container = document.getElementById('task-container');
    const lockMsg = document.getElementById('intro-lock-msg');
    const btnFinal = document.getElementById('btn-final-ending');
    const btnReviewBack = document.getElementById('btn-review-back');
    const btnReviewIntro = document.getElementById('btn-review-intro');
    
    container.innerHTML = '';
    if (REVIEW_MODE) {
         const banner = document.createElement('div');
         banner.style.cssText = 'background:#d4edda; color:#155724; padding:10px; margin-bottom:15px; border-radius:5px; text-align:center; border:1px solid #c3e6cb; font-weight:bold;';
         banner.innerText = '🎓 試卷回顧模式 (僅供瀏覽)';
         container.appendChild(banner);
    }

    const isIntroDone = completedNodes.includes('Start_01');
    if (!isIntroDone && !REVIEW_MODE) {
        container.classList.add('hidden');
        lockMsg.classList.remove('hidden');
        btnFinal.classList.add('hidden');
        btnReviewBack.classList.add('hidden');
        btnReviewIntro.classList.add('hidden');
        return;
    } else {
        container.classList.remove('hidden');
        lockMsg.classList.add('hidden');
        btnReviewIntro.classList.remove('hidden');
    }

    if (REVIEW_MODE) {
        btnFinal.classList.add('hidden');
        btnReviewBack.classList.remove('hidden');
    } else {
        btnReviewBack.classList.add('hidden');
    }

    let totalLevels = 0, totalCompleted = 0;
    ROUTE_CONFIG.forEach((route) => {
        totalLevels += route.nodes.length;
        const completedCount = route.nodes.filter(id => completedNodes.includes(id)).length;
        totalCompleted += completedCount;

        const groupDiv = document.createElement('div');
        groupDiv.className = 'task-group';
        const header = document.createElement('div');
        header.className = 'task-header';
        header.innerHTML = `<span>${route.name} (${completedCount}/${route.nodes.length})</span>`;
        header.onclick = () => groupDiv.classList.toggle('open');
        groupDiv.appendChild(header);

        const list = document.createElement('ul');
        list.className = 'task-list';

        route.nodes.forEach((nodeId, nIdx) => {
            const li = document.createElement('li');
            const nodeName = getQuestionTitle(nodeId);
            const isDone = completedNodes.includes(nodeId);
            const isUnlocked = nIdx === 0 || completedNodes.includes(route.nodes[nIdx-1]);
            
            let infoStr = "";
            if (nodeTimings[nodeId]) infoStr += ` <span class="info-text">(${Math.round(nodeTimings[nodeId])}s)</span>`;
            if (nodePenalties[nodeId]) infoStr += ` <span class="penalty-time">(罰${nodePenalties[nodeId]}s)</span>`;
            if (nodeScoreDeductions[nodeId]) infoStr += ` <span class="deduct-score">(${nodeScoreDeductions[nodeId]}分)</span>`;

            if (isDone) {
                li.className = 'level-item completed';
                li.innerHTML = `<span class="status-icon">✅</span> ${nodeName}${infoStr}`;
                li.onclick = () => {
                    if (REVIEW_MODE) renderNode(nodeId);
                    else AppModal.showAlert('已完成', '本關卡已通過，請繼續挑戰下一關！');
                };
            } else if (isUnlocked && !REVIEW_MODE) {
                li.className = 'level-item active';
                li.innerHTML = `<span class="status-icon">▶️</span> ${nodeName}`;
                li.onclick = () => confirmEnterNode(nodeId, nodeName, false);
            } else {
                li.className = 'level-item locked';
                li.innerHTML = `<span class="status-icon">🔒</span> ${nodeName}`;
            }
            list.appendChild(li);
        });
        groupDiv.appendChild(list);
        container.appendChild(groupDiv);
    });

    if (!REVIEW_MODE && totalCompleted >= totalLevels) btnFinal.classList.remove('hidden');
    else if (!REVIEW_MODE) btnFinal.classList.add('hidden');
}

function calculateAndShowEnding() {
    stopTimer();
    let finalTimeSeconds = 0;
    if (REVIEW_MODE) {
        finalTimeSeconds = loadedTime;
    } else {
        if (gameStartTime) {
            const now = new Date();
            const elapsed = Math.floor((now - gameStartTime) / 1000);
            finalTimeSeconds = elapsed + penaltyTime;
        } else {
            finalTimeSeconds = loadedTime + penaltyTime;
        }
        loadedTime = finalTimeSeconds; 
        gameStartTime = null;
        REVIEW_MODE = true; 
        saveCurrentProgress(true);
    }

    let endingNodeId = 'End_Rank_B';
    if (score >= ENDING_RULES.S_SCORE && finalTimeSeconds < ENDING_RULES.S_TIME) endingNodeId = 'End_Rank_S';
    else if (score >= ENDING_RULES.A_SCORE) endingNodeId = 'End_Rank_A';
    else endingNodeId = 'End_Rank_B';

    let node = gameData.nodes.find(n => n.id === endingNodeId);
    if (!node) node = gameData.nodes.find(n => n.id === 'End_Good');
    if (!node) node = { title: '評估結束', description: '恭喜完成。', videoUrl: '' };
    renderEndingScreen(node, finalTimeSeconds);
}

function renderEndingScreen(node, finalSeconds) {
    hideAllScreens();
    document.getElementById('ending-screen').classList.remove('hidden');
    
    document.getElementById('end-title').innerText = node.title;
    document.getElementById('end-desc').innerHTML = node.description;
    if (node.videoUrl) {
        document.getElementById('end-media-box').classList.remove('hidden');
        updateMedia(node.videoUrl, 'end-media-box');
    } else {
        document.getElementById('end-media-box').classList.add('hidden');
    }

    document.getElementById('res-school').innerText = userSchool;
    document.getElementById('res-name').innerText = `${studentId} ${userName}`;
    document.getElementById('res-score').innerText = score;
    let totalPenaltySeconds = 0;
    for (let key in nodePenalties) totalPenaltySeconds += (nodePenalties[key] || 0);
    
    let totalDeductScore = 0;
    for (let key in nodeScoreDeductions) totalDeductScore += (nodeScoreDeductions[key] || 0);

    let elapsedSeconds = finalSeconds - totalPenaltySeconds;
    if (elapsedSeconds < 0) elapsedSeconds = 0;

    const m = String(Math.floor(finalSeconds / 60)).padStart(2, '0');
    const s = String(finalSeconds % 60).padStart(2, '0');
    document.getElementById('res-time').innerText = `${m}:${s}`;
    
    const em = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
    const es = String(elapsedSeconds % 60).padStart(2, '0');
    
    document.getElementById('res-elapsed').innerText = `${em}:${es}`;
    document.getElementById('res-penalty').innerText = totalPenaltySeconds;
    document.getElementById('res-deduct').innerText = totalDeductScore;

    api.getLeaderboard(studentId).then(data => {
        const tbody = document.getElementById('rank-tbody');
        tbody.innerHTML = '';
        
        const rankBadge = document.getElementById('res-rank-badge');
        if(data.userRank !== '-') {
            rankBadge.innerText = `🏆 您的排名：第 ${data.userRank} 名 / 共 ${data.total} 人`;
            rankBadge.classList.remove('hidden');
        } else {
            rankBadge.classList.add('hidden');
        }

        if (data.top3.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">尚無紀錄</td></tr>';
            return;
        }
        data.top3.forEach((row, idx) => {
            const rankClass = idx === 0 ? 'rank-1' : '';
            const tr = document.createElement('tr');
            tr.innerHTML = `<td class="${rankClass}">#${idx+1}</td>
                            <td class="${rankClass}">${row.name}</td>
                            <td class="${rankClass}">${row.school}</td>
                            <td class="${rankClass}">${row.score}</td>
                            <td>${row.time}</td>`;
            tbody.appendChild(tr);
        });
    }).catch(err => console.error("獲取排行榜失敗", err));
    
    const btnBack = document.querySelector('#ending-screen .btn-primary');
    btnBack.innerText = '📂 返回瀏覽試卷與詳解';
    btnBack.onclick = () => renderLobby();
}

function enterReviewMode() { renderLobby(); }

function renderNode(nodeId) {
    const node = gameData.nodes.find(n => n.id === nodeId);
    if(!node) { AppModal.showAlert('Error', 'Node missing'); return; }

    hideAllScreens();
    document.getElementById('game-screen').classList.remove('hidden');
    ScannerModule.closeScanner(); 

    currentNodeId = nodeId;
    if (nodeId !== 'Start_01' && !nodeId.startsWith('SQ_')) pathHistory.push(nodeId);
    if (!REVIEW_MODE && node.type.toLowerCase() === 'question') {
        nodeStartTime = new Date();
    }

    const btnOpenSQ = document.getElementById('btn-open-sq');
    if (btnOpenSQ) {
        if (nodeId.startsWith('SQ_') || REVIEW_MODE) {
            btnOpenSQ.classList.add('hidden');
        } else if (node.type && node.type.toLowerCase() === 'question') {
            btnOpenSQ.classList.remove('hidden');
        } else {
            btnOpenSQ.classList.add('hidden');
        }
    }

    const banner = document.getElementById('review-banner');
    if (REVIEW_MODE && node.type.toLowerCase() === 'question') {
        banner.classList.remove('hidden');
        const timeSpent = nodeTimings[nodeId] ? Math.round(nodeTimings[nodeId]) + '秒' : '未記錄';
        const pen = nodePenalties[nodeId] ? nodePenalties[nodeId] : 0;
        const deduct = nodeScoreDeductions[nodeId] ? nodeScoreDeductions[nodeId] : 0;
        let scoreText = '0';
        const q = gameData.questions[node.questionId];
        if(q) scoreText = q.scorePlus;
        banner.className = 'review-stats-board';
        banner.innerHTML = `
            <div class="review-stat-row"><span>⏱️ 耗時: ${timeSpent}</span> <span>💯 本題得分: +${scoreText}</span></div>
            ${pen > 0 ? `<div class="review-stat-row" style="color:#e67e22;">💡 提示罰秒: +${pen}s</div>` : ''}
            ${deduct < 0 ? `<div class="review-stat-row" style="color:#dc3545;">⚠️ 答錯扣分: ${deduct}分</div>` : ''}
        `;
    } else {
        banner.classList.add('hidden');
        if (!node.isEnding && !REVIEW_MODE) saveCurrentProgress(false);
    }

    document.getElementById('node-title').innerText = node.title;
    document.getElementById('node-desc').innerHTML = node.description;
    
    const mediaBox = document.getElementById('media-box');
    if(node.videoUrl) {
        mediaBox.classList.remove('hidden');
        updateMedia(node.videoUrl, 'media-box');
    } else {
        mediaBox.classList.add('hidden');
    }

    document.getElementById('hint-area').classList.add('hidden');
    const interactionArea = document.getElementById('interaction-area');
    interactionArea.innerHTML = '';

    const nodeType = node.type.toString().toLowerCase();
    if (nodeType === 'story' || node.isEnding) {
       const btn = document.createElement('button');
       btn.className = 'btn btn-primary';
       
       if (nodeId === 'Start_01') {
           if (REVIEW_MODE) {
               btn.innerText = '返回任務大廳';
               btn.onclick = () => renderLobby();
           } else {
               btn.innerText = '✅ 我已看完，進入任務大廳';
               btn.onclick = () => {
                   if (!gameStartTime) {
                       gameStartTime = new Date();
                       startTimer();
                   }
                   if (!completedNodes.includes('Start_01')) completedNodes.push('Start_01');
                   saveCurrentProgress(false);
                   renderLobby();
               };
           }
       } else if (node.isEnding) {
           btn.innerText = '返回';
           btn.onclick = () => renderLobby();
       } else if (nodeId.startsWith('SQ_') && !node.nextId) {
           if (!completedNodes.includes(currentNodeId)) completedNodes.push(currentNodeId);
           btn.innerText = '✅ 了解，返回主線';
           btn.style.background = '#6f42c1';
           btn.onclick = () => { if (lastMainNodeId) renderNode(lastMainNodeId); else renderLobby(); };
       } else {
           btn.innerText = '下一步';
           btn.onclick = () => renderNode(node.nextId);
       }
       interactionArea.appendChild(btn);
    } else if (nodeType === 'question') {
       const q = gameData.questions[node.questionId];
       if (q && q.id === 'Q_Start') renderLobby(); 
       else renderQuestionButtons(q, node);
    }

    if (nodeId.startsWith('SQ_') && nodeType !== 'story') { 
        const isCompletedSQ = completedNodes.includes(nodeId);
        const backBtn = document.createElement('button');
        backBtn.className = 'btn';
        if (isCompletedSQ) {
            backBtn.style.cssText = 'background: #6f42c1; color: white; border: none; margin-top: 20px; font-weight: bold;';
            backBtn.innerText = '⬅️ 了解，返回主線題目';
        } else {
            backBtn.style.cssText = 'background: #6c757d; color: white; border: none; margin-top: 20px; font-weight: bold;';
            backBtn.innerText = '⬅️ 先不解了，返回主線題目';
        }
        backBtn.onclick = () => { if (lastMainNodeId) renderNode(lastMainNodeId); else renderLobby(); };
        interactionArea.appendChild(backBtn);
    }
}

function checkAnswer(userAns, q, node) {
    let cleanUser = userAns.toString().trim().toLowerCase();
    let cleanCorrect = q.answer.toString().trim().toLowerCase();
    
    let correctMsg = q.feedbackCorrect || '恭喜答對！';
    const wrongMsg = q.feedbackWrong || '答案不正確，請再想一想。';

    if (q.feedbackLink) { 
        correctMsg += `<br><a href="${q.feedbackLink}" target="_blank" style="background:#17a2b8; color:white; text-decoration:none; padding:10px 20px; border-radius:6px; display:block; width:fit-content; margin:15px auto 5px; font-weight:bold; box-shadow:0 2px 5px rgba(0,0,0,0.15);">🔗 點此查看參考資料</a>`; 
    }

    if (cleanUser === cleanCorrect) { 
       if (!completedNodes.includes(currentNodeId)) completedNodes.push(currentNodeId);
       const duration = (new Date() - nodeStartTime) / 1000;
       nodeTimings[currentNodeId] = (nodeTimings[currentNodeId] || 0) + duration;
       
       if (currentNodeId.startsWith('SQ_')) {
           AppModal.showAlert('🎉 錦囊解答正確', correctMsg, () => {
               score += parseInt(q.scorePlus || 0);
               if (node.nextId) { renderNode(node.nextId); } 
               else { if (lastMainNodeId) renderNode(lastMainNodeId); else renderLobby(); }
           });
           return; 
       }

       AppModal.showAlert('🎉 答案正確', correctMsg, () => {
           score += parseInt(q.scorePlus || 0);
           
           let nextNodeId = null;
           const currentRoute = ROUTE_CONFIG.find(r => r.nodes.includes(currentNodeId));
           if (currentRoute) {
               const currentIndex = currentRoute.nodes.indexOf(currentNodeId);
               if (currentIndex < currentRoute.nodes.length - 1) {
                   nextNodeId = currentRoute.nodes[currentIndex + 1];
               }
           }

           if (!nextNodeId && node.nextId) {
               nextNodeId = node.nextId;
           }

           if (nextNodeId) {
               const nextNodeExists = gameData.nodes.find(n => n.id === nextNodeId);
               if (nextNodeExists) {
                   renderNode(nextNodeId);
               } else {
                   AppModal.showAlert('系統錯誤', `找不到下一關的 ID：[${nextNodeId}]\n請檢查 Excel 的 Game_Flow 或 Lobby_Config 是否有打錯字。`);
               }
           } else {
               AppModal.showAlert('任務完成', `恭喜！本路線已完成。`, () => {
                   saveCurrentProgress(false);
                   renderLobby();
               });
           }
       });
    } else {
       const deduct = parseInt(q.scoreMinus || 0);
       let scoreMsg = "";

       if (!nodeScoreDeductions[currentNodeId]) {
           score += deduct;
           nodeScoreDeductions[currentNodeId] = deduct;
           scoreMsg = `(本次扣除 ${Math.abs(deduct)} 分)`;
       } else {
           scoreMsg = `(已扣過分，本次不重複扣分)`;
       }
       
       const duration = (new Date() - nodeStartTime) / 1000;
       nodeTimings[currentNodeId] = (nodeTimings[currentNodeId] || 0) + duration;
       nodeStartTime = new Date(); 

       updateDisplay();
       
       AppModal.showAlert('⚠️ 答案錯誤', `${scoreMsg}\n\n${wrongMsg}`, null);
    }
}

function renderQuestionButtons(q, node) {
     if(!q) return;
     
     let levelHtml = '';
     if (q.level) {
         let levelColor = '#17a2b8'; 
         let levelStr = q.level.trim().toLowerCase();
         if (levelStr === 'easy') levelColor = '#28a745'; 
         else if (levelStr === 'medium') levelColor = '#ffc107'; 
         else if (levelStr === 'hard') levelColor = '#dc3545'; 
         levelHtml = `<span style="background:${levelColor}; color:white; padding:3px 8px; border-radius:12px; font-size:0.8rem; font-weight:bold; margin-bottom:10px; display:inline-block;">難易度：${q.level}</span><br>`;
     }

     document.getElementById('node-desc').innerHTML += `<div style="margin-top:20px; padding:15px; background:#f8fbff; border-left:4px solid var(--primary-color);">${levelHtml}<strong>問題：</strong><br>${q.content}</div>`;
     
     const area = document.getElementById('interaction-area');
     const isCompletedSQ = node.id.startsWith('SQ_') && completedNodes.includes(node.id);

     if (isCompletedSQ && !REVIEW_MODE) {
         const msgBox = document.createElement('div');
         msgBox.style.cssText = 'margin-top:20px; padding:15px; background:#e6ffec; border-left:4px solid #28a745; color:#155724; border-radius:6px; line-height:1.6;';
         let feedback = q.feedbackCorrect || '無特別提示';
         
         if (q.feedbackLink) { 
             feedback += `<br><a href="${q.feedbackLink}" target="_blank" style="background:#17a2b8; color:white; text-decoration:none; padding:10px 20px; border-radius:6px; display:block; width:fit-content; margin:15px auto 5px; font-weight:bold; box-shadow:0 2px 5px rgba(0,0,0,0.15);">🔗 點此查看參考資料</a>`; 
         }
         
         msgBox.innerHTML = `<strong>✅ 此錦囊已解鎖</strong><br><br><span style="color:#666; font-size:0.9rem;">正確答案：${q.answer}</span><hr style="border-top:1px dashed #28a745; margin:10px 0;"><strong>💡 錦囊內容：</strong><br>${feedback}`;
         area.appendChild(msgBox);
         return; 
     }

     const hintArea = document.getElementById('hint-area');
     const hintText = document.getElementById('hint-text');
     const hintBtn = document.getElementById('btn-use-hint');
     
     hintArea.classList.add('hidden');
     hintText.classList.add('hidden');
     hintBtn.classList.add('hidden');
     if (q.hint) {
         hintText.innerText = q.hint;
         if (REVIEW_MODE) {
             hintArea.classList.remove('hidden');
             hintText.classList.remove('hidden');
             hintBtn.classList.add('hidden');
         } else {
             hintArea.classList.remove('hidden');
             if (usedHints[currentNodeId]) {
                 hintText.classList.remove('hidden');
                 hintBtn.classList.add('hidden');
             } else {
                 hintText.classList.add('hidden');
                 hintBtn.classList.remove('hidden');
             }
         }
     }

     if (q.type === 'Scan' && !REVIEW_MODE) {
         const scanBtn = document.createElement('button');
         scanBtn.className = 'btn btn-scan';
         scanBtn.innerHTML = '📷 啟動相機掃描答案';
         scanBtn.onclick = () => {
             AppModal.showConfirm('啟動確認', '準備好要掃描藥品條碼了嗎？', () => {
                 window.currentScanCallback = (decodedText) => checkAnswer(decodedText, q, node);
                 ScannerModule.startLiveScan(window.currentScanCallback);
             });
         };
         area.appendChild(scanBtn);
         return;
     }

     if (q.type === 'Text' || (q.type === 'Scan' && REVIEW_MODE)) {
         const input = document.createElement('input');
         input.type = 'text'; input.id = 'ans-input';
         const btn = document.createElement('button');
         btn.className = 'btn btn-primary'; btn.innerText = '送出';
         if (REVIEW_MODE) {
             input.value = `正確答案：${q.answer}`;
             input.disabled = true;
             input.style.border = "2px solid #28a745";
             input.style.backgroundColor = "#e6ffec";
             input.style.color = "#155724";
             input.style.fontWeight = "bold";
             btn.style.display = 'none';
             const backBtn = document.createElement('button');
             backBtn.className = 'btn btn-primary'; backBtn.innerText = '返回列表';
             backBtn.onclick = () => renderLobby();
             area.appendChild(input); area.appendChild(backBtn);
         } else {
             btn.onclick = () => {
                const userVal = document.getElementById('ans-input').value;
                if(!userVal.trim()) { AppModal.showAlert('提示', '請輸入答案'); return; }
                AppModal.showConfirm('提交確認', `確定要送出答案「${userVal}」嗎？`, () => {
                   checkAnswer(userVal, q, node);
                });
             };
             area.appendChild(input); area.appendChild(btn);
         }
     } else {
         if(q.options) {
             q.options.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'btn'; 
                btn.innerText = opt;
                if (REVIEW_MODE) {
                    btn.classList.add('btn-review-disabled'); 
                    if (opt.trim().toLowerCase() === q.answer.trim().toLowerCase()) {
                        btn.classList.remove('btn-review-disabled');
                        btn.classList.add('btn-review-correct'); 
                    }
                } else {
                    btn.onclick = () => {
                       AppModal.showConfirm('選擇確認', `確定要選擇「${opt}」作為答案嗎？`, () => {
                          checkAnswer(opt, q, node);
                       });
                    };
                }
                area.appendChild(btn);
             });
         }
         if (REVIEW_MODE) {
             const backBtn = document.createElement('button');
             backBtn.className = 'btn btn-primary'; backBtn.style.marginTop = '20px';
             backBtn.innerText = '返回列表';
             backBtn.onclick = () => renderLobby();
             area.appendChild(backBtn);
         }
     }
}

function confirmEnterNode(nodeId, title, isReview) {
     const msg = `準備進入：${title}\n確定開始？`;
     AppModal.showConfirm('確認', msg, () => {
         renderNode(nodeId);
     });
}

function openSideQuestSelector() {
    let sqNodes = gameData.nodes.filter(n => String(n.id).startsWith('SQ_'));
    if(sqNodes.length === 0) { AppModal.showAlert('提示', '目前尚未建立任何錦囊題。'); return; }
    let html = '<div style="margin-top:15px; max-height:60vh; overflow-y:auto; padding-right:5px;">';
    sqNodes.forEach(node => {
        let isDone = completedNodes.includes(node.id);
        let btnClass = isDone ? 'sq-list-btn completed' : 'sq-list-btn';
        html += `<button class="${btnClass}" onclick="enterSideQuest('${node.id}')">${isDone ? '✅' : '🧰'} ${node.title}</button>`;
    });
    AppModal.showHTML('💡 選擇要查閱的錦囊', html + '</div>');
}

function enterSideQuest(sqId) {
    document.getElementById('custom-modal').classList.add('hidden');
    if (!currentNodeId.startsWith('SQ_')) lastMainNodeId = currentNodeId;
    renderNode(sqId);
}

function reviewIntro() { renderNode('Start_01'); }
function getQuestionTitle(nodeId) { const node = gameData.nodes.find(n => n.id === nodeId); return node ? node.title : nodeId; }

function updateDisplay() {
    document.getElementById('score-display').innerText = score;
    let totalSeconds = 0;
    if (REVIEW_MODE) {
         totalSeconds = loadedTime;
    } else {
         if (gameStartTime) {
              const now = new Date();
              totalSeconds = Math.floor((now - gameStartTime) / 1000);
         } else {
              totalSeconds = loadedTime;
         }
         totalSeconds += penaltyTime;
    }

    if (isNaN(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
    const min = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const sec = String(totalSeconds % 60).padStart(2, '0');
    document.getElementById('timer-display').innerText = `${min}:${sec}`;
    return totalSeconds;
}

function saveCurrentProgress(isEnding) {
    if (REVIEW_MODE && !isEnding) return; 
    
    const data = {
      studentId: studentId, currentNode: currentNodeId, score: score,
      totalTime: updateDisplay(), pathHistory: JSON.stringify(pathHistory),
      completedNodes: JSON.stringify(completedNodes), 
      nodeTimings: JSON.stringify(nodeTimings),
      nodePenalties: JSON.stringify(nodePenalties),
      usedHints: JSON.stringify(usedHints),
      nodeScoreDeductions: JSON.stringify(nodeScoreDeductions),
      startTime: gameStartTime ? gameStartTime.toISOString() : '', 
      isEnding: isEnding, historyLog: ''
    };
    
    api.saveProgress(data).then(res => {
        console.log("儲存成功", res);
    }).catch(err => console.error("儲存失敗", err));
}

function startTimer() { 
    if(timerInterval) clearInterval(timerInterval);
    if(REVIEW_MODE) return; 
    timerInterval = setInterval(updateDisplay, 1000); 
    isTimerRunning = true;
}
function stopTimer() {
    if(timerInterval) clearInterval(timerInterval);
    isTimerRunning = false;
}

function updateMedia(url, targetId) {
    const box = document.getElementById(targetId);
    box.innerHTML = ''; if(!url) return;
    const isImage = url.match(/\.(jpeg|jpg|gif|png)$/) != null || url.includes('images');
    if (isImage) { box.innerHTML = `<img src="${url}">`; }
    else if (url.includes('drive.google.com')) { box.innerHTML = `<iframe src="${url.replace('/view', '/preview')}"></iframe>`; }
    else { box.innerHTML = `<iframe src="${url}"></iframe>`; }
}

function useHint() {
    AppModal.showConfirm('使用提示', '確定要使用提示嗎？\n(總成績將增加 20 秒懲罰)', () => {
        penaltyTime += 20; 
        nodePenalties[currentNodeId] = (nodePenalties[currentNodeId] || 0) + 20;
        usedHints[currentNodeId] = true;
        document.getElementById('hint-text').classList.remove('hidden');
        document.getElementById('btn-use-hint').classList.add('hidden');
        updateDisplay();
        saveCurrentProgress(false);
    });
}

// 後台管理
let currentAdminPwd = '';
function openAdminLogin() {
    hideAllScreens();
    document.getElementById('admin-login-modal').classList.remove('hidden');
    document.getElementById('admin-pwd-input').value = '';
    document.getElementById('admin-pwd-input').focus();
}
function closeAdminLogin() { 
    document.getElementById('admin-login-modal').classList.add('hidden'); 
    document.getElementById('login-screen').classList.remove('hidden');
}
function doAdminLogin() {
    const pwd = document.getElementById('admin-pwd-input').value;
    if (!pwd) return;
    document.getElementById('loading').classList.remove('hidden');
    closeAdminLogin();
    
    api.adminGetList(pwd).then(res => {
        document.getElementById('loading').classList.add('hidden');
        if (res.status === 'Success') {
           currentAdminPwd = pwd;
           renderAdminScreen(res.list);
        } else { AppModal.showAlert('錯誤', res.msg); }
    }).catch(err => {
         document.getElementById('loading').classList.add('hidden');
         AppModal.showAlert('錯誤', '後台連線失敗');
    });
}
function renderAdminScreen(list) {
    hideAllScreens();
    document.getElementById('admin-screen').classList.remove('hidden');
    const tbody = document.getElementById('admin-tbody');
    tbody.innerHTML = '';
    list.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${row[0]}</td><td>${row[1]}</td><td>${row[2]}</td><td><button class="btn-del" onclick="delEmployee('${row[0]}')">刪除</button></td>`;
        tbody.appendChild(tr);
    });
}
function addEmployee() {
    const id = document.getElementById('new-id').value.trim();
    const name = document.getElementById('new-name').value.trim();
    const school = document.getElementById('new-school').value.trim();
    if(!id || !name) { AppModal.showAlert('錯誤', '編號與姓名為必填'); return; }
    document.getElementById('loading').classList.remove('hidden');
    
    api.adminAddEmployee(currentAdminPwd, id, name, school).then(res => {
        if(res.status === 'Success') {
           document.getElementById('new-id').value = '';
           document.getElementById('new-name').value = '';
           document.getElementById('new-school').value = '';
           refreshAdminList();
        } else {
           document.getElementById('loading').classList.add('hidden');
           AppModal.showAlert('失敗', res.msg);
        }
    });
}
function delEmployee(id) {
    AppModal.showConfirm('刪除確認', `確定要刪除員工 ${id} 嗎？`, () => {
        document.getElementById('loading').classList.remove('hidden');
        api.adminDeleteEmployee(currentAdminPwd, id).then(res => {
           if(res.status === 'Success') refreshAdminList();
           else { document.getElementById('loading').classList.add('hidden'); AppModal.showAlert('失敗', res.msg); }
        });
    });
}
function refreshAdminList() {
    api.adminGetList(currentAdminPwd).then(res => {
        document.getElementById('loading').classList.add('hidden');
        if(res.status === 'Success') renderAdminScreen(res.list);
    });
}
function logoutAdmin() {
    currentAdminPwd = '';
    document.getElementById('admin-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('btn-admin-entry').classList.remove('hidden');
}

// ==========================================
// ★ 新增：無痛更新與登出功能
// ==========================================

// 1. 背景靜默更新題庫
function syncGameData() {
    const btn = document.getElementById('btn-sync-data');
    const originalText = btn.innerText;
    btn.innerText = '⏳ 更新中...';
    btn.disabled = true;

    api.getGameData().then(data => {
        // 覆蓋記憶體中的題庫與流程
        gameData = data;
        ROUTE_CONFIG = data.routes || [];
        
        btn.innerText = '✅ 更新成功';
        setTimeout(() => {
            btn.innerText = '🔄 更新資料';
            btn.disabled = false;
        }, 2000);

        // 如果當前在遊戲畫面，就用新題庫原地重繪一次 (不影響計時與分數)
        if (!document.getElementById('game-screen').classList.contains('hidden')) {
            renderNode(currentNodeId);
        } else if (!document.getElementById('lobby-screen').classList.contains('hidden')) {
            renderLobby();
        }
    }).catch(error => {
        btn.innerText = '❌ 更新失敗';
        setTimeout(() => {
            btn.innerText = '🔄 更新資料';
            btn.disabled = false;
        }, 2000);
        AppModal.showAlert('錯誤', '更新資料失敗，請檢查網路連線。');
    });
}

// 2. 徹底登出並清除暫存
function logoutUser() {
    AppModal.showConfirm('登出確認', '確定要登出並切換使用者嗎？\n(目前的遊戲進度會自動保存)', () => {
        // 如果正在遊玩，登出前先存檔
        if (!REVIEW_MODE && currentNodeId) {
            saveCurrentProgress(false);
        }
        
        // 停止計時、清空暫存與畫面
        stopTimer();
        localStorage.removeItem('clinical_eval_student_id');
        studentId = '';
        document.getElementById('student-id').value = '';
        document.getElementById('btn-logout').classList.add('hidden');
        document.getElementById('user-info-display').innerText = '';
        document.getElementById('school-text').innerText = '';
        document.getElementById('timer-display').innerText = '00:00';
        document.getElementById('score-display').innerText = '0';
        
        hideAllScreens();
        document.getElementById('login-screen').classList.remove('hidden');
    });
}
