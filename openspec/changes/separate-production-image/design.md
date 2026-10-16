# 設計

dependencies 階段安裝 lockfile 的 production 套件，runtime 移除套件管理器並只複製根目錄正式 JS/CSS 與 kepubify。test 從 runtime 加入受控測試、部署腳本及設定，保留完整回歸能力。OpenSpec 工具維持獨立 tools 階段。既有 non-root、唯讀檔案系統與 volume 邊界維持不變，不掛載正式資料驗收。

以實際映像固定斷言排除工具與測試，並在正式映像掛載唯讀測試來源驗證實際 EPUB／KEPUB，不以建置原始碼檢查替代。原生 UI 合成 Extension 只存在測試容器，沒有免配對產品路徑。
