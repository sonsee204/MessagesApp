# Hook PreToolUse: Chặn hoàn toàn việc tạo git worktree (EnterWorktree) theo quy định của dự án
# Mục đích: Đảm bảo toàn bộ thao tác phát triển diễn ra trên cùng một working directory thông qua git branch
Write-Host "CẤM: Dự án không sử dụng worktree (EnterWorktree). Hãy tạo git branch thông thường trên cùng checkout." -ForegroundColor Red
exit 1