# computed-style-diff

Toggle style sheets and inspect the effects they have on the elements present on the page.

## Installation

```bash
yarn add computed-style-diff -D
```

## Usage

```javascript
import { getStyleDiff } from 'computed-style-diff'

// Toggle the `theme.css` style sheet and print
// the effects this has based on the computed
// styles of the elements on the page, grouped
// by the selectors in the CSS
getStyleDiff(['theme.css']).then(console.table)
```

## Limitations

Media queries are not getting taken into account, and the computed changes will only contain absolute values.

## License

MIT @ m3g4p0p
