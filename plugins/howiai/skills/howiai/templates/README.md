# Templates

Each template is one self-contained HTML file. `scripts/render.mjs` replaces the
`__HOWIAI_DATA__` placeholder inside

```html
<script id="howiai-data" type="application/json">__HOWIAI_DATA__</script>
```

with the JSON document and writes the finished page. Pages must work offline: no
external scripts, stylesheets, fonts, or images. Profile templates read
`profile.json`; aggregate templates read `aggregate.json`. See
`../references/data-schema.md`.

| Template | Reads | Vibe |
|---|---|---|
| `profile-wrapped.html` | profile | Year-in-review story cards, big type, bold color |
| `profile-editorial.html` | profile | Annual report, serif, restrained, dense data tables |
| `profile-terminal.html` | profile | Monospace HUD, dark, punchcard heatmap |
| `aggregate-boardroom.html` | aggregate | Clean team dashboard for a leadership readout |
| `aggregate-exhibit.html` | aggregate | Poster-style gallery of how a team uses AI |
