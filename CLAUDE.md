# g-fund-agent（Claude Code）

@AGENTS.md
@.claude/rules/architecture.md
@.claude/rules/coding.md

## Claude Code 专有

### Slash Commands

- `/feat <需求描述>` — 端到端需求交付全流程
- `/cr <文件路径>` — Code Review

### Hooks

- `PostToolUse(Edit|Write)` → `post-edit-quality.sh`（格式化 + 类型检查）
- `PreToolUse(Bash)` → `pre-bash-firewall.sh`（危险命令拦截）

### 禁止行为

- 不自动 `git commit` / `git push`
- 不跳过 hooks（`--no-verify`）
- 不使用 `rm -rf` 未经确认
