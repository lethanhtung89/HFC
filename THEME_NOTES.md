# HFC Theme Notes — Mantis Migration

## Architecture

```
src/theme/
├── index.ts          ← Main theme export + layout constants (DRAWER_WIDTH, HEADER_HEIGHT)
├── palette.ts        ← Color palette (Mantis-inspired blue primary)
├── typography.ts     ← Typography scale (Be Vietnam Pro font preserved)
├── shadows.ts        ← Subtle shadow set (25 levels)
└── overrides.ts      ← MUI component default overrides

src/components/layout/
├── Sidebar.tsx       ← MUI Drawer-based sidebar (persistent desktop / temporary mobile)
└── Header.tsx        ← MUI AppBar-based header with persist status

src/main.tsx          ← ThemeProvider + CssBaseline wrapper
src/App.tsx           ← Box-based layout (replaces div.app-shell)
```

## Color Palette

| Token           | Value     | Usage                        |
|-----------------|-----------|------------------------------|
| primary.main    | `#1890ff` | Primary actions, active nav  |
| primary.lighter | `#e6f7ff` | Selected backgrounds         |
| primary.dark    | `#096dd9` | Hover states                 |
| success.main    | `#52c41a` | Saved status, success alerts |
| warning.main    | `#faad14` | Conflict/dirty indicators    |
| error.main      | `#ff4d4f` | Error states                 |
| background.default | `#fafafb` | Page background            |
| background.paper   | `#ffffff` | Card/paper surfaces        |
| divider         | `#f0f0f0` | Borders, separators          |

## Layout Constants

- `DRAWER_WIDTH = 260px` (sidebar)
- `HEADER_HEIGHT = 64px` (appbar)
- Desktop breakpoint: `lg (1200px)`

## Adding Navigation Items

Edit `src/components/layout/Sidebar.tsx` → `MENU_ITEMS` array:

```js
import NewIcon from '@mui/icons-material/SomeIcon';

const MENU_ITEMS = [
    { id: 'page-id', icon: NewIcon, label: 'Vietnamese Label' },
    // ...
];
```

Then in `App.tsx`, add the route condition:
```jsx
{currentPage === 'page-id' && <NewPage />}
```

## Responsive Behavior

| Breakpoint | Sidebar         | Header Width                |
|------------|-----------------|-----------------------------|
| ≥ lg (1200)| Permanent drawer| `calc(100% - 260px)`        |
| < lg       | Temporary drawer| `100%`                      |

## MUI Component Usage

All pages can use MUI components that inherit the Mantis theme automatically:

```jsx
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';

// These will have Mantis styling by default
<Button variant="contained">Lưu</Button>
<Card>...</Card>
<Typography variant="h5">Tiêu đề</Typography>
```

## Legacy CSS

`src/assets/css/styles.css` contains original argon-style CSS. The bottom section
has a "MANTIS MIGRATION — Layout Override Layer" that disables old layout rules.
Page-specific styles (`.argon-card`, `.argon-btn`, table styles) are preserved
for existing pages that haven't been migrated to MUI components yet.
