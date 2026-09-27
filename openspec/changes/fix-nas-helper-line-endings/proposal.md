# Proposal: 修正 NAS helper 行尾相容性

Windows 工作目錄可能把遠端 shell helper 取出為 CRLF，導致 Synology NAS 的
`/bin/sh` 將 `set -eu` 後方的 carriage return 誤判為非法選項，部署在建立
staging 前即停止。

部署入口必須在上傳前建立不含 BOM 的 LF-only 暫存副本，且不得修改來源檔、
遠端 recovery、備份或 named volume。
