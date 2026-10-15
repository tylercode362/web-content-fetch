## ADDED Requirements

### Requirement: Explicit tw site support
系統 SHALL 僅接受登錄的 tw.manhuagui.com 作品與同作品章節，並維持 Extension byte-exact 不變。

#### Scenario: Supported work URL
- **GIVEN** 已設定既有 Bridge 綁定
- **WHEN** 提交 tw.manhuagui.com/comic/61792/
- **THEN** WCF 辨識漫畫並使用後端登錄劇本

#### Scenario: Untrusted destination
- **GIVEN** 相似主機名稱或其他作品連結
- **WHEN** 該 URL 未通過精確 matcher 與 work key
- **THEN** 系統拒絕，不擴張 scope

### Requirement: Ordered grouped chapter index
系統 SHALL 保留章節分組及組內閱讀順序，不因重複 DOM id 丟失任何群組。

#### Scenario: Repeated container ID and descending chapters
- **GIVEN** 單話與單行本目錄共用 id，且各組倒序
- **WHEN** 取得章節索引
- **THEN** 各組獨立轉為閱讀順序，去重並保留明確組別標題

### Requirement: Fail closed on incomplete reading
系統 MUST 拒絕把跨章、缺圖、翻頁失敗或未能確認完整頁數的結果當作完整章節。

#### Scenario: Missing page or blocked reader
- **GIVEN** 章節載入逾時、缺頁、登入或驗證阻擋
- **WHEN** 執行章節擷取
- **THEN** 回傳明確失敗或阻擋，不能宣稱 EPUB 完整
