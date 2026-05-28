// js/scanner.js
let html5QrCode = null;
let isScannerRunning = false;
let isScanProcessing = false;

const ScannerModule = {
    init: function() {
        const fileInput = document.getElementById('qr-input-file');
        if (fileInput) {
            fileInput.onchange = this.handleFileUpload.bind(this);
        }
    },

    // 啟動活體相機
    startLiveScan: function(onSuccessCallback) {
        if (isScannerRunning) return;
        document.getElementById('scanner-wrapper').classList.remove('hidden');
        isScanProcessing = false;

        if (!html5QrCode) html5QrCode = new Html5Qrcode("reader");

        // ★ 針對一維藥品條碼優化：設定長方形掃描框，強迫使用者對準
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
            showAlert("相機啟動受限", "請點選下方的「拍照掃描」按鈕繼續任務。");
        });
    },

    // 處理拍照上傳與圖片壓縮 (解決高畫素找不到條碼的問題)
    handleFileUpload: function(e) {
        if (e.target.files.length === 0) return;
        const file = e.target.files[0];
        const btnText = document.getElementById('btn-photo-scan');
        const originalText = btnText.innerText;
        btnText.innerText = "⏳ 圖片壓縮與解析中...";

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const MAX_WIDTH = 1000; // 壓縮寬度，利於一維條碼辨識
                let width = img.width;
                let height = img.height;
                if (width > MAX_WIDTH) {
                    height = Math.round((height * MAX_WIDTH) / width);
                    width = MAX_WIDTH;
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    const compressedFile = new File([blob], file.name, { type: file.type });
                    if (!html5QrCode) html5QrCode = new Html5Qrcode("reader");
                    
                    html5QrCode.scanFile(compressedFile, true)
                        .then(decodedText => {
                            btnText.innerText = originalText;
                            e.target.value = ""; 
                            if (isScanProcessing) return;
                            isScanProcessing = true;
                            this.closeScanner().then(() => window.currentScanCallback(decodedText));
                        })
                        .catch(err => {
                            btnText.innerText = originalText;
                            e.target.value = "";
                            showAlert("解析失敗", "壓縮後仍找不到條碼，請確認條碼清晰且無反光。");
                        });
                }, file.type, 0.9);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
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
