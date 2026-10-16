## Red -> Green -> Refactor
- [x] 比對本專案固定 identity、main polling、SSH wrapper 與 protected mounts。
- [x] 同步四個 canonical 建置檔並通過八專案 byte parity 與 Compose contract。
- [x] 核對官方來源驗證、client-only canonical image 與負向測試證據。
- [ ] OpenSpec strict validation、範圍審查後進本專案 main 並核對遠端 SHA。

本變更不執行應用程式部署、updater 啟用、憑證遷移或 NAS 操作。

2026-10-17 驗證：八專案 distribution gate 15/15 通過，Compose 八份可解析；七專案本變更 strict validation 均通過。Canonical 正式映像 OpenSSH 10.6p1、Node 24.19.0，未含 npm/npx/yarn、sshd、gcc/make/gpg；保留 OpenSSH LICENCE。SSH/client-only source regression 與完整 Gateway Node gate 252 passed、0 failed、2 skipped。未執行應用程式全套驗收，未啟用 updater 或重啟服務。
