## Decisions
以官方 archive SHA256、detached signature 與完整 signer fingerprint 驗證後才解壓與編譯。基底必須是已核對的不可變 digest。Builder 與 runtime 分離，runtime 只帶 SSH client 與必要 Git/Node 執行期，移除 npm/npx/yarn 及建置工具。不得改動 deploy key、known_hosts 或 NAS protected state。

## Validation
與 Local Gateway canonical 四個建置檔逐位元組相同，驗證本專案固定 identity、共用程式與獨立 Compose。官方來源與實際映像版本、連結及套件清單由 canonical build 驗證；不宣稱八個映像皆已建置或 NAS 已啟用。

## Applicability
應用程式 UI、瀏覽器、Android、Blender、模型與資料庫驗收不適用：本次沒有修改其來源、契約、套件或 runtime。這些檢查未執行，不列為通過。
