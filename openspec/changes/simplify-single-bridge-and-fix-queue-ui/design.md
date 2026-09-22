# Design: single Bridge binding and reliable queue actions

## Binding model

`normalizeConfig` 接受舊版 flat shape 與新版 `bindings` 陣列，但輸出最多一個 canonical profile。若有多個合法 profile，優先採用 `activeBindingId`，否則採用第一個；其餘 id 只保留在記憶體中的 migration alias。 `getBinding` 對 alias 回傳同一個 canonical profile，讓重啟後的舊 job 不會因重複 profile 而失去 Bridge；載入 job 時同步套用 canonical identity。

`DownloadOrchestrator.pair` 若已有 profile，沿用 `bindingId` 並更新 Bridge URL、service UUID、credential、browser UUID 與 fingerprint；若尚未綁定才建立 profile。 `config.bindings` 仍以單元素陣列保存，以減少既有 job／測試與 state migration 的格式衝擊，但產品契約不再支援多 profile 選擇。

## Queue UI

設定區只顯示唯一 Bridge profile 的摘要，不再渲染 binding select。新增工作只送 URL 與 kind，由服務端取得唯一 binding。工作表單的 URL 欄位設為可收縮但有 `min-width: 0`，唯一 binding 不會佔用表單橫向空間；小螢幕仍改為直向排列。

批次清除只選 `error` 與 `cancelled`。每筆刪除仍經過既有輸出／checkpoint path safety；成功刪除後持久化並發布 snapshot，API 回傳 `deletedJobIds`、`deleted` 與仍存在的 `failed`／`cancelled` 數量。任何單筆錯誤都會回報診斷，不把未刪除的工作假裝成已清除。

## CSRF flow

服務端建立短期、記憶體內的同源 CSRF token registry。首頁與 `GET /api/csrf` 都產生 token、以 `no-store` 回傳，並設定 `wcf_csrf` cookie。POST 必須先通過既有 `originAllowed`，再以 constant-time comparison 驗證 header token；token 可是目前 cookie 值或尚未過期的同源 page token，讓多分頁不會互相使 token 失效。

`ui.js` 顯式使用 `credentials: 'same-origin'`。若 POST 得到 `csrf_forbidden`，只呼叫同源 `/api/csrf` 更新 token 並重試原操作一次；其他 403 不重試。這處理 stale page／重啟／Gateway cookie path 情況，不降低 cross-origin 防護。

## Failure modes and bounds

- 無 canonical binding：新增 job 回傳 `bridge_not_paired`。
- token 過期或不在 registry：POST 仍回 `csrf_forbidden`，UI 顯示可診斷訊息。
- 清除單筆輸出驗證失敗：批次停止並回報錯誤，保留未處理 job。
- migration 不會刪除 job checkpoint、staging 或 output；只有使用者明確刪除工作時才清理。
