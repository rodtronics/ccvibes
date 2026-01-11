# Lexicon System

The lexicon system provides centralized terminology and UI text management for Crime Committer VI.

## File Location

`data/lexicon.json`

## Purpose

- **Single source of truth** for all UI text
- **Consistency** across the application
- **Easy updates** - change terminology in one place
- **Tone control** - maintain "dry, understated, cynical" voice
- **Future i18n** support (translations)

## Structure

The lexicon is organized into categories:

- `actions` - Button labels and action verbs (START, STOP, DROP)
- `status` - Status indicators (AVAILABLE, BUSY, UNAVAILABLE)
- `labels` - UI labels and readouts (CASH, HEAT, CREW)
- `tabs` - Main navigation tabs
- `panels` - Panel headers and titles
- `log_templates` - Log message templates with variable substitution
- `errors` - Error messages
- `tooltips` - Tooltip text

## Usage in Code

### Simple Text Lookup

```javascript
// Get a simple string
const buttonText = Lexicon.get('actions.start'); // "START"
const statusText = Lexicon.get('status.busy'); // "BUSY"
```

### Template Substitution

```javascript
// Use templates with variables
const message = Lexicon.template('log_templates.run_started', {
  activityName: 'shoplifting',
  optionName: 'grab and go'
});
// Result: "Started: shoplifting → grab and go"
```

### Fallback Support

The Lexicon system includes automatic fallbacks:
- If lexicon.json fails to load, uses empty defaults
- If a key is not found, returns the path as-is
- All usage includes `||` fallback to hardcoded strings for safety

## Examples from Codebase

### Engine.js Log Messages

```javascript
// Before
this.addLog(`Dropped: ${activityName} → ${optionName}`, "warn");

// After
const message = window.Lexicon?.template('log_templates.run_dropped', { activityName, optionName })
  || `Dropped: ${activityName} → ${optionName}`;
this.addLog(message, "warn");
```

### UI.js Button Text

```javascript
// Before
button.textContent = "START";

// After
button.textContent = Lexicon.get('actions.start') || "START";
```

## Extending the Lexicon

To add new terms:

1. Edit `data/lexicon.json`
2. Add to appropriate category
3. Use `Lexicon.get('category.key')` or `Lexicon.template('category.key', vars)`
4. Always include a hardcoded fallback

## Benefits

- **Maintainability**: Change "cancel" to "drop" in one place
- **Searchability**: All text in one file
- **Tone consistency**: Easier to audit and maintain voice
- **Future-proof**: Easy to add translations or alternate text sets
- **Moddability**: Players can customize text without touching code
