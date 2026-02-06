# Badge Generation

The plugin generates shields.io-style SVG badges that display the review readiness score.

## Generating a Badge

### CLI

```bash
ios-app-review scan ./MyApp.xcodeproj --badge
```

This writes `badge.svg` to the current directory. When combined with `--output`, the badge is written next to the report file:

```bash
ios-app-review scan ./MyApp.xcodeproj --badge --output reports/review.json
# Creates reports/badge.svg
```

### MCP Tool

The `generate_report` tool does not directly produce a badge, but the CLI `--badge` flag calls the badge generator after the report is created.

## Badge Appearance

The badge has two sections:
- **Label** (left): "app review" in gray (`#555`)
- **Status** (right): score and pass/fail state, color-coded

### Color Rules

| Condition | Color | Hex |
|-----------|-------|-----|
| Passed, score >= 80 | Green | `#44cc11` |
| Passed, score >= 50 | Yellow | `#dfb317` |
| Passed, score < 50 | Red | `#e05d44` |
| Failed (any errors) | Red | `#e05d44` |

### Status Text

- Passing: `85/100`
- Failing: `fail 72/100`

### Example SVG Output

A passing badge with score 85 renders as:

```
[ app review | 85/100 ]
     gray      green
```

A failing badge with score 60 renders as:

```
[ app review | fail 60/100 ]
     gray         red
```

## Embedding in README

### Direct File Reference

```markdown
![App Review](./badge.svg)
```

### With Link to Report

```markdown
[![App Review](./badge.svg)](./reports/review.html)
```

### From CI Artifact

If your CI uploads the badge as an artifact, reference it from your repo's raw URL:

```markdown
![App Review](https://raw.githubusercontent.com/yourorg/yourapp/main/badge.svg)
```

## CI Integration

### GitHub Actions: Commit Badge Back to Repo

```yaml
      - name: Generate badge
        run: |
          ios-app-review scan ./MyApp.xcodeproj --badge --format json --output report.json

      - name: Commit badge
        run: |
          git config user.name "github-actions"
          git config user.email "github-actions@github.com"
          git add badge.svg
          git diff --staged --quiet || git commit -m "Update review badge [skip ci]"
          git push
```

### GitHub Actions: Upload as Artifact

```yaml
      - name: Upload badge
        uses: actions/upload-artifact@v4
        with:
          name: review-badge
          path: badge.svg
```

### Fastlane

```ruby
lane :update_badge do
  sh("ios-app-review scan ../MyApp.xcodeproj --badge")
  # badge.svg is created in the current directory
end
```

## Customization

The badge generator accepts an optional `label` parameter (used internally). The default label is "app review". The badge dimensions scale automatically based on label and status text length.

## SVG Details

- Font: Verdana, Geneva, DejaVu Sans
- Height: 20px
- Corner radius: 3px
- Includes ARIA attributes for accessibility (`role="img"`, `aria-label`)
- Uses `<linearGradient>` for subtle depth
- Shadow text offset for legibility
