# Principal Engineer Quick Reference 🎯

## Your New Claude Code Tools

I've created three powerful tools to help you develop like a principal engineer:

### 1. 🧠 Principal Engineer Skill
**Location**: `~/.claude/skills/principal-engineer.md`
**Activation**: Say "activate principal engineer skill" or "use principal engineer mode"
**Purpose**: Applies principal engineering best practices automatically to every task

### 2. 🔍 /principal-review Command
**Usage**: `/principal-review [scope]`
**Options**:
- `/principal-review` - Review staged changes (default)
- `/principal-review recent` - Review recent commits
- `/principal-review branch` - Review entire branch
- `/principal-review path/to/file` - Review specific file

**What it does**: Comprehensive code review covering security, performance, testing, and production readiness

### 3. ✅ /pre-commit-checklist Command
**Usage**: `/pre-commit-checklist`
**What it does**: Runs all essential checks before committing (tests, linting, security, build)

## How to Use in Your Next Session

### Starting a New Feature
```
1. "Activate principal engineer skill"
2. "I need to implement [feature]"
   → Claude will now:
   - Create proper task breakdown with TodoWrite
   - Set up feature branch
   - Plan architecture before coding
   - Write tests alongside code
   - Handle errors comprehensively
```

### Before Committing Code
```
1. Run: /pre-commit-checklist
2. Fix any issues found
3. Run: /principal-review
4. Address critical feedback
5. Commit with confidence
```

### Example Workflow
```
User: "Activate principal engineer skill"
User: "I need to add user authentication to the app"

Claude will:
✓ Analyze requirements and ask clarifying questions
✓ Review existing auth patterns in codebase
✓ Create detailed task plan with TodoWrite
✓ Design secure architecture
✓ Implement with tests
✓ Run security audit
✓ Prepare production-ready PR
```

## Key Principles Applied Automatically

1. **Never commit to main** - Always feature branches
2. **Test everything** - Unit, integration, edge cases
3. **Security first** - No secrets, validate inputs, audit dependencies
4. **Document decisions** - Architecture choices explained
5. **Monitor everything** - Logging, metrics, alerts
6. **Think in systems** - Consider whole app impact
7. **Plan before coding** - TodoWrite for task management

## Quick Commands During Development

- "Review this for security issues"
- "What tests should I write for this?"
- "Is this production ready?"
- "Optimize this for performance"
- "Add proper error handling"

## Your Growth Path

**Current Level**: Moving from "code that works" to "code that scales"

**Next Session**: Just say "Activate principal engineer skill" and watch how your development process transforms!

**Pro Tip**: The skill works best when you describe your intent clearly. Instead of "fix this bug", say "fix authentication bug ensuring backward compatibility and adding tests"

---

Remember: These tools are now permanently installed in your Claude Code environment and will be available in every future session! 🚀