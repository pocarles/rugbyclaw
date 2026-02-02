# Documentation Contributing Guidelines

## When to Update Docs

Update documentation when:
- ✅ New command added
- ✅ Command behavior changes
- ✅ New option added to existing command
- ✅ New use case discovered
- ✅ User reports confusion about a feature
- ✅ API or data source changes

## How to Update

1. **Edit the relevant `.md` file** in `/docs`
2. **Update frontmatter** - Change `updated: YYYY-MM-DD` to today
3. **Test all code examples** - Every example should work as-is
4. **Follow the style guide** (see below)
5. **Submit PR** with tag `docs`

## File Structure

### Command Documentation (`docs/commands/`)

```markdown
---
title: rugbyclaw command
description: One-line description
category: commands
tags: [relevant, tags]
updated: YYYY-MM-DD
---

# rugbyclaw command

> One-line description for quick scanning

## Usage
[Command syntax]

## Options
[Table of options]

## Examples
[Real examples with expected output]

## Tips
[Helpful hints]

## Related Commands
[Links to related docs]
```

### Guides (`docs/guides/`)

```markdown
---
title: Guide Name
description: What this guide covers
category: guides
tags: [relevant, tags]
updated: YYYY-MM-DD
---

# Guide Name

> Clear goal statement

## Overview
[What you'll learn]

## Prerequisites
[What you need first]

## Step-by-Step
[Numbered steps with examples]

## Next Steps
[What to do after]
```

## Style Guide

### Writing Style
- ✅ Use present tense ("shows" not "will show")
- ✅ Use active voice ("Run the command" not "The command should be run")
- ✅ Be concise - respect reader's time
- ✅ Use examples liberally
- ✅ Show expected output after examples
- ❌ Don't use jargon without explanation
- ❌ Don't assume prior knowledge

### Code Examples
- Always use proper syntax highlighting
- Show expected output when relevant
- Test every example before committing
- Use realistic data

**Good:**
```bash
rugbyclaw fixtures top14
```

**Output:**
```
Upcoming Top 14 Fixtures

Sat, Feb 15, 2026 at 15:00
  Toulouse vs Stade Français Paris
```

**Bad:**
```
Run the fixtures command
```

### Headings
- Use sentence case (not title case)
- Keep hierarchy logical (H2 → H3, never skip levels)
- Make headings descriptive

**Good:**
```markdown
## Examples
### View today's scores
```

**Bad:**
```markdown
## Examples
### Example
```

### Links
- Use relative links within docs: `[scores](./scores.md)`
- Use descriptive link text: `[Learn about calendar export](../guides/calendar-export.md)`
- Avoid "click here" or bare URLs

## Testing Your Changes

Before submitting:

1. **Check markdown syntax**
   ```bash
   # Install markdownlint if needed
   npm install -g markdownlint-cli
   
   # Lint your changes
   markdownlint docs/
   ```

2. **Verify links**
   ```bash
   # Check all internal links work
   grep -r "\[.*\](\..*\.md)" docs/
   ```

3. **Test code examples**
   - Run every command in your examples
   - Verify output matches what you documented

4. **Preview on GitHub**
   - Markdown renders differently on GitHub
   - Check that tables, code blocks look good

## Documentation Priorities

### High Priority
- Command reference (`docs/commands/`) - Keep 100% accurate
- Getting started guide - First impression matters
- Troubleshooting - Helps reduce support burden

### Medium Priority
- Guides - Nice to have, but command docs come first
- Reference docs - Update as features change

### Low Priority
- Polish - Grammar, style (but don't ignore completely)

## Questions?

- Check existing docs for examples
- File an issue if uncertain
- Ask in discussions on GitHub

---

**Remember:** Good docs help users succeed. Bad docs waste everyone's time.
