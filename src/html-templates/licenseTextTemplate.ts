export const licenseTextTemplate = (
	licenseName: string,
	licenseText: string
): string => `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>License Text: ${licenseName}</title>
    <style>
        body { 
            font-family: 'Courier New', monospace; 
            padding: 20px; 
            line-height: 1.6;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        .license-header {
            background-color: var(--vscode-textBlockQuote-background);
            padding: 15px;
            border-left: 4px solid var(--vscode-textBlockQuote-border);
            margin-bottom: 20px;
        }
        .license-text {
            white-space: pre-wrap;
            background-color: var(--vscode-textCodeBlock-background);
            padding: 20px;
            border-radius: 4px;
            border: 1px solid var(--vscode-panel-border);
        }
    </style>
</head>
<body>
    <div class="license-header">
        <h1>${licenseName}</h1>
        <p>Full license text as retrieved from official sources</p>
    </div>
    <div class="license-text">${licenseText}</div>
</body>
</html>`;
