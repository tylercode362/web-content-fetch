## Why
使用者於 2026-10-15 要求支援 https://tw.manhuagui.com/comic/61792/，並明確核准修改 WCF 與 Bridge server，條件是 Extension 不變。

## What Changes
- 增加 tw 精確作品網址支援與後端站點劇本。
- 目錄保留單話／單行本分組、組內依閱讀順序排列，避免跨章或缺頁被當作完成。
- 沿用既有佇列、配對、圖片證據與每章 EPUB 輸出。

## Scope and Non-goals
只修改後端、必要測試與文件；Extension 全部檔案、版本與發行資訊維持原樣。不新增認證、追更、批次下載功能、部署或主分支合併。

## Privacy and Compatibility
不收集 cookie、登入資料或新憑證。既有 m 站、8Comic、Linovel、Threads、X、YouTube 契約保持不變。網站與呼叫端內容不得擴張執行權限。

## Rollback and Stop Conditions
以工作分支差異回復本次新增支援，不修改既有資料。若原有 operator 無法正確讀取，回報阻擋，不修改 Extension 或繞過網站限制。站底禁止下載、robots 限制與實際 reader／CDN 未驗證須明列；程式候選不代表真站驗收通過。
