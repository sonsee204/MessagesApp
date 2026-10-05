# Hook UserPromptSubmit: Nhắc nhở định tuyến task theo Tier (Task Routing)
# Mục đích: Nhắc nhở kiểm tra độ phức tạp của yêu cầu để chọn đúng subagent phù hợp
Write-Host "[Task Routing Reminder] Kiểm tra Tier: Tier 1 (quick-worker/Haiku), Tier 2 (feature-builder/Sonnet), Tier 3 (deep-architect/Opus)." -ForegroundColor Cyan
exit 0