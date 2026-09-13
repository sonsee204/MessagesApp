# ==============================================================================
# install-skills.ps1 - Install Core Agent Skills from skills.sh (Windows PowerShell)
# ==============================================================================
$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  [SKILLS.SH] Installing Core Agent Skills for Fullstack" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$skills = @(
    "anthropics/skills",
    "vercel-labs/agent-skills",
    "nextlevelbuilder/ui-ux-pro-max-skill",
    "leonxlnx/taste-skill",
    "supabase/agent-skills",
    "prisma/skills",
    "mattpocock/skills",
    "juliusbrussee/caveman",
    "lllllllama/rigorpilot-skills"
)

try {
    & npx skills add @skills
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "  [SUCCESS] All core agent skills installed successfully!" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to install skills via npx: $_" -ForegroundColor Red
    exit 1
}
