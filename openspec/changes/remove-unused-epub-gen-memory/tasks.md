# 工作項目

- [x] Review 官方 npm 產生的 manifest／lockfile 差異，確認產品與正式測試未載入 epub-gen-memory。
- [x] 移除目標與 34 個專屬間接依賴；保留 63 個 lock record 與 77 條非根依賴邊，未變更共享套件的版本、來源或 integrity。
- [x] 更新必要依賴文件；產品、測試及固定 kepubify binary 不變。
- [x] 在 Docker 隔離層依 lockfile 乾淨重裝，確認 epub-gen-memory 無法解析，依賴稽核為零弱點。
- [x] 自動化驗收：整合候選完整 Node suite 118 pass、0 fail、2 個既有 PowerShell skip，包含實際 EPUB／KEPUB、圖片尺寸、順序與缺圖斷言。
- [ ] 完成整合候選其餘品質門檻後才能合併 main；不以來源 review 或定向測試取代必要驗收。
