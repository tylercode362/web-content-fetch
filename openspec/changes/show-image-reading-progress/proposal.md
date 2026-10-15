## Why

使用者於 2026-10-15 08:49:54 UTC 回覆「WCF 可改」，授權補上漫畫逐頁讀取圖片的 UI 進度。既有 UI 只顯示圖片驗證進度，未呈現 `chapter_images_read`。

## What Changes

- 在目前章節進度顯示「已讀取 N 頁」，保留總章節進度與圖片驗證顯示。
- 頁數使用 Bridge 的 `pages`；不得把 `total`（可能為 `maxPagesPerChapter` 上限 512）當成實際總頁數。
- 已確認的必要範圍：既有 callback 目前未保存 `pages`，須在原有事件保留有效頁數。`completed` 在部分 reader 回應代表圖片數，不能一概當成頁數。

## Scope / Non-goals

僅調整進度呈現及必要資料保留；不變更 Bridge、Extension、下載行為、認證、API 路由或協定功能，不啟動完整下載、不重啟服務、不部署。

## Privacy / Compatibility

僅使用非負整數頁數，不新增敏感資料。舊事件無有效頁數時保留既有顯示，不把圖片數猜成頁數。`assets_verified`、`asset_verified` 與章節進度維持相容。

## Rollback / Stop Conditions

回復本次 UI、必要 callback 欄位及測試即可。若需要新增其他產品功能、服務操作或安全設定即停止並回報。

必要 callback 欄位保留已由主代理核對為本次正確顯示頁數授權內的最小修正；僅保留 `chapter_images_read` 的非負整數 `pages`，其餘 phase 與欄位不變。缺少有效頁數時顯示「讀取中」，不猜測頁數。
