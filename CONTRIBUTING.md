# Contributing to iOS App Store Review Plugin

Thank you for your interest in contributing! This document provides guidelines and information for contributors.

## Development Setup

### Prerequisites

- Node.js 18+
- npm or pnpm
- TypeScript knowledge
- Familiarity with MCP (Model Context Protocol)
- macOS recommended (for Xcode project testing)

### Getting Started

```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/ios-app-review-plugin.git
cd ios-app-review-plugin

# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Project Architecture

### Core Components

1. **MCP Server (`src/index.ts`)**: Entry point that exposes tools to Claude Code
2. **Analyzers (`src/analyzers/`)**: Individual analysis modules for different checks
3. **ASC Client (`src/asc/`)**: App Store Connect API integration
4. **Parsers (`src/parsers/`)**: Xcode project and plist file parsers
5. **Rules (`src/rules/`)**: App Store Guidelines rule definitions

### Adding a New Analyzer

1. Create a new file in `src/analyzers/`
2. Implement the `Analyzer` interface:

```typescript
interface Analyzer {
  name: string;
  description: string;
  analyze(projectPath: string): Promise<AnalysisResult>;
}

interface AnalysisResult {
  passed: boolean;
  issues: Issue[];
  warnings: Warning[];
}
```

3. Register the analyzer in `src/analyzers/index.ts`
4. Add tests in `tests/analyzers/`

### Adding New Guidelines

Guidelines are defined in `src/rules/guidelines.ts`:

```typescript
const guideline: Guideline = {
  id: "5.1.1",
  title: "Data Collection and Storage",
  description: "Apps that collect user data must have a privacy policy",
  severity: "error",
  check: async (context) => {
    // Implementation
  }
};
```

## Code Style

- Use TypeScript strict mode
- Follow ESLint configuration
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Keep functions small and focused

## Testing

### Unit Tests

```bash
npm test                 # Run all tests
npm test -- --watch      # Watch mode
npm test -- --coverage   # With coverage
```

### Test Structure

```
tests/
├── analyzers/
│   ├── info-plist.test.ts
│   └── privacy.test.ts
├── asc/
│   └── client.test.ts
├── fixtures/            # Sample Xcode projects for testing
│   ├── valid-app/
│   └── invalid-app/
└── integration/
    └── full-scan.test.ts
```

### Adding Fixtures

Place sample Xcode projects in `tests/fixtures/`. Include both valid and invalid examples to test detection capabilities.

## Pull Request Process

1. **Create an issue first** for significant changes
2. **Fork the repository** and create a feature branch
3. **Follow the branch naming convention**:
   - `feature/description` for new features
   - `fix/description` for bug fixes
   - `docs/description` for documentation
4. **Write tests** for new functionality
5. **Update documentation** as needed
6. **Submit a PR** with a clear description

### PR Checklist

- [ ] Tests pass (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Documentation updated
- [ ] CHANGELOG updated (for significant changes)

## Issue Guidelines

### Bug Reports

Include:
- iOS/Xcode version
- Plugin version
- Steps to reproduce
- Expected vs. actual behavior
- Sample project if possible

### Feature Requests

Include:
- Use case description
- Related App Store Guideline (if applicable)
- Proposed implementation (optional)

## Release Process

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Create a git tag: `git tag v1.0.0`
4. Push tag: `git push origin v1.0.0`
5. GitHub Actions will publish to npm

## Getting Help

- Open an issue for questions
- Join discussions in GitHub Discussions
- Check existing issues before creating new ones

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
