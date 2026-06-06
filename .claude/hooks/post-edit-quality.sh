#!/bin/bash
# 编辑后自动格式化 + 类型检查
# 由 settings.json PostToolUse 钩子触发

FILE="$1"

# 仅处理 TS/TSX 文件
if [[ "$FILE" != *.ts && "$FILE" != *.tsx ]]; then
  exit 0
fi

# 格式化
pnpm exec prettier --write "$FILE" 2>/dev/null || true

# 类型检查（仅检查变更文件所在 workspace）
if [[ "$FILE" == apps/api/* ]]; then
  pnpm --filter @g-fund/api exec tsc --noEmit --skipLibCheck 2>&1 | head -20 || true
elif [[ "$FILE" == apps/web/* ]]; then
  pnpm --filter @g-fund/web exec tsc --noEmit --skipLibCheck 2>&1 | head -20 || true
elif [[ "$FILE" == packages/* ]]; then
  pnpm typecheck 2>&1 | head -20 || true
fi
