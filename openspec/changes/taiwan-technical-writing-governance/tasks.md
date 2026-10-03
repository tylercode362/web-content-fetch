# 工作項目

- [x] 建立本 writing-governance OpenSpec，界定文件範圍、非目標、隱私／相容性影響、回復方式及停止條件。
- [x] 將共通寫作規則併入根目錄 AGENTS.md，新增技能與 allow_implicit_invocation: true 中繼資料。
- [x] 以指定 transfer commit 為來源；SKILL.md、agents/openai.yaml 與 always-on-rules.md 的 SHA-256 均與授權值相符。七個 repo 的技能與 YAML staged blob 均逐一比對至來源 blob。
- [x] 文件驗證：Docker Compose 5.3.1 config --quiet exit 0；OpenSpec 1.8.0 strict validation 顯示 change valid；七 repo staged git diff --check 均 exit 0；TW stock .agents 語言 scanner 顯示 Language policy check passed；Betterleaks v1.8.1 對七 repo 本次文件共掃描約 128,642 bytes，結果 no leaks found。
- [x] 評估產品 gate 適用性：本變更不改程式、API、Bridge、EPUB、執行期、相依性或部署；formatter、lint、typecheck、產品測試、Docker build／health、Bridge binding、SSE reconnect、EPUB fixture 與瀏覽器驗收均不適用，未執行且不宣稱通過。

## 驗證紀錄

- 日期：2026-10-03。
- WCF 基底：origin/main 及 worktree HEAD 均為 e3edb3c3ffa0a221f0004a98ba580b01e4f8d7ba；工作分支：codex/taiwan-writing-governance。
- 工具：Docker Compose 5.3.1；WCF 專用 OpenSpec 容器 1.8.0；TW stock 專案 test image 內的語言 scanner；Betterleaks 固定映像 v1.8.1，使用 network_mode none。
- Strict OpenSpec 初次檢查指出 spec 缺少 delta headers；依工具要求補上 ADDED Requirements 與 #### Scenario 後重跑，結果為 Change 'taiwan-technical-writing-governance' is valid。
- Secret/privacy 掃描使用 Betterleaks dir，僅掃描本次七 repo 文件副本，redact 啟用；輸出約 128,642 bytes、1.03 秒、no leaks found。TW stock repo 自身設定的 Betterleaks 掃描另輸出約 5,908,409 bytes、4.9 秒、no leaks found。
- TW stock 語言政策 scanner 僅掃描 .agents，輸出 Language policy check passed。
- 不啟動產品服務、NAS、瀏覽器或 full test/E2E；這些項目不屬文件變更驗收範圍。未執行結果不代表通過。
