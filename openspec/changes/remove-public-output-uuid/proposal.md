# Proposal: Remove job UUIDs from public download filenames

漫畫逐章輸出的檔名目前會在書名前加入 job UUID，雖然能避免同名工作互相覆蓋，但會讓 Kobo 檔案名稱過長且不易閱讀。

本變更讓新產生的 EPUB／KEPUB 使用清理後書名與章節名稱作為公開檔名；遇到同名輸出時使用短尾碼避免覆蓋。job UUID 仍只保留在工作識別、checkpoint 與內部隔離用途，不再出現在下載檔名。

既有已發布檔案與下載連結不自動改名。
