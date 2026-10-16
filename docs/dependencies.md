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

## 2026-10-16 未使用依賴清理

移除未被產品或正式測試載入的 epub-gen-memory 1.1.2；自建 EPUB writer 與 KEPUB 流程不變。以 Dockerfile 固定官方 Node image（Node 22.22.1／npm 10.9.4）執行 package-lock-only、ignore-scripts、offline 移除；不安裝宿主npm、不執行lifecycle。lock由98個套件降為63個，移除目標與34個專屬間接依賴；保留套件的完整lock record與77條依賴邊均未變。EPUB／KEPUB、完整測試與正式品質驗證依使用者決定清理後統一執行，本段不代表驗收通過。
