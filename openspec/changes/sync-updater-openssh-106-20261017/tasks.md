## Red -> Green -> Refactor
- [x] 比對本專案固定 identity、main polling、SSH wrapper 與 protected mounts。
- [x] 同步四個 canonical 建置檔並通過八專案 byte parity 與 Compose contract。
- [x] 核對官方來源驗證、client-only canonical image 與負向測試證據。
- [x] 本次 updater 同步提交已整合至 main；2026-10-18 UTC 只讀核對遠端 main 為 `61e0b8e1b771f5dddf3d4e52643c519018e8efda`，並確認同步提交 `199e3a2a8e6483a73a891e6c914c9baf8dd46619` 位於其歷史中。
- [ ] 獨立核對上述 main 來源的 OpenSpec strict validation 與變更範圍審查證據；本次僅核對 Git 提交與文件，未重跑驗證，未將下方作者歷史收據視為目前來源的獨立驗收。

本變更不執行應用程式部署、updater 啟用、憑證遷移或 NAS 操作。

2026-10-17 驗證：八專案 distribution gate 15/15 通過，Compose 八份可解析；七專案本變更 strict validation 均通過。Canonical 正式映像 OpenSSH 10.6p1、Node 24.19.0，未含 npm/npx/yarn、sshd、gcc/make/gpg；保留 OpenSSH LICENCE。SSH/client-only source regression 與完整 Gateway Node gate 252 passed、0 failed、2 skipped。未執行應用程式全套驗收，未啟用 updater 或重啟服務。

