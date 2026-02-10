# fonts/ - Local Font Files

Retro/monospace fonts loaded via `@font-face` in `style.css`. Each has a corresponding `.font-*` CSS class.

| File | Font ID | Category | Notes |
|------|---------|----------|-------|
| `Ac437_IBM_BIOS.ttf` | `ibm-bios` | retro | IBM PC BIOS font. Used as default boot screen font (set in index.html). |
| `Ac437_IBM_VGA_9x8.ttf` | `vga-9x8` | retro | IBM VGA 9x8 font. Classic DOS look. |
| `Ac437_IBM_VGA_8x16.ttf` | `vga-8x16` | retro | IBM VGA 8x16 font. Taller DOS look. |
| `Commodore-64.TTF` | `commodore-64` | retro | C64 character set. |
| `JetBrainsMono-ExtraBold-subset.woff2` | `jetbrains-mono` | modern | Subsetted JetBrains Mono (extra bold weight only). |

## Web Fonts (not in this folder)
- **Fira Code** (`fira`) - loaded via Google Fonts in `index.html`. Default user font.
- **Source Code Pro** (`scp`) - loaded via Google Fonts in `index.html`.

## Adding a New Font
1. Add the font file to this folder
2. Add `@font-face` rule and `.font-{id}` class in `style.css`
3. Add the font ID to `FONTS` array and appropriate `FONT_CATEGORIES` entry in `settings.js`
4. Add display name to `fontNames` map in `ui.js` (~line 1760)
5. If retro, add to `isRetro` array in `ui.js` (~line 1770)
