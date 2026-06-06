#!/bin/bash
# 危险命令拦截防火墙
# 由 settings.json PreToolUse 钩子触发

COMMAND="$1"

BLOCKED_PATTERNS=(
  "rm -rf /"
  "rm -rf \*"
  "git push --force"
  "git reset --hard"
  "DROP TABLE"
  "DROP DATABASE"
  "curl.*|.*bash"
  "curl.*|.*sh"
)

for pattern in "${BLOCKED_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qiE "$pattern"; then
    echo "❌ 危险命令被拦截: $COMMAND" >&2
    echo "   匹配规则: $pattern" >&2
    exit 1
  fi
done

exit 0
