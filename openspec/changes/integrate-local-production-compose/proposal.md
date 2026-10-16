## Why
現行容器的 Compose 設定引用專案外的暫存 override，無法只靠 main 與主機自己的環境檔重現設定。

## What Changes
將現行 override 的必要差異納入受控 production overlay；映像與必要機器值由主機自己的 .env 提供。可明確加載同一主機的 .env.local；不複製開發環境檔到正式主機。保留既有 shell 環境變數優先權。

## Impact
不改動 API、queue、EPUB、Bridge protocol、認證、network、volume、port 或權限語意。不新增 dotenv 套件，不搬移憑證，不部署、重建或重啟容器。環境檔不進入 Git，僅提交無秘密範例。

## Rollback
回復本次受控檔案；現行容器與它們引用的舊 override 保留。若有效設定比對不一致、來源不明或有其他 writer，停止整合。

## 父工作 review 修正
本輪補 AGENTS.md／openspec/config.yaml 的局部環境架構規範，並修正前一版交付檔數為七檔；不改 WCF 執行期設定。
