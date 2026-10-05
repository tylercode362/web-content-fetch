## Context

csrf.js 登記短期 token，verify 不以 cookieToken 判定登入狀態。compose.yaml 在容器內監聽 0.0.0.0:8092，沒有 ports，加入 Gateway 網路。

## Goals / Non-Goals

對齊文件與既有 LAN 自用 POC；不新增登入系統、不改正確 binding、不覆蓋其他 runtime 修正。

## Decisions

UI → Gateway → WCF 的異動仍經 exact Origin 與 CSRF 檢查。Bridge 配對憑證與 browser session 維持獨立邊界，不將 CSRF 視為認證。拒絕新增帳密或將容器改綁 loopback，因兩者均超出必要修正。

## Risks / Trade-offs

文件不應宣稱 CSRF 提供登入認證；測試保留失效 token 的拒絕行為。安全協定、失敗模式與既有資源上限不變。
