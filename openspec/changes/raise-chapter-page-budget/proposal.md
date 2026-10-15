## Why

使用者明確要求單章頁數上限由 512 提高至 1000，並於 2026-10-15 08:57:27 UTC 回覆「都改完」、08:57:40 UTC 回覆「改完直接進main」。本項與進度顯示分開記錄；main 仍由主代理檢查實際差異與驗證後協調，不更新執行中的服務。

## What Changes / Scope

WCF 既有章節請求的 `MAX_PAGES` 從 512 改為 1000，使 WCF 不再把 Bridge 的已授權 1000 頁設定壓回 512。小說與漫畫使用原有同一請求上限，Bridge 仍以站點自己的規則與 request 上限取最小值。

## Non-goals / Compatibility / Privacy

不新增 API、設定介面、認證或站點；不更動 MAX_IMAGES、MAX_CHAPTERS、重試與下載流程。Bridge／Extension 的硬限調整由另一項工作負責，本 repo 不修改其檔案。未放大既有站點自己的 rule cap。不新增私人資料。

## Rollback / Stop Conditions

回復 MAX_PAGES 即可回到原請求上限。若 Bridge／Extension 未完成相容調整，1000 頁端到端驗收仍為未完成，不宣稱可完整下載。不以本項授權重啟服務、部署或操作執行中工作。
