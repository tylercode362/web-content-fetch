# tw 漫畫櫃整合候選

## 需求與範圍

2026-10-15 使用者核准修改 WCF 與 Bridge server，明確排除 Extension 修改。只新增 tw 作品 URL 與後端劇本，沿用既有配對、佇列、checkpoint、進度與每章 EPUB／KEPUB；不新增追更、認證、部署或主分支合併。

## 已修改

- WCF 新增 tw 作品 URL gate，其他主機或章節 URL 不作為作品入口。
- Bridge 以同作品精確 matcher 及後端 profile 取得分組索引；各組獨立反轉倒序，採 title attribute，輸出標題加入群組前綴。
- 共用既有 operators；完整頁碼選項、逐頁選中值、圖片唯一性與章 URL 必須一致，否則失敗。
- 新增 synthetic 回歸測試；Extension 全部 Git blob 與發行資訊不變。

## 已執行的有限檢查

- WCF URL 測試先失敗再通過（1 test），server.js 語法檢查通過。
- 現有 Node 的孤立函式檢查：組內順序、完整頁序、逾時及缺頁拒絕通過。此檢查使用 Node experimental stripTypeScriptTypes，產生其 experimental warning；不是正式 TypeScript build。
- 現有 Flow executor 的 synthetic 執行：兩頁只點一次、翻頁逾時保留失敗訊號通過。三個 Content Fetch JSON template 的 validateFlow 通過。
- 以既有 Flow executor 比較三個舊站點的 chapterList／chapter 共 6 案，main 與候選的序列化結果、命令順序完全一致；這是有界合成檢查，不是真站回歸。
- 修改的 TypeScript 已由 Node 內建 transform 解析語法，保留 experimental warning；不是 typecheck。
- git diff --check 通過；Extension 與 extension-release.json 相對基線無差異。

## 阻擋與未驗

- 2026-10-15 使用者核准 npm 依賴安裝後，兩 repo 依 lockfile 安裝成功（ignore-scripts）。Bridge typecheck 通過，完整 Jest 74 suites／722 tests 全通過。WCF 完整測試 78 項：67 通過、9 失敗、2 skipped；6 項明確缺少 kepubify（ENOENT），另外 3 項 resume 錯誤已在基線 7f9fa4463232a2cbd9edf73fa4697d43e8900f49 與相同依賴重現。kepubify 是 Dockerfile 固定版本 Go build 的產物，非 npm 安裝 script。沒有以 stub 代替輸出驗證。
- WCF 原始測試另曾遇到不可寫 HOME 的 EROFS；保留該結果後，將測試程序 HOME 指向獨立可寫目錄，producer 與 tw URL focused tests 2/2 通過。
- npm audit：WCF 0；Bridge 36（critical 2、high 29、moderate 5）。本次未變更依賴版本；漏洞未修復，不代表安全驗收通過。
- Docker／Compose、OpenSpec 工具尚未可用；正式 build／healthcheck、strict validation、格式／lint與完整secret/privacy scan未完成。
- 未進行 headless 真實鍵鼠／觸控 UI、平板、連續流程、Bridge 實機或 EPUB／KEPUB 真圖驗收。
- 公開 HTML 的 reader 容器仍為空；動態圖片與頁碼選項、實際 CDN、尾頁行為尚未驗證。tw 圖片 allowlist 只保留同源，跨網域圖片會明確拒絕，不猜 CDN。這個候選不能標示完整支援或可部署。
- 網站頁尾禁止下載、robots 存取限制與權利條件仍須遵守。沒有批量擷取漫畫、破解資料或繞過任何阻擋。

## 後續驗收

取得缺少工具與合規真站驗證條件後，先核對候選 SHA，再執行兩 repo 的完整測試／typecheck、Compose、OpenSpec 與安全檢查。UI 必須由獨立 headless 瀏覽器以實際鍵鼠／觸控走完整及連續流程，包含平板。圖片測試需核對實際來源、頁數、章界限、暫停恢復、取消、SSE 重連與輸出尺寸／閱讀順序；未驗不能勾選通過。
