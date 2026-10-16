# 依賴清理設計

## 行為與信任邊界

既有 `epub-writer.js` 的小說／漫畫輸出、`jszip` ZIP 組裝、`sanitize-html` 清理、`sharp` 圖片處理，以及固定 kepubify binary 均維持不變。套件名稱只用於套件管理，不成為外部輸入或新執行入口。

## 變更方式

1. 以既有核准工具及官方 npm CLI 執行 `npm uninstall epub-gen-memory --package-lock-only --ignore-scripts --offline --no-audit --no-fund`，不執行依賴 lifecycle。
2. 比較前後 root dependencies、lock packages 與各套件的依賴解析。只允許移除目標及其專屬閉包；共享套件、未移除套件版本／來源／integrity 及既有 optional 平台依賴均保留。
3. 依實際結果刪除 `docs/dependencies.md` 的保留依賴列，不修改 runtime、UI、容器邊界或其他依賴政策。
4. 使用既有 Docker 的隔離候選環境重裝依賴，跑 EPUB／KEPUB 固定斷言、完整正式測試及專案要求的品質檢查。不得操作既有服務或真實 state／output。

## 驗證與失敗處理

Docker 必須使用既有固定 image／Dockerfile 邊界，不掛載 Docker socket 或認證。不能以目前宿主機套件、跳過 KEPUB、偽造 audit 結果或刪減測試取代驗證。Docker engine 不可用時，不自行啟動可能連帶恢復應用的服務；保留準備成果並列出未驗項。

移除集合為目標與 34 個專屬間接依賴；63 個保留套件的完整 lock record 與 77 條非根依賴邊維持不變。乾淨重裝必須以此 lockfile 執行，不以既有 node_modules 的內容作為可重裝證據。
