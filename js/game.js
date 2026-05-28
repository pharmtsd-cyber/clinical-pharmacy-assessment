
      const ENDING_RULES = { S_SCORE: 160, S_TIME: 600, A_SCORE: 120 };
 let ROUTE_CONFIG = [];
      let gameData = {};
      let currentNodeId = 'Start_01';
      let lastMainNodeId = null; // ★ 記錄錦囊切換
      let studentId = ''; userName = '';
 userSchool = '';
      let score = 100;
      let pathHistory = []; completedNodes = [];
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
 let html5QrCode = null;
      let isScanProcessing = false; 
      let isScannerRunning = false; 
      let loadedTime = 0;
      const MAX_HINTS = 99;
 window.onload = function() {
        const timeout = setTimeout(() => {
            if (!gameData.nodes) { 
                document.getElementById('loading').innerHTML = 
                    '<p style="color:red;">連線逾時，請檢查網路或重新整理。</p>';
            }
        }, 15000);
api.getGameData().then(data => {
        clearTimeout(timeout); 
        gameData = data;
        ROUTE_CONFIG = data.routes || []; 
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('login-screen').classList.remove('hidden');
    }).catch(error => {
          clearTimeout(timeout);
    
       document.getElementById('loading').innerHTML = 
              '<div style="color:red; text-align:left; margin:20px;">' +
              '<h3>❌ 系統發生錯誤</h3>' +
              '<p>原因：' + error.message + '</p>' +
              '<p>請截圖並聯絡管理員檢查 Excel 資料庫。</p>' +
              '</div>';
        
 })
        .getGameData();
      };
 // ★★★ 萬用清場函式：確保不會有兩個畫面重疊 ★★★
      function hideAllScreens() {
          document.getElementById('login-screen').classList.add('hidden');
 document.getElementById('lobby-screen').classList.add('hidden');
          document.getElementById('game-screen').classList.add('hidden');
          document.getElementById('ending-screen').classList.add('hidden');
          document.getElementById('admin-screen').classList.add('hidden');
      }

function checkLogin() {
        const inputId = document.getElementById('student-id').value.trim();
        if(!inputId) { showAlert('錯誤', '請輸入員工編號'); return; }
        
        studentId = inputId;
        document.getElementById('loading').classList.remove('hidden');
        document.getElementById('login-screen').classList.add('hidden');

        // ★ 這裡改為呼叫 api.js
        api.checkUserStatus(studentId).then(res => {
          document.getElementById('loading').classList.add('hidden');
          
          if (res.status === 'Invalid') {
            showAlert('驗證失敗', res.message, () => document.getElementById('login-screen').classList.remove('hidden'));
            return;
          }

          userName = res.name;
          userSchool = res.school;
          document.getElementById('user-info-display').innerText = `${studentId} ${userName}`;
          document.getElementById('user-school-display').innerText = userSchool;
          
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

          // ★★★ 核心分流：已完成 vs 未完成 ★★★
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
            showAlert('錯誤', '登入連線失敗：' + err);
        });
      }

      function renderLobby() {
        hideAllScreens();
 // ★ 清場
        document.getElementById('lobby-screen').classList.remove('hidden');
        closeScanner(); 

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
             const isUnlocked = nIdx === 0 ||
 completedNodes.includes(route.nodes[nIdx-1]);
             
             let infoStr = "";
             if (nodeTimings[nodeId]) infoStr += ` <span class="info-text">(${Math.round(nodeTimings[nodeId])}s)</span>`;
             if (nodePenalties[nodeId]) infoStr += ` <span class="penalty-time">(罰${nodePenalties[nodeId]}s)</span>`;
 if (nodeScoreDeductions[nodeId]) infoStr += ` <span class="deduct-score">(${nodeScoreDeductions[nodeId]}分)</span>`;

             if (isDone) {
               li.className = 'level-item completed';
 li.innerHTML = `<span class="status-icon">✅</span> ${nodeName}${infoStr}`;
               li.onclick = () => {
                   if (REVIEW_MODE) renderNode(nodeId);
 else showAlert('已完成', '本關卡已通過，請繼續挑戰下一關！');
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
 // ★ 清場
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

      function enterReviewMode() { renderLobby();
 }

      function renderNode(nodeId) {
        const node = gameData.nodes.find(n => n.id === nodeId);
 if(!node) { showAlert('Error', 'Node missing'); return; }

        hideAllScreens();
 // ★ 清場
        document.getElementById('game-screen').classList.remove('hidden');
        closeScanner(); 

        currentNodeId = nodeId;
        if (nodeId !== 'Start_01' && !nodeId.startsWith('SQ_')) pathHistory.push(nodeId);
 if (!REVIEW_MODE && node.type.toLowerCase() === 'question') {
            nodeStartTime = new Date();
 }

        // ★ 錦囊按鈕顯示隱藏
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
                ${pen > 0 ?
 `<div class="review-stat-row" style="color:#e67e22;">💡 提示罰秒: +${pen}s</div>` : ''}
                ${deduct < 0 ?
 `<div class="review-stat-row" style="color:#dc3545;">⚠️ 答錯扣分: ${deduct}分</div>` : ''}
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
               // 錦囊故事題返回
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

        // ★ 錦囊測驗題返回按鈕
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

        // ★ 修改這裡：移除 class="btn"，並加入 width: fit-content 與 margin: 15px auto 來完美置中
        if (q.feedbackLink) { 
            correctMsg += `<br><a href="${q.feedbackLink}" target="_blank" style="background:#17a2b8; color:white; text-decoration:none; padding:10px 20px; border-radius:6px; display:block; width:fit-content; margin:15px auto 5px; font-weight:bold; box-shadow:0 2px 5px rgba(0,0,0,0.15);">🔗 點此查看參考資料</a>`; 
        }

        if (cleanUser === cleanCorrect) { 
           if (!completedNodes.includes(currentNodeId)) completedNodes.push(currentNodeId);
           const duration = (new Date() - nodeStartTime) / 1000;
           nodeTimings[currentNodeId] = (nodeTimings[currentNodeId] || 0) + duration;
           
           // ★ 錦囊題答對處理
           if (currentNodeId.startsWith('SQ_')) {
               showAlert('🎉 錦囊解答正確', correctMsg, () => {
                   score += parseInt(q.scorePlus || 0);
                   if (node.nextId) { renderNode(node.nextId); } 
                   else { if (lastMainNodeId) renderNode(lastMainNodeId); else renderLobby(); }
               });
               return; 
           }

           showAlert('🎉 答案正確', correctMsg, () => {
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
                       showAlert('系統錯誤', `找不到下一關的 ID：[${nextNodeId}]\n請檢查 Excel 的 Game_Flow 或 Lobby_Config 是否有打錯字。`);
                   }
               } else {
                   showAlert('任務完成', `恭喜！本路線已完成。`, () => {
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
           
           showAlert('⚠️ 答案錯誤', `${scoreMsg}\n\n${wrongMsg}`, null);
           isScanProcessing = false;
        }
      }

function renderQuestionButtons(q, node) {
         if(!q) return;
         
         // ★ 難易度標示區塊 (保持您原本的邏輯)
         let levelHtml = '';
         if (q.level) {
             let levelColor = '#17a2b8'; // 預設藍色
             let levelStr = q.level.trim().toLowerCase();
             if (levelStr === 'easy') levelColor = '#28a745'; // 綠
             else if (levelStr === 'medium') levelColor = '#ffc107'; // 黃
             else if (levelStr === 'hard') levelColor = '#dc3545'; // 紅
             levelHtml = `<span style="background:${levelColor}; color:white; padding:3px 8px; border-radius:12px; font-size:0.8rem; font-weight:bold; margin-bottom:10px; display:inline-block;">難易度：${q.level}</span><br>`;
         }

         document.getElementById('node-desc').innerHTML += `<div style="margin-top:20px; padding:15px; background:#f8fbff; border-left:4px solid var(--primary-color);">${levelHtml}<strong>問題：</strong><br>${q.content}</div>`;
         
         const area = document.getElementById('interaction-area');
         const isCompletedSQ = node.id.startsWith('SQ_') && completedNodes.includes(node.id);

         // ★ 已完成的錦囊題直接顯示「答對的回饋」 (保持您原本的邏輯)
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

         // ★ 提示區域處理 (保持您原本的邏輯)
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

         // ★ 掃描題 (新增確認彈窗)
         if (q.type === 'Scan' && !REVIEW_MODE) {
             const scanBtn = document.createElement('button');
             scanBtn.className = 'btn btn-scan';
             scanBtn.innerHTML = '📷 啟動相機掃描答案';
scanBtn.onclick = () => {
    showConfirm('啟動確認', '準備好要掃描藥品條碼了嗎？', () => {
        window.currentScanCallback = (decodedText) => checkAnswer(decodedText, q, node);
        ScannerModule.startLiveScan(window.currentScanCallback);
    });
};
             area.appendChild(scanBtn);
             return;
         }

         // ★ 文字輸入題 (新增確認彈窗)
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
                    if(!userVal.trim()) { showAlert('提示', '請輸入答案'); return; }
                    showConfirm('提交確認', `確定要送出答案「${userVal}」嗎？`, () => {
                       checkAnswer(userVal, q, node);
                    });
                 };
                 area.appendChild(input); area.appendChild(btn);
             }
         } else {
             // ★ 選擇題 (新增確認彈窗)
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
                        // 重點：在此加入確認彈窗，確認後才跑您原本的 checkAnswer
                        btn.onclick = () => {
                           showConfirm('選擇確認', `確定要選擇「${opt}」作為答案嗎？`, () => {
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

      function startScanner(q, node) {
          if (isScannerRunning) return;
 document.getElementById('scanner-wrapper').classList.remove('hidden');
          isScanProcessing = false; 

          const onScanSuccess = (decodedText, decodedResult) => {
              if (isScanProcessing) return;
 isScanProcessing = true; 

              console.log(`Scan result: ${decodedText}`);
              
              closeScanner().then(() => {
                  checkAnswer(decodedText, q, node);
              });
 };

          if (!html5QrCode) {
              html5QrCode = new Html5Qrcode("reader");
 }
          
          html5QrCode.start(
              { facingMode: "environment" }, 
              { fps: 10, qrbox: { width: 250, height: 250 } },
              onScanSuccess,
              (err) => {}
        
  ).then(() => {
              isScannerRunning = true; 
          }).catch(err => {
              isScannerRunning = false;
              document.getElementById('scanner-wrapper').classList.add('hidden');
              showAlert("相機錯誤", "無法啟動相機，請確認瀏覽器權限。\n" + err);
          });
 }

      function closeScanner() {
          return new Promise((resolve) => {
              if (html5QrCode && isScannerRunning) {
                  html5QrCode.stop().then(() => {
                      isScannerRunning = false;
                
       document.getElementById('scanner-wrapper').classList.add('hidden');
                      resolve();
                  }).catch(err => {
                      isScannerRunning = false; 
                      document.getElementById('scanner-wrapper').classList.add('hidden');
     
                  resolve();
                  });
              } else {
                  document.getElementById('scanner-wrapper').classList.add('hidden');
                  resolve();
             
  }
          });
 }

      function confirmEnterNode(nodeId, title, isReview) {
         const msg = `準備進入：${title}\n確定開始？`;
 showConfirm('確認', msg, () => {
             renderNode(nodeId);
         });
 }

      // ★ 錦囊相關功能呼叫
      function openSideQuestSelector() {
        let sqNodes = gameData.nodes.filter(n => String(n.id).startsWith('SQ_'));
        if(sqNodes.length === 0) { showAlert('提示', '目前尚未建立任何錦囊題。'); return; }
        let html = '<div style="margin-top:15px; max-height:60vh; overflow-y:auto; padding-right:5px;">';
        sqNodes.forEach(node => {
            let isDone = completedNodes.includes(node.id);
            let btnClass = isDone ? 'sq-list-btn completed' : 'sq-list-btn';
            html += `<button class="${btnClass}" onclick="enterSideQuest('${node.id}')">${isDone ? '✅' : '🧰'} ${node.title}</button>`;
        });
        showHTMLModal('💡 選擇要查閱的錦囊', html + '</div>');
      }

      function enterSideQuest(sqId) {
        document.getElementById('custom-modal').classList.add('hidden');
        if (!currentNodeId.startsWith('SQ_')) lastMainNodeId = currentNodeId;
        renderNode(sqId);
      }

      function reviewIntro() { renderNode('Start_01');
 }
      function getQuestionTitle(nodeId) { const node = gameData.nodes.find(n => n.id === nodeId); return node ?
 node.title : nodeId; }
      
      function updateDisplay() {
        document.getElementById('score-display').innerText = score;
 let totalSeconds = 0;
        if (REVIEW_MODE) {
             totalSeconds = loadedTime;
 // 回顧模式只回傳固定值
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
 // 回顧模式下，如果不適 ending 就不要存
        
        const data = {
          studentId: studentId, currentNode: currentNodeId, score: score,
          totalTime: updateDisplay(), pathHistory: JSON.stringify(pathHistory),
          completedNodes: JSON.stringify(completedNodes), 
          nodeTimings: JSON.stringify(nodeTimings),
          nodePenalties: JSON.stringify(nodePenalties),
          usedHints: JSON.stringify(usedHints),
     
      nodeScoreDeductions: JSON.stringify(nodeScoreDeductions),
          startTime: gameStartTime ?
 gameStartTime.toISOString() : '', 
          isEnding: isEnding, historyLog: ''
        };
 google.script.run.saveProgress(data);
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
        if (isImage) { box.innerHTML = `<img src="${url}">`;
 }
        else if (url.includes('drive.google.com')) { box.innerHTML = `<iframe src="${url.replace('/view', '/preview')}"></iframe>`;
 }
        else { box.innerHTML = `<iframe src="${url}"></iframe>`;
 }
      }

      function useHint() {
        showConfirm('使用提示', '確定要使用提示嗎？\n(總成績將增加 20 秒懲罰)', () => {
            penaltyTime += 20; 
            nodePenalties[currentNodeId] = (nodePenalties[currentNodeId] || 0) + 20;
            usedHints[currentNodeId] = true;
            document.getElementById('hint-text').classList.remove('hidden');
            document.getElementById('btn-use-hint').classList.add('hidden');
 
           updateDisplay();
            saveCurrentProgress(false);
        });
 }

      // ★ 改寫：讓系統彈窗支援 HTML，以顯示連結按鈕
      function showAlert(title, msg, callback) {
        const m = document.getElementById('custom-modal');
        document.getElementById('modal-title').innerText = title;
        document.getElementById('modal-msg').innerHTML = String(msg || '').replace(/\n/g, '<br>');
        const btnOk = document.getElementById('modal-btn-confirm');
        const btnCancel = document.getElementById('modal-btn-cancel');
        btnOk.onclick = () => { m.classList.add('hidden'); if(callback) callback(); };
        btnOk.classList.remove('hidden'); // ★ 確保確定按鈕有被重新顯示
        btnCancel.classList.add('hidden'); 
        m.classList.remove('hidden');
      }

      // ★ 新增：支援錦囊介面跳出視窗
      function showHTMLModal(title, htmlContent) {
        const m = document.getElementById('custom-modal');
        document.getElementById('modal-title').innerText = title;
        document.getElementById('modal-msg').innerHTML = htmlContent;
        const btnOk = document.getElementById('modal-btn-confirm');
        const btnCancel = document.getElementById('modal-btn-cancel');
        btnOk.classList.add('hidden'); 
        btnCancel.innerText = '關閉'; btnCancel.onclick = () => { m.classList.add('hidden'); };
        btnCancel.classList.remove('hidden'); m.classList.remove('hidden');
      }

      function showConfirm(title, msg, onYes) {
        const m = document.getElementById('custom-modal');
        document.getElementById('modal-title').innerText = title;
        document.getElementById('modal-msg').innerText = msg;
        const btnOk = document.getElementById('modal-btn-confirm');
        const btnCancel = document.getElementById('modal-btn-cancel');
        btnOk.onclick = () => { m.classList.add('hidden'); if(onYes) onYes(); };
        btnCancel.onclick = () => m.classList.add('hidden');
        btnOk.classList.remove('hidden'); // ★ 確保確定按鈕有被重新顯示
        btnCancel.classList.remove('hidden'); 
        m.classList.remove('hidden');
      }

      // 後台管理
      let currentAdminPwd = '';
 function openAdminLogin() {
         hideAllScreens();
 // ★ 清場
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
         google.script.run.withSuccessHandler(res => {
            document.getElementById('loading').classList.add('hidden');
            if (res.status === 'Success') {
               currentAdminPwd = pwd;
               renderAdminScreen(res.list);
            } else { showAlert('錯誤', res.msg); }
         }).adminGetList(pwd);
 }
      function renderAdminScreen(list) {
         hideAllScreens();
 // ★ 清場
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
         if(!id || !name) { showAlert('錯誤', '編號與姓名為必填'); return;
 }
         document.getElementById('loading').classList.remove('hidden');
 google.script.run.withSuccessHandler(res => {
            if(res.status === 'Success') {
               document.getElementById('new-id').value = '';
               document.getElementById('new-name').value = '';
               document.getElementById('new-school').value = '';
               refreshAdminList();
            } else {
   
             document.getElementById('loading').classList.add('hidden');
               showAlert('失敗', res.msg);
            }
         }).adminAddEmployee(currentAdminPwd, id, name, school);
 }
      function delEmployee(id) {
         showConfirm('刪除確認', `確定要刪除員工 ${id} 嗎？`, () => {
            document.getElementById('loading').classList.remove('hidden');
            google.script.run.withSuccessHandler(res => {
               if(res.status === 'Success') refreshAdminList();
               else { document.getElementById('loading').classList.add('hidden'); showAlert('失敗', res.msg); }
            }).adminDeleteEmployee(currentAdminPwd, 
 id);
         });
 }
      function refreshAdminList() {
         google.script.run.withSuccessHandler(res => {
            document.getElementById('loading').classList.add('hidden');
            if(res.status === 'Success') renderAdminScreen(res.list);
         }).adminGetList(currentAdminPwd);
 }
      function logoutAdmin() {
         currentAdminPwd = '';
 document.getElementById('admin-screen').classList.add('hidden');
         document.getElementById('login-screen').classList.remove('hidden');
         document.getElementById('btn-admin-entry').classList.remove('hidden');
      }
