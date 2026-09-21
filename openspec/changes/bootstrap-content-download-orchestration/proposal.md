# 初始化 web-content-fetch 內容下載編排

## Why

需要一個獨立服務承擔小說與漫畫的任務頁、佇列、章節編排、進度與 EPUB 輸出。瀏覽器控制仍由既有 `chrome-bridge` 提供，避免把 UI／輸出責任塞入 Bridge，也避免影響 Threads、X、YouTube。

## Scope

- 建立 Docker Compose 應用與 tools profile。
- 建立 OpenSpec、AGENTS、安全基線與本機 state/output 邊界。
- 定義一次性 6 碼 Bridge pairing 與可撤銷 service binding。
- 定義小說整部 EPUB、漫畫每章 EPUB 的工作流程。
- 使用固定版本的開源 `kepubify` 自動產生 Kobo `.kepub.epub`，同時保留原始 EPUB。
- 定義 REST／WebSocket job contract 與 chrome-bridge companion protocol。

## Out of scope

- 不在本專案直接控制 Chrome extension。
- 不保存 Chrome cookies 或網站登入資料。
- 不繞過登入、付費限制、驗證碼或反爬措施。
- 不修改 Threads、X、YouTube 的既有 Bridge 行為。
- 不把任意 callback 目的地、任意圖片下載代理或外部內容 bytes 暴露成通用 API；callback 僅限明確設定且可由 Bridge 到達的端點。

## Compatibility impact

本專案的新 API 必須以 additive contract 連接 chrome-bridge；Bridge 原有 API 與 site rules 必須維持可用，並在整合驗收中回歸。

## Privacy and rollback

Pairing token、工作狀態與輸出檔案分離保存；敏感資料不寫入 log。若 Bridge protocol、安全綁定或輸出完整性驗證失敗，停止工作並保留可診斷狀態，不產出成功結果。Rollback 以停止新 worker、保留既有 output volume 並回復相容 API 版本為原則。
