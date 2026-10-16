## Why
既有 updater 使用發行版 OpenSSH 套件，須同步已核准的官方 10.6p1 portable release 建置流程。

## What Changes
只同步 updater/Dockerfile、.dockerignore、來源 lock 與 build-only verifier。保留本專案 identity、main polling、strict host verification 與 owner activation。

## Impact
僅獨立 updater 來源；不修改應用程式、Extension、資料庫或正式 Compose，不啟用或重啟服務。
