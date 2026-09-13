#!/usr/bin/env bash
set -e

echo "=========================================================="
echo "  [SKILLS.SH] Installing Core Agent Skills for Fullstack"
echo "=========================================================="

npx skills add \
  anthropics/skills \
  vercel-labs/agent-skills \
  nextlevelbuilder/ui-ux-pro-max-skill \
  leonxlnx/taste-skill \
  supabase/agent-skills \
  prisma/skills \
  mattpocock/skills \
  juliusbrussee/caveman \
  lllllllama/rigorpilot-skills

echo "=========================================================="
echo "  [SUCCESS] All core agent skills installed successfully!"
echo "=========================================================="
