# 2026-10-17 本機修正與驗證

## 追加修正：刪除保護與圖片批次

目前已套用 Server 3.6.1、Extension 3.4.0、WCF 0.8.4。WCF 映像為 `sha256:04ad61ae1cf0017825bb7f75f851ee318b6269447ca13a4ec41c536d40ac4384`；Bridge 映像為 `sha256:f4d872653b276a77893b52dc423f873d7916226c19505dcb165e44c1bec4db2c`。使用者已重新載入 Extension，透過原授權 API 核對版本與資源閒置後才切換服務；沒有重新配對或搬移認證。

失敗任務刪除原本未確認未決遠端操作，也沒有防止清理等待期間被重新排入佇列。現在先確認遠端停止，再清除本機內容；同一工作清理期間的續跑、取消與第二次刪除均拒絕。保存紀錄失敗時保留可重試的記憶體紀錄。合成測試重現缺陷後通過；實際隔離 UI 點選刪除、確認後顯示「已刪除工作與 1 個輸出檔案」，磁碟確認該筆工作、檢查點與輸出均移除，另一筆完成工作與輸出保留。隔離容器沒有正式掛載，驗收後已移除。

tw 的 `#pageSelect` 與漫畫批次開關只存在於後端 Flow JSON。Extension 新增的是通用選頁能力與 `flowAssetPageSelection` 協商，不含網站名稱或專用選擇器。舊 Extension 仍能執行其他不需要此能力的 Flow。WCF 只依已驗證 Bridge 章節回應的 `assetBatchSupported` 決定是否使用每批最多 8 張圖片，沒有新增 tw 規則表；舊章節檢查點維持原本單張行為。

新版完整 WCF Docker 回歸為 154 通過、2 略過。Bridge 完整 Jest 為 79 suites／782 tests 通過，另 1 項主機預設 Python 啟動失敗；指定已存在的應用程式附帶 Python 後，該 suite 的 3 項測試通過。兩個正式映像內容檢查、Compose、OpenSpec strict 與 Bridge TypeScript 檢查均通過；隔離 Bridge 啟動／配對 smoke 確認 authenticatedExtension、noiseServicePairing、replayRejected、wrongPinRejected 均為 true。兩個 runtime 建置 audit 均回報 0 vulnerabilities；Bridge 開發閉包仍有既知風險，未將其納入正式映像。差異空白檢查、JS 語法與變更來源的秘密格式掃描通過；WCF 沒有獨立 formatter／lint／型別檢查設定，未宣稱額外工具 gate。

重新載入後，原本失敗的第 20 頁取得成功，單張約 11.97 秒；直接選頁版本取回同一圖片約 10.59 秒。這只是單張、包含開頁成本的比較，不能代表整章平均。原任務已於臺灣時間 19:18:42 完成第 4 話、19:29:23 前完成第 5 話並繼續後續章節，沒有重抓前三話。第 5 話圖片階段自 19:23:30.699 至 19:29:17.026，41 張共約 346 秒，平均約 8.4 秒／張；不含先前約 4 分 48 秒的章節頁面蒐集，亦非相同條件的效能對照試驗，不宣稱大幅加速。前三個 8 張批次各約 66～68 秒。第 4、5 話 EPUB／KEPUB 的 ZIP CRC、mimetype、圖片非空與閱讀項目數均通過，分別各 38、41 張；原工作已有 10 個輸出。兩個正式容器的實際映像 ID 與上述一致，健康狀態均為 healthy。未等待整部 48 話完成；45 分鐘閒置更新路徑由單元測試覆蓋，未宣稱已完成同時長的真站測試。以下舊紀錄保留當時的失敗與驗證範圍。

## 原因與實作

原任務於臺灣時間 18:01:10 遇到 Bridge `secure_session_expired`，在第 4 話第 19／38 張圖片中斷。伺服器實作將 Noise session 限制為 60 分鐘。後續 Docker 重啟使 Bridge instance 改變，保存的未決操作無法直接重播。

WCF 0.8.3 在續跑前核對目前 instance；只在 instance 改變時沿用既有停止確認流程。需要固定指紋、原瀏覽器在線、同一工作沒有持有者，以及前後 instance 一致。確認不足時暫停並保留操作身分、檢查點與輸出。同一 instance 保留原操作的結果重播。

Chrome Bridge 的 Extension 3.3.2 另增加閒置時重新握手；不延長伺服器安全期限。此版本已封裝，原生 Chrome 仍回報 3.3.1，尚未套用。

## 驗證

- 新增測試先重現兩個失敗，修正後通過。
- WCF 完整 Docker 合成回歸：149 通過、2 略過。補充同 instance 重播測試後，取消／續跑與重啟安全反例共 32 項通過。
- 正式映像內容檢查：版本 0.8.3、42 個執行期套件，開發工具與套件管理器排除通過。建置時 npm audit 回報 0 vulnerabilities，未變更相依版本。
- Compose config 與本變更 OpenSpec strict validation 通過。
- Bridge TypeScript 與 JavaScript 語法檢查通過。完整 Jest：78 suites 通過，唯一失敗為主機 Python 啟動問題；對應 Python 容器 27 項測試通過。Jest 的其餘 770 項測試通過。
- 差異檢查未新增秘密、認證搬移或個人內容記錄；沒有新增或更新相依套件。

## 實際部署與未完成事項

WCF 已沿用原 state／output volumes 更新至映像 `sha256:db5a372caadba470a2ea7aa996ae2b1f5a2919d54473313a0ac834ea21797dae`，容器 healthy。本機 `.env` 僅更新非秘密映像 ID，原檔保留於忽略 Git 的備份。正式恢復設定為 `compose.yaml` 加 `compose.runtime-recovery.yaml`；不再引用原暫存 override，原外檔保留。

以原生 Chrome 任務頁按「恢復」，確認保存的 19 張圖片被重用，舊 instance 的停止確認通過。但第 20 頁資產連續兩次回報 `content_asset_asset_fetch_failed`；透過既有受限 Bridge 流程測試同章第 1 頁，也回報相同錯誤。一般 Chrome 閱讀器第 20 頁主圖可正常載入（1125 × 1600），網址期限尚未到期，不能將此失敗歸因於過期網址。

第 1～3 話的六個 EPUB／KEPUB 檔案與第 4 話的 19 張圖片檢查點均保留。第 4 話完成及第 5 話續跑尚未通過，不宣稱整部下載恢復。瀏覽器工具禁止開啟 `chrome://extensions/`，待使用者重新載入 3.3.2 後，繼續核對資產讀取。

## Git 狀態

兩個 repository 原本均為乾淨 main；本次保留為未提交變更，未推送、未同步其他 worktree。chrome-bridge 的 HEAD 與本機 origin/main 為 `2aed588c9651ee9fddd6fafd4cd8e9d605b1551e`；WCF 為 `c3de0e88fda0031f31a0e6caeac218a8cae6c92d`。未查詢遠端最新狀態，未操作既有 production-compose worktree。
