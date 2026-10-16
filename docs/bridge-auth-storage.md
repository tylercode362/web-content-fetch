# 分離 Bridge 綁定設定與工作資料

## 狀態與範圍

此功能提供路徑分離與檢查，沒有自動搬移、刪除、配對、部署或重啟。正式來源／目標 volume、服務 UID、存取權限與停機範圍必須先核對及確認；新設定檔存在不等於真實 credential 已延續。

`WEB_CONTENT_FETCH_CONFIG_DIR` 指定 `config.json` 的目錄；未設定時維持既有 `WEB_CONTENT_FETCH_STATE_DIR`。jobs.json 與 checkpoints 仍位於 stateDir，output 維持原目錄。整個 config 目錄必須可供既有 app 使用者完成同目錄 temporary＋rename；不要使用單檔 bind mount，也不要為解決錯誤放寬容器權限。

`WEB_CONTENT_FETCH_REQUIRE_EXISTING_BINDING=1` 表示保留現有配對：目標缺失、不可讀、損壞、symlink 或不是目前 canonical 單一 binding 時，server 在接受工作前停止。此模式不在啟動時重寫 config。它不是建立配對的 shortcut，也不讀取舊位置作 fallback。全新未配對安裝不啟用此模式；目前有效的預設安裝方式維持不變。無論是否啟用，格式損壞的設定不再被空設定覆寫。

## 準備與檢查順序

1. 以部署 SHA、image digest 與 mounts metadata 核對實際服務及 state volume，找出真正的 `config.json`。不要 dump 全部環境變數或 credential。
2. 核對既有檔案是目前單一 binding 形狀，包含 bindings、activeBindingId、bindingAliases 與原 service/browser 身分。不增加 legacy 匯入／格式轉換；遇到舊形狀先停止。
3. 在取得具體來源、目的地、存取與停機核准後，停止設定寫入者。在同一環境準備受保護的獨立目錄及副本；不要把真實秘密放入雲端、Git、Library、一般 log 或本文件。
4. 在同一受控環境，用下列唯讀檢查驗證複本；參數只是路徑，不是 credential：

   `node config-store.js verify-copy <目前來源 config.json> <已準備的目標 config.json>`

   工具只讀取檔案，不複製、刪除、建立設定、變更權限或連線 Bridge。檢查以受控停寫為前提，沒有提供對抗並行替換／TOCTOU 的完整保證；大小檢查也不是對惡意並行增長檔案的硬性記憶體上限。成功只輸出 `binding_copy_verified`。缺檔、損壞、不同副本、來源與目標為同一檔案、symlink／非一般檔案均失敗。檔案讀取錯誤不回傳內容；JSON 原文與解析片段不會出現在診斷。不要輸出 credential 或內容 hash 作「證據」。

5. 核對只有 WCF app 能使用目標，且 UID 10001 的合法權限足以原子寫入。`Dockerfile` 只在映像中準備 `/var/lib/web-content-fetch/config` 為 app 的 0700 目錄，不處理既有正式 volume 的權限。既有 volume 權限錯誤時停止，不自行改 ACL。
6. 設定 `WEB_CONTENT_FETCH_AUTH_VOLUME` 為核實已存在的 volume 名稱，再檢視 `compose.yaml` 加 `compose.bridge-auth.yaml` 的有效設定。overlay 是 opt-in，external volume 不存在時須失敗，不可讓新空 volume 冒充舊認證。
7. 按核准時段切換並啟動 WCF，確認新讀取路徑及既有 credential 延續。base Compose 不自動讀取 overlay；部署工具若只接受單一 Compose，須先完成明確支援與 review，不能宣稱此文件已使原工具自動切換。

## 認證延續驗收

在原環境內比較原／新 serviceClientId、browserClientId、bindingId、serviceCredential、expectedFingerprint、aliases 與 Bridge 授權集合，只回報相同／不同。使用既有狀態與操作流程核對，不能只看 paired=true 或 `/healthz`。

Chrome Bridge Extension 遇到某些 local registration_invalid 情境會自動重新註冊。因此「成功重新連線」不足以證明原認證保留；如果 credential 或 UUID 改變、自動重配對／註冊，視為未通過。不得以重新配對補成通過。

原 state 的 config.json 在切換驗證前保留。這份副本仍是敏感復原資料，不能隨後通刪 state；驗收通過後另列退役／清理清單及確認。業務資料清除仍須具體清單與不可復原刪除確認。

## 失敗與回復

任何複本衝突、缺失、格式、身分或權限錯誤，停止受影響步驟並保留新舊資料。先確認啟動是否曾改寫新設定、輪替 credential 或變更授權。只有原檔仍代表有效相同身分時，才能按已核准方案回復原掛載；不盲目覆寫新舊檔。

## 驗證層級

`node --test test/config-store.test.js test/binding-store.test.js test/origin-boundary.test.js test/csrf.test.js` 使用合成 fixture，檢查獨立寫入、原子檔案行為、fail-closed、唯讀比對及既有安全邊界。這不是 Docker 檔案系統／volume 權限、真實配對延續或 UI 驗收。Compose config、Docker build、完整品質 gate、獨立 headless 完整／平板實際操作、正式環境移轉均須另外記錄，不把未驗寫成通過。
