# 設計

config-store 模組承接現有設定讀寫。server 以 WEB_CONTENT_FETCH_CONFIG_DIR 指定目錄，未設定時仍用 stateDir；jobs 與 checkpoints 維持 stateDir。整個 config 目錄掛載，保留同目錄 temporary＋rename，拒絕單檔 mount 的部署設計。

WEB_CONTENT_FETCH_REQUIRE_EXISTING_BINDING=1 用於保留配對的切換／運作：啟動先驗證存在、可讀的 current canonical 單一 binding，且不在啟動時重寫其內容。未配對的新安裝不啟用此模式。損壞設定不可退回空設定。verify-copy 命令只讀來源與目標，驗證 current binding 且逐位元組相同；錯誤僅固定診斷碼，不洩露解析內容。

新增 Compose overlay 指向獨立 external auth volume；base Compose 不自動套用此掛載。此 overlay 不建立 volume、不搬移 secret。只有 WCF app 可掛該 volume，權限仍為現有 app UID。Dockerfile 僅在映像建置時準備新目錄，不更動運作環境 ACL。

既有 Bridge protocol 與 retry／idempotency 規則不變；沒有內容擷取、lazy-load、overlay、missing-assets 或工作資源政策變更。此切片不新增 dependencies。

Rejected alternatives：單檔 bind mount 會破壞 rename；自動搬移／fallback 會隱藏漏檔；重配對改變身分；複製 Chrome profile 或擴大容器權限均超出範圍。
