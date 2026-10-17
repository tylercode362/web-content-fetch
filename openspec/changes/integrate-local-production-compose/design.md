## 設定流程與邊界
production 明確以 --env-file .env 載入 Compose 插值。主機若有自己的 .env.local，可再明確指定 --env-file .env.local。Compose 的後者優先；shell 環境變數優先於檔案。這不是應用程式 dotenv，也不透過 env_file 把整份主機檔送入容器。只有既有 environment 宣告的鍵進入容器。

## 替代方案
不將本機 image SHA、主機路徑或秘密寫死於共享 main；不為 Compose 插值安裝 dotenv。dotenv 核心不會自動搜尋 .env.local；若日後應用程式需使用，應明確指定 path: ['.env.local', '.env']，維持 override: false，另行測試。

## 失敗與資源
production overlay 的必要變數缺失時，Compose config 必須失敗。維持原有資源限制、網路、認證檔與 named volume。舊 override 仍由執行中容器的 immutable labels 引用，這次不刪除。未來切換需另行核准 recreate。

## 來源
- https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/
- https://github.com/motdotla/dotenv#path

## 正式設定 review 修正
本輪補 AGENTS.md／openspec/config.yaml 的局部環境架構規範，並修正前一版交付檔數為七檔；不改 WCF 執行期設定。
本機 image ID 是 image config 的識別碼；registry digest 是 registry manifest 的識別碼，兩者不得互相比值。不得以重新 build 或解析浮動 tag 宣稱重現同一映像。原 runtime 外檔保留，未核准切換前不刪除。
