// js/scanner.js
let html5QrCode = null;
let isScannerRunning = false;
let isScanProcessing = false;

const ScannerModule = {
    init: function() {
        // 已移除備用的圖片上傳綁定
    },

    startLiveScan: function(onSuccessCallback) {
        if (isScannerRunning) return;
        document.getElementById('scanner-wrapper').classList.remove('hidden');
        isScanProcessing = false;

        if (!html5QrCode) html5QrCode = new Html5Qrcode("reader");

        // 針對一維藥品條碼優化：長方形掃描框
        const config = { fps: 10, qrbox: { width: 280, height: 120 } };

        html5QrCode.start(
            { facingMode: "environment" }, config,
            (decodedText) => {
                if (isScanProcessing) return;
                isScanProcessing = true;
                this.closeScanner().then(() => onSuccessCallback(decodedText));
            },
            (err) => {} // 忽略持續掃描中的小錯誤
        ).then(() => {
            isScannerRunning = true;
        }).catch(err => {
            isScannerRunning = false;
            // ★ 統一呼叫新的 AppModal
            AppModal.showAlert("相機啟動受限", "請確認瀏覽器已允許存取相機權限。");
        });
    },

    closeScanner: function() {
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
};
