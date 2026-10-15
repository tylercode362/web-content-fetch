## Component Flow
WCF 驗證作品網址 → secure Bridge content.fetch → 後端精確 FQDN／路徑劇本 → 既有 Extension operators → Bridge 正規化章節／圖片證據 → WCF checkpoint 與 EPUB。

## Trust Boundary and Compatibility
保留既有 Noise、六碼配對、service token、撤銷、FQDN queue、同作品限制與圖片 allowlist。operator API 不變；不用任意執行碼，不讀取網站私密憑證。新規則採 opt-in，其他站點沿用既有 profile。

## Chapter Index
公開頁面有兩個同 id 的目錄容器，不能以 getElementById 擷取。由後端 selector 宣告群組標題與連結，透過既有通用元素讀取取得資料；後端有界正規化保留分組，組內反轉倒序，優先使用 title attribute 避免頁數混入標題。同作品 URL 驗證與去重之後才套用輸出上限。

## Reader and Failure Modes
圖片載入、來源網域、頁碼與尾頁行為尚需真實驗收。候選須保留 lazy-load 等待、圖片 MIME／大小／SHA-256 驗證；缺圖、頁數不符、翻頁逾時、超限或跨章時不得回傳成功。蓋板／年齡驗證／登入／CAPTCHA 停止，不能自動通過。取消與重試沿用既有有界策略；WCF 恢復使用既有 checkpoint，不以新任務重送未知操作。

## Rejected Alternatives
不直接從 WCF 抓取網站、不放寬到所有子網域、不新增 Extension 站點程式、不解混淆任意網頁程式、不把單元測試當作真站或 UI 驗收。
