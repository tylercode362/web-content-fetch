# Bridge 瀏覽器斷線可恢復下載

## Why

Chrome Bridge 的 Extension secure session 有固定存活時間。當瀏覽器在內容工作期間重新連線時，進行中的 content.fetch 會收到 `browser_client_disconnected`，目前 web-content-fetch 會直接把工作標記為失敗，即使已有章節 checkpoint 仍可繼續。

## Scope

- 將瀏覽器暫時離線、斷線與 Bridge transport 錯誤納入 bounded retry。
- 重試耗盡後保留 manifest、已完成章節與 staging，將工作標記為可恢復的 paused 狀態。
- 讓 UI 與 API 可以對這類 error／paused 工作執行 resume，並繼續使用原本固定的 binding、browser UUID 與 service UUID。
- 保持同 FQDN 序列化、取消清理、EPUB 輸出與既有 Chrome Bridge 功能不變。

## Non-goals

- 不延長或停用 Noise session 的安全期限。
- 不在 Bridge 端偷偷重複操作已失去的分頁；恢復以 web-content-fetch 的 job checkpoint 為邊界。
- 不自動更換 binding、不重新配對、不要求新的六碼。
