# 相依套件與外部工具

本表採用 `opendata-research` 的相依性盤點方式：版本以 lockfile 或固定 commit 為準，執行環境以 Docker digest 為準；更新前需重新檢查授權、維護狀態與安全公告。

| 元件 | 固定版本／來源 | 用途 | 授權／備註 |
|---|---|---|---|
| Node.js | `node:22.22.1-bookworm-slim@sha256:4f77a690...` | WCF runtime | Docker Hub official image；完整 digest 見 `Dockerfile` |
| Go | `golang:1.24-bookworm@sha256:98d673f...` | 建置工具階段 | Docker Hub official image；僅存在 build stage |
| kepubify | `v4.0.4`, commit `8e959eda11d783041fc03c1a8109275a27f2f2dc` | EPUB 轉 Kobo KEPUB | [pgaskin/kepubify](https://github.com/pgaskin/kepubify)，依其專案授權；只在映像內執行固定 binary |
| `jszip` | `3.10.2` | EPUB ZIP 容器 | MIT OR GPL-3.0-or-later |
| `salty-crypto` | `1.0.0-rc.4` | Bridge Noise secure client | MIT |
| `sanitize-html` | `2.17.7` | 小說 HTML 清理 | MIT |
| `sharp` | `0.35.5` | 圖片解碼、縮放、JPEG 最佳化 | Apache-2.0；底層影像元件依 lockfile 授權 |

不把 Chrome profile、cookie、token、GitHub 認證或 Docker socket 放入容器。網路只在 runtime 連到明確設定的 Chrome Bridge；OpenSpec tools 容器執行時無網路。

Runtime 僅保留實際使用的依賴；epub-gen-memory 及其專屬間接依賴不再安裝。移除不改變自建 EPUB writer、圖片處理或 KEPUB 流程；重裝與輸出斷言見對應 OpenSpec 工作項目。

Dockerfile 的 dependencies 階段依 lockfile 安裝；runtime 只複製正式 JS/CSS、執行期套件與 kepubify，不攜入 test、scripts、updater、OpenSpec、工程文件或 npm／Corepack／Yarn。test 階段從 runtime 加入可重複執行的測試，tools 階段提供獨立 OpenSpec。以 `node scripts/verify-production-image.cjs` 在實際 runtime 映像中驗證套件閉包與禁止工具；驗證器透過唯讀掛載提供，不複製進正式映像。
