# Code Licenses

[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code-Marketplace-blue?style=for-the-badge&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=RustyDaemon.code-licenses)
![Beta](https://img.shields.io/badge/STATUS-BETA-orange?style=for-the-badge)

A Visual Studio Code extension that analyzes and displays license information for project dependencies across multiple programming languages and package managers.

> **⚠️ Beta Notice**: This extension is currently in beta. Always validate license information independently and use at your own risk. This tool provides guidance but should not be the sole source for legal compliance decisions.

<img width="444" alt="tree-view" src="https://github.com/user-attachments/assets/435f0370-b400-4125-bc73-ee6b90a04183" />


## 🚀 Key Features

### 🔍 Multi-language support

Automatically detects and analyzes dependencies across several programming languages:

| Language       | File detection                   | Registry source | Status           |
| -------------- | -------------------------------- | --------------- | ---------------- |
| **JavaScript** | `package.json`                   | npm registry    | ✅ Full Support  |
| **TypeScript** | `package.json` + `tsconfig.json` | npm registry    | ✅ Full Support  |
| **C#**         | `.csproj`, `packages.config`     | NuGet Gallery   | 🚧 Basic Support |
| **Rust**       | `Cargo.toml`                     | crates.io       | 🚧 Basic Support |
| **Go**         | `go.mod`                         | pkg.go.dev      | ✅ Full Support  |
| **Python**     | `requirements.txt`               | PyPI            | 🚧 Basic Support |

### Interactive dashboard

<img width="444" alt="report-dashboard" src="https://github.com/user-attachments/assets/fa96e9fa-f5c0-496a-88dc-0fe48ee1ca0b" />


- **Realtime statistics**: Project count, dependency totals, license distribution
- **Clean styling**: Clean, VS Code-themed interface
- **Multiple export formats**: JSON, CSV, HTML

### Smart tree view

<img width="444" alt="tree-view" src="https://github.com/user-attachments/assets/435f0370-b400-4125-bc73-ee6b90a04183" />

- **Simple organization mode**: Projects → Dependencies → License info
- **Interactive elements**: Click dependencies for detailed information
- **Context actions**: Right-click for license text

### License compatibility analysis

<img width="444" alt="compatibility-matrix" src="https://github.com/user-attachments/assets/12ed64e1-ab1a-4762-9556-35f96f25e232" />


- **Smart risk assessment**: Automatic risk level calculation (Low/Medium/High)
- **Visual compatibility matrix**: Interactive grid showing license interactions
- **Issue detection**: Identifies potential licensing conflicts with explanations
- **Export capabilities**: Save compatibility reports in JSON, CSV, or HTML

## Commands & Controls

| Command                                            | Description                     |
| -------------------------------------------------- | ------------------------------- |
| `Code Licenses: Scan Project Licenses`             | Scan workspace for dependencies |
| `Code Licenses: Open License Report Viewer`        | Launch interactive dashboard    |
| `Code Licenses: Show License Compatibility Matrix` | Analyze license compatibility   |
| `Code Licenses: View License Text`                 | Display full license text       |
| `Code Licenses: Export License Report`             | Export to file formats          |
| `Code Licenses: Show Cache Overview`               | Manage license cache            |
| `Code Licenses: Open Settings`                     | Access extension settings       |

## Caching & Performance

<img width="444" alt="cache-overview" src="https://github.com/user-attachments/assets/59c71940-7e10-4f3e-88df-ccee9a2dcb62" />


- **Smart caching**: Configurable cache duration (default: 24 hours)
- **Performance optimization**: Reduces API calls and improves response times
- **Cache management**: Overview window with statistics, export, and clear options
- **Persistent storage**: Cache survives VS Code restarts

## Installation & Quick start

### Installation options

1. **VS Code marketplace**: Install directly from VS Code Extensions panel
2. **Command line**: `code --install-extension RustyDaemon.code-licenses`
3. **Manual installation**: Download `.vsix` from GitHub releases

### Getting started

1. **Open a project**: Launch VS Code with a project containing dependency files
2. **Auto-detection**: Extension automatically detects supported project types
3. **Manual scan**: Use Command Palette (`Ctrl+Shift+P`) → "Code Licenses: Scan Project Licenses"
4. **Explore results**: Check "Project Licenses" panel in Explorer sidebar
5. **Generate reports**: Use "Open License Report Viewer" for comprehensive analysis

## Configuration

### Extension settings

| Setting                                 | Description               | Default | Type    |
| --------------------------------------- | ------------------------- | ------- | ------- |
| `codeLicenses.cache.enabled`            | Enable license caching    | `true`  | boolean |
| `codeLicenses.cache.maxAge`             | Cache duration in hours   | `24`    | number  |
| `codeLicenses.cache.maxSize`            | Maximum cache entries     | `1000`  | number  |
| `codeLicenses.display.groupByLicense`   | Default tree view mode    | `false` | boolean |
| `codeLicenses.display.showDescriptions` | Show package descriptions | `true`  | boolean |
| `codeLicenses.fetching.timeout`         | API request timeout (ms)  | `10000` | number  |
| `codeLicenses.fetching.retryAttempts`   | Failed request retries    | `3`     | number  |

### Workspace configuration

Create `.vscode/settings.json` in your workspace:

```json
{
	"codeLicenses.display.groupByLicense": true,
	"codeLicenses.cache.maxAge": 48,
	"codeLicenses.fetching.timeout": 15000
}
```

## Important legal notice

**This extension is provided for informational purposes only.** While I strive for accuracy:

- **Verify independently**: Always validate license information through official sources
- **Legal consultation**: Consult legal professionals for compliance decisions
- **No warranty**: Extension provided "as-is" without warranties
- **User responsibility**: Users assume full responsibility for license compliance

## License

This extension is licensed under the [MIT License](LICENSE).
