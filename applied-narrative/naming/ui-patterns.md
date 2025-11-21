---
type: naming
subtype: ui-patterns
version: 1.0.0
created: 2024-01-01
updated: 2024-01-01
status: draft
owners: []
tags: [naming, ui, ux, labels]
---

# UI/UX Naming Patterns

## Button Labels

| Action Type | Pattern | Examples |
|-------------|---------|----------|
| Primary action | Verb + Object | "Create Project", "Save Changes" |
| Destructive | Verb + Object | "Delete Account", "Remove Item" |
| Navigation | Destination | "Go to Dashboard", "View Details" |
| Cancel | "Cancel" | "Cancel" |
| Confirmation | Specific verb | "Yes, Delete", "Confirm" |

## Form Labels

| Element | Pattern | Example |
|---------|---------|---------|
| Text input | Noun phrase | "Email Address" |
| Checkbox | Statement | "Send me updates" |
| Radio group | Question or noun | "Preferred contact method" |
| Select | Noun | "Country" |

## Navigation Labels

| Type | Guidelines |
|------|------------|
| Primary nav | Short, noun-based: "Dashboard", "Settings" |
| Breadcrumbs | Match page titles exactly |
| Tabs | Parallel structure, nouns |

## Error Messages

| Type | Pattern | Example |
|------|---------|---------|
| Validation | "Please [action]" | "Please enter a valid email" |
| System | "Unable to [action]. [Resolution]" | "Unable to save. Try again." |
| Permission | "You don't have permission to [action]" | |

## Empty States

| Context | Pattern |
|---------|---------|
| No data | "No [items] yet. [CTA to create]" |
| No results | "No results for '[query]'. Try [suggestion]" |
| Error | "Something went wrong. [Resolution]" |

## Success Messages

| Action | Pattern | Example |
|--------|---------|---------|
| Create | "[Item] created" | "Project created" |
| Update | "[Item] updated" or "Changes saved" | |
| Delete | "[Item] deleted" | "File deleted" |

---

## Narrative Constraints
<!-- All UI text must follow these patterns -->

- Button labels must use approved patterns
- Error messages must be helpful, not blaming
- Empty states must include resolution path
- Consistency across all surfaces is required
