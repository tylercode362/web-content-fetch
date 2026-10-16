## 1. RED / GREEN
- [x] 1.1 核對固定 SHA、現有寫入位置與使用者需求，先記錄 proposal／design／spec。
- [x] 1.2 撰寫並執行失敗測試，記錄 RED。
- [x] 1.3 實作獨立 config path 與保留配對 fail-closed；執行 GREEN。
- [x] 1.4 加入 opt-in Compose overlay、映像目錄與唯讀檢查文件。

## 2. VERIFY
- [x] 2.1 root 檢視產品核心／overlay；相關測試與改動檔窄範圍 secret/privacy scan。
- [x] 2.2 main 收斂驗證：base／opt-in Compose config、正式 Docker build、UID 10001／0700 config 目錄及 production 套件 gate 通過。
- [x] 2.3 OpenSpec 1.13.0 全部 33 項 strict validation。
- [x] 2.6 完整 npm test：93 項，91 通過、0 失敗、2 項既有 skipped（PowerShell runtime unavailable）；npm audit --package-lock-only --omit=dev：0 vulnerabilities。未升級依賴。
- [x] 2.7 main 收斂驗證：完整 Docker suite 134 pass、0 fail、2 個既有 PowerShell skip；CSRF 測試以可控時鐘排除 2ms 排程競態。未提供的 formatter／lint／typecheck 不宣稱通過。
- [x] 2.4 main 收斂驗證：獨立 config＋preserve mode 的原生桌面鍵鼠／平板觸控流程通過；真實 WCF／Bridge、合成 Extension，原認證位元組不變且 state 不建立 config。
- [ ] 2.5 正式認證目錄搬移屬 opt-in 部署，不是本次 main 收斂的必要切換。正式服務沿用原 state 位置與原認證；未搬移、未重配對，不將合成延續驗證寫成正式搬移完成。

沒有真實資料清除、部署或重啟；未驗項目不得視為通過。

2026-10-10 雲端定點驗證：新 config-store 測試首次 RED（模組尚未實作）；實作後 config-store、binding-store、Origin 與 CSRF 共 26 tests 通過。node syntax 與三份 YAML 語法通過；YAML 語法不等於 Docker Compose 有效設定驗證。原始 log 保留在驗收環境，不提交 Git。

完整 suite 首跑因未指定既有 kepubify 及 fixture HOME 唯讀，81 passed／10 failed／2 skipped。核對已存在的 kepubify v4.0.4／source commit 8e959eda11d783041fc03c1a8109275a27f2f2dc，設定測試專用可寫 HOME 及 WEB_CONTENT_FETCH_KEPUBIFY_PATH 後，91 passed／0 failed／2 skipped。沒有修改產品或權限來略過失敗；首跑證據保留。OpenSpec validator 1.13.0，Dockerfile tools stage 原有 1.8.0 未修改。

本輪執行 Node v24.19.0；正式 Docker 固定 Node 22.22.1，容器版本實測仍未執行，不能宣稱 runtime parity。
