# 正式環境 Compose 設定

production 使用主機自己的 `.env`；有覆寫需求時，可明確載入該主機自己的 `.env.local`。兩者均忽略 Git，只提交 `.env.example`。不得把開發環境檔複製至正式主機。填入已存在且已核對的 image SHA 與必要主機路徑；範例空值會讓 production config 失敗。

在專案根目錄驗證（只解析設定，不部署）：

```sh
docker compose --env-file .env -f compose.yaml -f compose.production.yaml config --quiet
```

如需同一主機的 `.env.local`，在 `--env-file .env` 後加 `--env-file .env.local`。Compose 依序讀取，後者優先；shell 環境變數仍優先。`.env.local` 不會因檔名自動載入。

這是 Compose 插值，不是 container `env_file` 或應用程式 dotenv；不會將整份主機檔注入容器。現有認證掛載與程式環境宣告維持原樣，不新增 dotenv 依賴。dotenv 核心若另行使用，須明確指定 `path: ['.env.local', '.env']` 且 `override: false`，其先取得的值優先，不能與 Compose 的檔案順序混用。

此 production overlay 已解析驗證，尚未用於部署。目前本機 runtime 使用受控的 `compose.runtime-recovery.yaml`，固定已驗證映像並移除 build 設定；production overlay 保留基底 Compose 的 build 定義，兩者用途不同。本次整合不切換 runtime、不重建或重啟。未來切換須先核對 image 已存在、有效設定、資源限制、network、volume、port 與認證邊界。容器仍引用的外部設定檔必須保留。


參考：[Docker Compose 插值與優先序](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)、[dotenv path](https://github.com/motdotla/dotenv#path)。

另執行以下唯讀服務清單驗證，輸出須包含 `web-content-fetch`：

```sh
docker compose --env-file .env -f compose.yaml -f compose.production.yaml config --services
```
