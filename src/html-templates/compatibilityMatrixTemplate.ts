export const compatibilityMatrixTemplate = (
	riskLevel: string,
	matrixHtml: string,
	issuesHtml: string,
	recommendationsHtml: string
): string => `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>License Compatibility Matrix</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            padding: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        .risk-level { 
            padding: 10px; 
            margin: 20px 0; 
            border-radius: 4px; 
            font-weight: bold;
        }
        .risk-low { background-color: #d4edda; color: #155724; }
        .risk-medium { background-color: #fff3cd; color: #856404; }
        .risk-high { background-color: #f8d7da; color: #721c24; }
        .compatibility-matrix { 
            border-collapse: collapse; 
            margin: 20px 0; 
            width: 100%;
        }
        .compatibility-matrix th, .compatibility-matrix td { 
            border: 1px solid var(--vscode-panel-border); 
            padding: 8px; 
            text-align: center; 
        }
        .compatibility-matrix th { 
            background-color: var(--vscode-button-background); 
            color: var(--vscode-button-foreground);
        }
        .compatible { background-color: #d4edda; color: #155724; }
        .incompatible { background-color: #f8d7da; color: #721c24; }
        .issues, .recommendations { margin: 20px 0; }
        .no-issues { color: #155724; font-weight: bold; margin: 20px 0; }
        ul { padding-left: 20px; }
        li { margin: 5px 0; }
    </style>
</head>
<body>
    <h1>License Compatibility Matrix</h1>
    <div class="risk-level risk-${riskLevel}">
        Risk Level: ${riskLevel.toUpperCase()}
    </div>
    ${matrixHtml}
    ${issuesHtml}
    ${recommendationsHtml}
</body>
</html>`;
