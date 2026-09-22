# Proposal: Clean book titles and Kobo-safe filenames

Bridge 回傳的頁面標題可能包含「小說線上看」、漫畫平台名稱、網域、作者／出版社尾綴與特殊符號。這些字串目前會進入 job title、EPUB metadata、逐章輸出檔名與 KEPUB 檔名，造成檔案過長或 Kobo 相容性風險。

本變更新增共用的書名清理流程，在保存 job metadata 與產生 EPUB／KEPUB 時都移除已知網站尾綴、網址、控制字元及不適合檔名的符號，並限制檔名 stem 長度。

不改變章節順序、圖片最佳化、EPUB HTML、Kobo inline 寬高、Bridge protocol 或既有網站支援範圍。
