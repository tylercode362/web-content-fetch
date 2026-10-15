## Implementation
- [x] 記錄需求來源、範圍、既有契約與不變事項。
- [x] 新增 tw matcher／WCF gate、分組索引與閱讀完整性保護。
- [x] 補 synthetic fixture、負向與既有站點回歸測試。
- [x] 核對 Extension 全部 Git blob 與版本不變。

## 自動化驗收
- [ ] 執行適用測試、typecheck、格式與 lint、OpenSpec strict validation。
- [ ] 執行 Compose config、Docker build／healthcheck、dependency audit 與 secret/privacy scan。
- [ ] 以獨立 headless 實際鍵鼠／觸控核對完整流程、連續操作與平板。
- [ ] 核對真站 reader、CDN、頁數、章界限與 EPUB／KEPUB 完整性。
- [x] 非 main 工作分支發布並核對遠端 SHA；未驗項目明列。


## 目前狀態

產品與 synthetic 測試碼已修改；有限 Node／Flow 檢查通過，正式工具鏈、Docker 與真實 UI／網站驗收仍未完成。依賴安裝已獲批准並成功；Bridge 74 suites／722 tests 與 typecheck 通過；WCF 67 pass／9 fail／2 skipped，失敗與基線及缺少 kepubify 的對照已記錄。Bridge audit 36 個漏洞未修復。原始 log 與網站 HTML 不提交 Git。詳細範圍與未驗項見 `docs/manhuagui-tw-candidate.md`。

## 已核對的細項

- [x] Bridge typecheck、74 個 Jest suites／722 tests。
- [x] Bridge server security 17 tests 與 client recovery 6 tests。
- [x] WCF URL gate 與 producer focused 2 tests；完整 suite 67 pass／9 fail／2 skipped，失敗未標成通過。
- [x] npm audit 已執行；Bridge 36 個漏洞未修復，WCF 0。
- [ ] 補齊前述正式容器、OpenSpec、實際 UI 與 reader／CDN 驗收。
