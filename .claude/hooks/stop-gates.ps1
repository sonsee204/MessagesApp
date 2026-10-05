# Hook Stop: Kiểm tra chất lượng mã nguồn trước khi kết thúc task
# Mục đích: Tự động chạy các gate kiểm tra nhẹ (diff-bans, size-gate, tsc-gate) khi có thay đổi trong backend/src hoặc frontend/src

# Lấy danh sách các tệp có thay đổi (tracked) và tệp mới chưa theo dõi (untracked)
$diffFiles = git diff --name-only HEAD
$untrackedFiles = git ls-files --others --exclude-standard | Where-Object { $_ -ne "" }
$allDiff = ($diffFiles + "`n" + $untrackedFiles) -split "`n" | Where-Object { $_ -ne "" }

# Lọc các tệp mã nguồn TypeScript thuộc backend hoặc frontend
$sourceChanged = $allDiff | Where-Object { $_ -match "^(backend|frontend)/src/.*\.(ts|tsx)$" }

if (-not $sourceChanged) {
    Write-Host "[Stop Gate] Chi thay doi docs/config hoac khong co diff ma nguon. Bo qua kiem tra code." -ForegroundColor Green
    exit 0
}

Write-Host "[Stop Gate] Phat hien thay doi ma nguon. Dang chay kiem tra tu dong..." -ForegroundColor Yellow

# 1. Kiểm tra các điều cấm trong diff (any, ts-ignore, console.log)
node scripts/gates/diff-bans.mjs
if ($LASTEXITCODE -ne 0) {
    Write-Host "[Stop Gate] diff-bans that bai. Vui long sua loi truoc khi bao xong task." -ForegroundColor Red
    exit 1
}

# 2. Kiểm tra giới hạn kích thước tệp (size-gate) cho frontend và backend
npm --prefix frontend run size-gate:strict
if ($LASTEXITCODE -ne 0) {
    Write-Host "[Stop Gate] Frontend size-gate that bai." -ForegroundColor Red
    exit 1
}
node scripts/gates/size-gate.mjs --src backend/src --baseline backend/size-gate-baseline.json --strict
if ($LASTEXITCODE -ne 0) {
    Write-Host "[Stop Gate] Backend size-gate that bai." -ForegroundColor Red
    exit 1
}

# 3. Kiểm tra kiểu TypeScript (tsc-gate) cho cả frontend và backend
node scripts/gates/tsc-gate.mjs
if ($LASTEXITCODE -ne 0) {
    Write-Host "[Stop Gate] TypeScript type-check that bai." -ForegroundColor Red
    exit 1
}

Write-Host "[Stop Gate] Toan bo kiem tra nhe thanh cong!" -ForegroundColor Green
exit 0