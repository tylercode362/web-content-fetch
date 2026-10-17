## Context

來源 main：bffcb078962fdccaf8a9ee79dd134d719f1158f1。本次是工具維護，沒有 UI／頁面流程、HTTP adapter、資料來源或資料庫變更。

## Goals / Non-Goals

固定 @fission-ai/openspec 1.14.3 並驗證既有 spec-driven 文件相容性。不改產品架構、權限、憑證、站點規則或正式部署；不引入新框架。

## Decisions

只更新既有 Dockerfile tools 階段的 OpenSpec 精確版本，補版本與正式階段隔離測試及相依工具文件。

官方來源：https://github.com/Fission-AI/OpenSpec/releases/tag/v1.14.3 ，發布時間 2026-10-17T01:52:12Z。npm 完整性為 sha512-ALFW1d5bSm6t27Kmcle93SDFuqUc8fLwy5ZdBfIiNffo0Yk9AEOJxw6xDqBv38eMM7l7TeOZBB/7C08luxYGfg==；Node 最低版本 20.19.0。MIT 授權允許商業使用，保留套件原有授權與著作權聲明。此工具獨立執行，不嵌入產品程式或交付至 NAS 正式映像。

拒絕只改 generatedBy 標籤冒充 CLI 升級、手造 lockfile、升級無關產品依賴及批次產生技能檔。版本檢查涵蓋精確 pin 與正式階段隔離；失敗時保留錯誤，不把來源靜態檢查當成映像實測。

## Risks / Trade-offs

host 驗證使用 Node 24.19.0／npm 11.9.0；正式 Docker 階段、完整產品回歸及 UI 未在此環境執行，須明列未驗，不降低原驗收標準。audit 與 strict 結果依實際輸出更新。


## 2026-10-17 相依工具檢查

官方 OpenSpec repository 本次查詢為 72,204 Stars，最近 push 為 2026-10-17T01:54:57Z。採用既有工具的官方升版，不另選框架。實際安裝的獨立 OpenSpec 閉包有 57 個套件，授權為 MIT、ISC 或 BSD-3-Clause，每個套件均附授權檔；保留原通知，不將工具或生成程式碼分發至產品。完整閉包未含 Vue／Vite 生態系。官方 npm 查得 Stylelint 最新 17.16.0，本次三專案入口未使用 Stylelint，不因此新增。

獨立 OpenSpec 閉包 npm audit：0 漏洞；這不表示全專案產品依賴已重新通過 audit。
