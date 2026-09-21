# 多瀏覽器 Bridge 綁定與可中斷下載工作

## Why

目前 web-content-fetch 只有一組全域 Bridge 綁定，無法讓不同瀏覽器各自固定保存 service UUID，也無法在同一個 Chrome Bridge 上並行管理多個瀏覽器。工作資料也沒有記錄實際使用的瀏覽器／Bridge 身分，取消工作只涵蓋尚未開始的 queue 項目。

## Scope

- 將 Bridge 綁定改為可持久化的多筆 binding profile。
- 每個使用 WCF UI 的瀏覽器以 `crypto.randomUUID()` 隨機產生並透過 localStorage 固定保存自己的 `serviceClientId`；每筆 profile 保存該 UUID、配對後的 `browserClientId`、Bridge URL 與 fingerprint。
- 工作建立時固定選定一筆 binding，保存可公開顯示的 Bridge／browser UUID 資訊。
- UI、API 與 persisted snapshot 顯示 job 的 binding、Bridge URL、browser UUID 與 service UUID，但不顯示 credential。
- queued 與 running 工作都可取消；running 工作透過 additive `content.cancel` 請求要求 Bridge 關閉該 operation 擁有的分頁，並由 web-content-fetch 停止後續 EPUB 輸出。
- 保留舊版單一 binding state 的相容遷移。

## Non-goals

- 不讓 web-content-fetch 直接讀取 Chrome profile、cookie 或登入資料。
- 不把 queue truth、EPUB 輸出或工作取消狀態移到 chrome-bridge。
- 不改變 Threads、X、YouTube 或既有 Browser Read queue。
- 不讓取消工作刪除已完成輸出或其他工作的檔案。

## Privacy impact

UUID 與 Bridge endpoint 是本機工作路由識別，不是 credential；service credential 仍只存在 state volume，不進入 API job snapshot、SSE、UI 文字或 log。取消請求只傳送 service／browser 綁定與 opaque job operation key。

## Compatibility impact

既有單一 binding config 會在啟動時遷移為一筆 profile；既有 `/api/state` 的 top-level binding 欄位保留作為目前 active profile 的相容投影。`content.cancel` 是 chrome-bridge 的 additive secure action，既有 secure action、site rule 與 extension capability 不變。

## Rollback and stop conditions

若 profile 遷移、binding 選擇或取消協定驗證失敗，服務停止新工作並保留明確診斷；不得以未知 profile 或 loopback callback 執行工作。若 Bridge 不支援 `content.cancel`，web-content-fetch 仍可 cooperative cancel：停止後續步驟並等待目前 request 的 bounded timeout／finally 清理，但不得標記為已立即關閉分頁。
