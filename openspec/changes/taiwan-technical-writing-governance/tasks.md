# 工作項目

- [x] 建立 writing-governance OpenSpec，界定文件範圍、非目標、隱私與相容性影響、回復方式及停止條件。
- [x] 將臺灣繁體中文常駐規則併入根目錄 AGENTS.md，新增寫作技能與 allow_implicit_invocation: true 設定。
- [x] 確認文件規範保留程式識別字、原始資料值與既有文件語言範圍，且不改產品行為。
- [x] 文件適用檢查：Compose config、OpenSpec strict validation 與 git diff --check 通過。
- [x] 評估產品 gate：本次不改程式、API、Bridge、EPUB、執行期、相依性或部署；產品 formatter、lint、typecheck、測試、build／health、Bridge binding、SSE reconnect、EPUB fixture 與瀏覽器驗收不適用，未執行，亦不宣稱通過。

## 驗證紀錄

- 日期：2026-10-03。
- 本次文件修正基底：WCF main 705423129490c56033a6cb32c8a4bbb22ec4eb99。
- 工具：Docker Compose 5.3.1、WCF tools profile 的 OpenSpec 1.8.0、Betterleaks v1.8.1（network none、redact）。
- Compose config --quiet：exit 0。
- OpenSpec strict validation：Change 'taiwan-technical-writing-governance' is valid。
- git diff --check：exit 0。
- Secret/privacy scan：Betterleaks v1.8.1 掃描本次 WCF 治理文件，輸出約 12,590 bytes，結果 no leaks found。
- 未啟動產品服務、NAS、瀏覽器或 full test/E2E；這些項目不屬文件變更驗收範圍。未執行結果不代表通過。
