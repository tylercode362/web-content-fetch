# 驗證結果（2026-10-15）

- 產品差異僅 `MAX_PAGES = 512` 改為 `MAX_PAGES = 1000`。
- 新增 3 項 synthetic 測試：先 RED（0 通過／3 失敗），再 GREEN（3／3 通過）。直接擷取 orchestrator 產生的小說與漫畫 chapter request，確認 `maxPages: 1000`；圖片上限 1024、章節上限 2000 不變。不進行真實下載。
- 新增程式及測試語法檢查、git diff whitespace 檢查、OpenSpec strict validation 通過。
- 完整測試：76 通過、9 失敗、2 略過。未修改基底在相同環境為 67 通過、同名 9 失敗、2 略過；本批進度 6 項與頁數 3 項皆通過。
- 既存失敗與未驗 gate 詳見 `../show-image-reading-progress/verification.md`：6 項直接缺 kepubify，3 項續傳為已重現基底失敗。未將完整測試稱為全數通過。
- 本 repo 不包含 Bridge 站點規則；其原有 `Math.min(rule.maxPagesPerChapter, request.maxPages || rule.maxPagesPerChapter)` 會保留較小站點上限。跨 repo 候選是否仍符合此契約及 1000 頁端到端，由主代理合併前核對。
- 1000 頁真實下載、完整產品連續操作未驗。進度標籤的最小 headless 桌機／平板 fixture 已通過，詳見相鄰進度修正 verification.md，不能取代 1000 頁端到端驗收。不更新 live，不重啟服務，不部署；main 由主代理 review 後依授權另行協調。
- 原始測試輸出保留雲端，不提交 Git；本次差異人工檢查未發現秘密或私人資料，無 dependency 變更。

## 長章節操作的已知阻擋（後續只讀核對）

- Docker 固定 Node.js v22.22.1；官方 `deps/undici/src/lib/dispatcher/client.js` 第 222–223 行的 headers/body timeout 預設為 300 秒。WCF `bridge-client.js` 直接使用 native fetch，沒有自訂 dispatcher。同步 `content.fetch` 超過此等待時間仍可能失敗，調高 maxPages 不會解除它。
- 來源：https://github.com/nodejs/node/blob/v22.22.1/deps/undici/src/lib/dispatcher/client.js#L222-L223
- WCF SecureSession 與 Bridge SecureSession 均有 1 小時期限；回應解密／加密也檢查期限。超過期限的長操作不能因 Flow 自己允許 2 小時就視為可成功。
- 本批不延長安全 session 期限、不加入非同步工作架構、不改全域 timeout 或新增 dispatcher 相依套件。1000 是請求容量上限，尚未證實 1000 頁可端到端完成。
- WCF callback token 沒有另外的時間期限。SSE 15 秒是寫入背壓保護，不是章節工作逾時；Bridge 的 30 分鐘 job 清理只針對 finishedAt，不應當作執行中工作期限修改。
