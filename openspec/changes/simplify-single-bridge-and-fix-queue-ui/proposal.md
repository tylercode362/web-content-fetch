# 單一 Bridge 綁定與佇列 UI／CSRF 修正

## Why

目前 `web-content-fetch` 以多個 `binding` profile 管理 Bridge。這不符合目前的產品需求：一個 Web Content Fetch 服務只需要固定綁定一個 Chrome Bridge；重複配對會留下多個相同 browser 的 profile，並讓新增任務的 binding 下拉選單把 URL 輸入框壓縮到幾乎不可用。

實際 Gateway 頁面也曾出現 `csrf_forbidden`，導致新增工作與「清除失敗與取消紀錄」看起來沒有作用。服務端的 exact Origin 邊界必須保留，但 UI 需要能處理跨分頁／服務重啟造成的舊 token，並在清除操作後得到明確的刪除結果。

## Scope

- 將 WCF 的有效 Bridge 綁定收斂為一個 profile；接受既有多 profile state 的相容遷移，選用目前 active profile，保留可恢復舊 job 所需的 alias 對應。
- 重複配對更新同一 profile，不再為同一個 WCF 服務新增第二個 Bridge binding。
- 移除工作表單的 binding 選單，改由唯一的服務綁定處理新工作。
- 修正 URL 輸入框的 flex 版面，避免 Bridge 識別資訊壓縮輸入欄位。
- 讓 CSRF token 支援同源重新同步與一次重試；仍要求 exact Origin 與有效 token。
- 讓批次清除失敗／取消工作的 API 回傳實際刪除工作，並即時發布 queue snapshot。

## Non-goals

- 不修改 `chrome-bridge` 的 Threads、X、YouTube 或既有 Browser Read contract。
- 不撤銷 Chrome Bridge 的 service credential；重新配對仍由六碼流程授權。
- 不新增任意跨來源 CORS、免 CSRF 後門或多 Bridge 併行路由。

## Compatibility and rollback

既有 `bindings` 陣列仍可被讀取，但只選取 active／第一個有效 profile 作為 canonical binding；舊 binding id 只作為本地 migration alias，不在 UI 暴露。既有 job 的 Bridge／browser／service 身分會改成唯一 profile 的公開投影。若 gate 失敗，停止服務新版本並保留原本 state／output volume，可回退本 change 的程式檔而不刪除輸出。

## Privacy and security impact

CSRF token 只在同源 HTML／同源 `/api/csrf` 回應中傳遞，不寫入 log；POST 仍受 exact Origin 與 token 驗證保護。配對碼、service credential、job callback token 與輸出檔案的分離不變。

## Stop conditions

若 CSRF negative test、single-binding migration、清除結果確認、UI source、Compose／OpenSpec 或既有 queue／EPUB 測試失敗，不宣稱完成，也不清除現有 job state。
