// js/api.js
// ★ 請將下方網址替換成您剛剛在 GAS 部署產生的 API 網址
const API_URL = "https://script.google.com/macros/s/您的網址代碼/exec";

const api = {
    // 讀取資料 (GET)
    getGameData: () => fetch(`${API_URL}?action=getGameData`).then(r => r.json()),
    checkUserStatus: (id) => fetch(`${API_URL}?action=checkUserStatus&studentId=${id}`).then(r => r.json()),
    getLeaderboard: (id) => fetch(`${API_URL}?action=getLeaderboard&studentId=${id}`).then(r => r.json()),
    adminGetList: (pwd) => fetch(`${API_URL}?action=adminGetList&password=${pwd}`).then(r => r.json()),
    
    // 寫入資料 (POST) - 使用 text/plain 避開 CORS 阻擋
    saveProgress: (data) => fetch(API_URL, {
        method: 'POST', body: JSON.stringify({ action: 'saveProgress', data: data }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    }).then(r => r.json()),
    adminAddEmployee: (pwd, id, name, school) => fetch(API_URL, {
        method: 'POST', body: JSON.stringify({ action: 'adminAddEmployee', password: pwd, id: id, name: name, school: school }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    }).then(r => r.json()),
    adminDeleteEmployee: (pwd, id) => fetch(API_URL, {
        method: 'POST', body: JSON.stringify({ action: 'adminDeleteEmployee', password: pwd, targetId: id }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    }).then(r => r.json())
};
