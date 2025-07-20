import * as vscode from 'vscode';
import { ConfigurationManager } from './configurationManager';
import { DependencyScanner } from './dependencyScanner';
import { LicenseAnalyzer } from './licenseAnalyzer';
import { LicenseCache } from './licenseCache';
import { LicenseCompatibilityAnalyzer } from './licenseCompatibilityAnalyzer';
import { LicenseReportExporter } from './licenseReportExporter';
import { LicenseReportViewer } from './licenseReportViewer';
import { LicenseTextFetcher } from './licenseTextFetcher';
import { LicenseTreeItem, LicenseTreeProvider } from './licenseTreeProvider';
import { ProjectDetector } from './projectDetector';
import { ProjectInfo } from './types';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('Code Licenses extension is now active!');

	// Initialize cache with persistent storage
	LicenseCache.init(context);

	// Initialize services
	const projectDetector = new ProjectDetector();
	const dependencyScanner = new DependencyScanner();
	const licenseAnalyzer = new LicenseAnalyzer();
	const licenseTreeProvider = new LicenseTreeProvider();
	const reportExporter = new LicenseReportExporter();

	// Register tree data provider
	const treeView = vscode.window.createTreeView('codeLicensesView', {
		treeDataProvider: licenseTreeProvider,
		showCollapseAll: true,
	});

	context.subscriptions.push(treeView);

	// Command: Scan Project Licenses
	const scanCommand = vscode.commands.registerCommand(
		'code-licenses.scanLicenses',
		async () => {
			await scanProjectLicenses();
		}
	);

	// Command: Refresh License Information
	const refreshCommand = vscode.commands.registerCommand(
		'code-licenses.refreshLicenses',
		async () => {
			await scanProjectLicenses();
		}
	);

	// Command: Export License Report
	const exportCommand = vscode.commands.registerCommand(
		'code-licenses.exportLicenses',
		async () => {
			const format = await vscode.window.showQuickPick(
				['JSON', 'CSV', 'HTML'],
				{
					placeHolder: 'Select export format',
				}
			);

			if (format) {
				const projects = await getCurrentProjects();
				await reportExporter.exportReport(
					projects,
					format.toLowerCase() as 'json' | 'csv' | 'html'
				);
			}
		}
	);

	// Command: Show License Details
	const showDetailsCommand = vscode.commands.registerCommand(
		'code-licenses.showLicenseDetails',
		(item: LicenseTreeItem) => {
			showLicenseDetails(item);
		}
	);

	// Command: Open Report Viewer
	const openReportViewerCommand = vscode.commands.registerCommand(
		'code-licenses.openReportViewer',
		async () => {
			const projects = await getCurrentProjects();
			if (projects.length === 0) {
				vscode.window.showInformationMessage(
					'No license data available. Please scan your project first.'
				);
				return;
			}
			LicenseReportViewer.createOrShow(projects, context.extensionUri);
		}
	);

	// Command: License Compatibility Matrix
	const compatibilityMatrixCommand = vscode.commands.registerCommand(
		'code-licenses.showCompatibilityMatrix',
		async () => {
			const projects = await getCurrentProjects();
			if (projects.length === 0) {
				vscode.window.showInformationMessage(
					'No license data available. Please scan your project first.'
				);
				return;
			}
			showCompatibilityMatrix(projects);
		}
	);

	// Command: Show License Text
	const showLicenseTextCommand = vscode.commands.registerCommand(
		'code-licenses.showLicenseText',
		async (item?: LicenseTreeItem) => {
			let licenseName: string | undefined;

			if (item && item.itemType === 'license') {
				licenseName = item.label.split(' (')[0];
			} else {
				// Show quick pick for license selection
				const projects = await getCurrentProjects();
				const allLicenses = new Set<string>();
				projects.forEach(project =>
					project.dependencies.forEach(dep => allLicenses.add(dep.license))
				);

				licenseName = await vscode.window.showQuickPick(
					Array.from(allLicenses),
					{ placeHolder: 'Select a license to view its full text' }
				);
			}

			if (licenseName) {
				await showLicenseText(licenseName);
			}
		}
	);

	// Command: Open Settings
	// Command: Open Settings
	const openSettingsCommand = vscode.commands.registerCommand(
		'code-licenses.openSettings',
		() => {
			vscode.commands.executeCommand(
				'workbench.action.openSettings',
				'codeLicenses'
			);
		}
	);

	// Command: Show Cache Overview
	const showCacheOverviewCommand = vscode.commands.registerCommand(
		'code-licenses.showCacheOverview',
		() => {
			showCacheOverview();
		}
	);

	// Command: Show Dependency Info
	const showDependencyInfoCommand = vscode.commands.registerCommand(
		'code-licenses.showDependencyInfo',
		(item: LicenseTreeItem) => {
			showDependencyInfo(item);
		}
	);

	// Command: Clear Cache
	const clearCacheCommand = vscode.commands.registerCommand(
		'code-licenses.clearCache',
		() => {
			clearCache();
		}
	);

	context.subscriptions.push(
		scanCommand,
		refreshCommand,
		exportCommand,
		showDetailsCommand,
		openReportViewerCommand,
		compatibilityMatrixCommand,
		showLicenseTextCommand,
		openSettingsCommand,
		showCacheOverviewCommand,
		showDependencyInfoCommand,
		clearCacheCommand
	);

	// Auto-scan on activation if workspace exists
	if (
		vscode.workspace.workspaceFolders &&
		vscode.workspace.workspaceFolders.length > 0
	) {
		scanProjectLicenses();
	}

	// Store projects for export functionality
	let currentProjects: ProjectInfo[] = [];

	async function getCurrentProjects(): Promise<ProjectInfo[]> {
		return currentProjects;
	}

	async function scanProjectLicenses(): Promise<void> {
		try {
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (!workspaceFolder) {
				vscode.window.showErrorMessage('No workspace folder found');
				return;
			}

			// Show progress
			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: 'Scanning project licenses...',
					cancellable: false,
				},
				async progress => {
					progress.report({ increment: 0, message: 'Detecting projects...' });

					// Detect projects
					const projects = await projectDetector.detectProjects(
						workspaceFolder.uri.fsPath
					);

					if (projects.length === 0) {
						vscode.window.showInformationMessage(
							'No supported projects found in workspace'
						);
						return;
					}

					progress.report({
						increment: 25,
						message: 'Scanning dependencies...',
					});

					// Scan dependencies for each project
					for (const project of projects) {
						const dependencies = await dependencyScanner.scanDependencies(
							project
						);
						project.dependencies = dependencies;
					}

					progress.report({ increment: 50, message: 'Analyzing licenses...' });

					// Analyze licenses
					for (const project of projects) {
						project.dependencies = await licenseAnalyzer.analyzeLicenses(
							project.dependencies,
							project.type
						);
					}

					progress.report({ increment: 100, message: 'Complete!' });

					// Update tree view
					currentProjects = projects;
					licenseTreeProvider.updateProjects(projects);

					// Show summary
					const totalDeps = projects.reduce(
						(sum, p) => sum + p.dependencies.length,
						0
					);
					const totalLicenses = new Set();
					projects.forEach(p =>
						p.dependencies.forEach(d => totalLicenses.add(d.license))
					);

					vscode.window.showInformationMessage(
						`Found ${projects.length} project(s) with ${totalDeps} dependencies using ${totalLicenses.size} different licenses`
					);
				}
			);
		} catch (error) {
			console.error('Error scanning project licenses:', error);
			vscode.window.showErrorMessage(`Error scanning licenses: ${error}`);
		}
	}

	function showLicenseDetails(item: LicenseTreeItem): void {
		if (item.itemType === 'license' && item.dependencies) {
			const dependencies = item.dependencies;
			const licenseName = item.label.split(' (')[0]; // Remove count from label

			const panel = vscode.window.createWebviewPanel(
				'licenseDetails',
				`License Details: ${licenseName}`,
				vscode.ViewColumn.One,
				{
					enableScripts: true,
				}
			);

			panel.webview.html = generateLicenseDetailsHtml(
				licenseName,
				dependencies
			);
		}
	}

	function generateLicenseDetailsHtml(
		licenseName: string,
		dependencies: any[]
	): string {
		const dependencyRows = dependencies
			.map(
				dep => `
			<tr>
				<td>${dep.name}</td>
				<td>${dep.version}</td>
				<td>${
					dep.repository
						? `<a href="${dep.repository}" target="_blank">Repository</a>`
						: '-'
				}</td>
				<td>${
					dep.homepage
						? `<a href="${dep.homepage}" target="_blank">Homepage</a>`
						: '-'
				}</td>
			</tr>
		`
			)
			.join('');

		return `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="UTF-8">
				<title>License Details</title>
				<style>
					body { font-family: Arial, sans-serif; padding: 20px; }
					table { border-collapse: collapse; width: 100%; }
					th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
					th { background-color: #f2f2f2; }
					h1 { color: #333; }
				</style>
			</head>
			<body>
				<h1>License: ${licenseName}</h1>
				<p><strong>Dependencies using this license:</strong> ${dependencies.length}</p>
				
				<table>
					<thead>
						<tr>
							<th>Package Name</th>
							<th>Version</th>
							<th>Repository</th>
							<th>Homepage</th>
						</tr>
					</thead>
					<tbody>
						${dependencyRows}
					</tbody>
				</table>
			</body>
			</html>
		`;
	}

	async function showCompatibilityMatrix(
		projects: ProjectInfo[]
	): Promise<void> {
		const allLicenses = projects.flatMap(p =>
			p.dependencies.map(d => d.license)
		);
		const analysis =
			LicenseCompatibilityAnalyzer.analyzeProjectCompatibility(allLicenses);

		const panel = vscode.window.createWebviewPanel(
			'licenseCompatibility',
			'License Compatibility Matrix',
			vscode.ViewColumn.One,
			{ enableScripts: true }
		);

		const compatibilityHtml = generateCompatibilityMatrixHtml(
			analysis,
			allLicenses
		);
		panel.webview.html = compatibilityHtml;

		// Handle export requests from webview
		panel.webview.onDidReceiveMessage(async message => {
			switch (message.command) {
				case 'exportMatrix':
					await exportCompatibilityMatrix(
						analysis,
						allLicenses,
						message.format
					);
					break;
			}
		});

		// Show warnings for compatibility issues
		const config = ConfigurationManager.getCompatibilityConfig();
		if (config.showWarnings && analysis.issues.length > 0) {
			const message = `Found ${analysis.issues.length} license compatibility issues`;
			const action = await vscode.window.showWarningMessage(
				message,
				'View Details',
				'Dismiss'
			);

			if (action === 'View Details') {
				panel.reveal();
			}
		}
	}

	async function showLicenseText(licenseName: string): Promise<void> {
		try {
			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: `Fetching license text for ${licenseName}...`,
					cancellable: false,
				},
				async () => {
					const licenseText = await LicenseTextFetcher.fetchLicenseText(
						licenseName
					);

					const panel = vscode.window.createWebviewPanel(
						'licenseText',
						`License Text: ${licenseName}`,
						vscode.ViewColumn.One,
						{ enableScripts: false }
					);

					panel.webview.html = generateLicenseTextHtml(
						licenseName,
						licenseText
					);
				}
			);
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to fetch license text: ${error}`);
		}
	}

	function generateCompatibilityMatrixHtml(
		analysis: { compatible: boolean; issues: any[]; matrix: any[][] },
		allLicenses: string[]
	): string {
		const uniqueLicenses = Array.from(new Set(allLicenses));
		const riskLevel = LicenseCompatibilityAnalyzer.getRiskLevel(allLicenses);
		const recommendations =
			LicenseCompatibilityAnalyzer.getRecommendations(allLicenses);

		let matrixHtml = '<table class="compatibility-matrix"><thead><tr><th></th>';
		uniqueLicenses.forEach(license => {
			matrixHtml += `<th>${license}</th>`;
		});
		matrixHtml += '</tr></thead><tbody>';

		analysis.matrix.forEach((row, i) => {
			matrixHtml += `<tr><th>${uniqueLicenses[i]}</th>`;
			row.forEach(cell => {
				const cellClass = cell.compatible ? 'compatible' : 'incompatible';
				const title = cell.reason || '';
				matrixHtml += `<td class="${cellClass}" title="${title}">${
					cell.compatible ? '✓' : '✗'
				}</td>`;
			});
			matrixHtml += '</tr>';
		});
		matrixHtml += '</tbody></table>';

		const issuesHtml =
			analysis.issues.length > 0
				? `<div class="issues">
				<h3>Compatibility Issues:</h3>
				<ul>${analysis.issues
					.map(
						issue =>
							`<li><strong>${issue.license1}</strong> ↔ <strong>${
								issue.license2
							}</strong>: ${issue.reason || 'Potentially incompatible'}</li>`
					)
					.join('')}</ul>
			</div>`
				: '<div class="no-issues">✓ No compatibility issues found</div>';

		const recommendationsHtml =
			recommendations.length > 0
				? `<div class="recommendations">
				<h3>Recommendations:</h3>
				<ul>${recommendations.map(rec => `<li>${rec}</li>`).join('')}</ul>
			</div>`
				: '';

		return `<!DOCTYPE html>
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
        .export-buttons { margin: 20px 0; display: flex; gap: 10px; }
        .export-btn { 
            padding: 8px 16px; 
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none; 
            border-radius: 3px; 
            cursor: pointer; 
        }
        .export-btn:hover { background: var(--vscode-button-hoverBackground); }
    </style>
</head>
<body>
    <h1>License Compatibility Matrix</h1>
    
    <div class="export-buttons">
        <button class="export-btn" onclick="exportMatrix('json')">📄 Export JSON</button>
        <button class="export-btn" onclick="exportMatrix('csv')">📊 Export CSV</button>
        <button class="export-btn" onclick="exportMatrix('html')">🌐 Export HTML</button>
    </div>
    
    <div class="risk-level risk-${riskLevel}">
        Risk Level: ${riskLevel.toUpperCase()}
    </div>
    ${matrixHtml}
    ${issuesHtml}
    ${recommendationsHtml}
    
    <script>
        const vscode = acquireVsCodeApi();
        
        function exportMatrix(format) {
            vscode.postMessage({
                command: 'exportMatrix',
                format: format
            });
        }
    </script>
</body>
</html>`;
	}

	/**
	 * Export compatibility matrix to file
	 */
	async function exportCompatibilityMatrix(
		analysis: { compatible: boolean; issues: any[]; matrix: any[][] },
		allLicenses: string[],
		format: string
	): Promise<void> {
		try {
			const timestamp = new Date().toISOString().split('T')[0];
			const saveUri = await vscode.window.showSaveDialog({
				defaultUri: vscode.Uri.file(
					`compatibility-matrix-${timestamp}.${format}`
				),
				filters: {
					[format.toUpperCase()]: [format],
					'All Files': ['*'],
				},
			});

			if (!saveUri) {
				return; // User cancelled
			}

			let content = '';
			const uniqueLicenses = Array.from(new Set(allLicenses));
			const riskLevel = LicenseCompatibilityAnalyzer.getRiskLevel(allLicenses);

			switch (format.toLowerCase()) {
				case 'json':
					content = JSON.stringify(
						{
							timestamp: new Date().toISOString(),
							riskLevel,
							licenses: uniqueLicenses,
							compatible: analysis.compatible,
							issues: analysis.issues,
							matrix: analysis.matrix,
						},
						null,
						2
					);
					break;

				case 'html':
					content = generateCompatibilityMatrixHtml(analysis, allLicenses);
					break;

				case 'csv':
					// CSV header
					content = 'License1,License2,Compatible,Reason\n';

					// Matrix data
					for (let i = 0; i < analysis.matrix.length; i++) {
						for (let j = 0; j < analysis.matrix[i].length; j++) {
							const cell = analysis.matrix[i][j];
							const escapedReason = (cell.reason || '').replace(/"/g, '""');
							content += `${uniqueLicenses[i]},${uniqueLicenses[j]},${
								cell.compatible ? 'Yes' : 'No'
							},"${escapedReason}"\n`;
						}
					}
					break;

				default:
					throw new Error(`Unsupported format: ${format}`);
			}

			const fs = require('fs');
			fs.writeFileSync(saveUri.fsPath, content, 'utf8');

			vscode.window.showInformationMessage(
				`Compatibility matrix exported to ${saveUri.fsPath.split('/').pop()}`
			);
		} catch (error) {
			console.error('Export error:', error);
			vscode.window.showErrorMessage(
				`Failed to export compatibility matrix: ${
					error instanceof Error ? error.message : 'Unknown error'
				}`
			);
		}
	}
}

/**
 * Clear the license cache
 */
function clearCache(): void {
	vscode.window
		.showWarningMessage(
			'Are you sure you want to clear all cached license data? This cannot be undone.',
			'Clear Cache',
			'Cancel'
		)
		.then(choice => {
			if (choice === 'Clear Cache') {
				try {
					LicenseCache.clearAll();
					vscode.window.showInformationMessage(
						'License cache cleared successfully!'
					);
				} catch (error) {
					vscode.window.showErrorMessage(
						`Failed to clear cache: ${
							error instanceof Error ? error.message : 'Unknown error'
						}`
					);
				}
			}
		});
}

/**
 * Export cache data to a file
 */
async function exportCacheData(cacheData: any): Promise<void> {
	try {
		const saveUri = await vscode.window.showSaveDialog({
			defaultUri: vscode.Uri.file(
				`license-cache-export-${new Date().toISOString().split('T')[0]}.json`
			),
			filters: {
				JSON: ['json'],
				'All Files': ['*'],
			},
		});

		if (!saveUri) {
			return; // User cancelled
		}

		const fs = require('fs');
		const exportData = {
			exportedAt: new Date().toISOString(),
			stats: LicenseCache.getStats(),
			data: cacheData,
		};

		fs.writeFileSync(
			saveUri.fsPath,
			JSON.stringify(exportData, null, 2),
			'utf8'
		);
		vscode.window.showInformationMessage(
			`Cache data exported to ${saveUri.fsPath.split('/').pop()}`
		);
	} catch (error) {
		vscode.window.showErrorMessage(
			`Failed to export cache data: ${
				error instanceof Error ? error.message : 'Unknown error'
			}`
		);
	}
}

function generateLicenseTextHtml(
	licenseName: string,
	licenseText: string
): string {
	return `<!DOCTYPE html>
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
}

/**
 * Show cache overview in a webview
 */
function showCacheOverview(): void {
	try {
		const stats = LicenseCache.getStats();
		const cacheData = LicenseCache.exportCacheData();

		const panel = vscode.window.createWebviewPanel(
			'cacheOverview',
			'License Cache Overview',
			vscode.ViewColumn.One,
			{ enableScripts: true }
		);

		panel.webview.html = generateCacheOverviewHtml(stats, cacheData);

		// Handle messages from webview
		panel.webview.onDidReceiveMessage(async message => {
			switch (message.command) {
				case 'clearCache':
					clearCache();
					// Refresh the webview after clearing
					setTimeout(() => {
						const newStats = LicenseCache.getStats();
						const newCacheData = LicenseCache.exportCacheData();
						panel.webview.html = generateCacheOverviewHtml(
							newStats,
							newCacheData
						);
					}, 1000);
					break;
				case 'exportCache':
					await exportCacheData(cacheData);
					break;
			}
		});
	} catch (error) {
		vscode.window.showErrorMessage(
			`Failed to show cache overview: ${
				error instanceof Error ? error.message : 'Unknown error'
			}`
		);
	}
}

function generateCacheOverviewHtml(stats: any, cacheData: any): string {
	const memoryMB = (stats.totalMemoryUsage / (1024 * 1024)).toFixed(2);
	const oldestAge = stats.oldestEntry
		? Math.round((Date.now() - stats.oldestEntry.getTime()) / (1000 * 60 * 60))
		: 0;
	const newestAge = stats.newestEntry
		? Math.round((Date.now() - stats.newestEntry.getTime()) / (1000 * 60))
		: 0;

	return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>License Cache Overview</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            padding: 20px;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: var(--vscode-editor-inactiveSelectionBackground);
            padding: 15px;
            border-radius: 5px;
            border: 1px solid var(--vscode-panel-border);
            text-align: center;
        }
        .stat-number {
            font-size: 2em;
            font-weight: bold;
            color: var(--vscode-charts-blue);
        }
        .stat-label {
            color: var(--vscode-descriptionForeground);
            margin-top: 5px;
        }
        .action-buttons {
            margin: 20px 0;
            display: flex;
            gap: 10px;
            justify-content: center;
        }
        .action-btn {
            padding: 10px 20px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 14px;
        }
        .action-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .danger-btn {
            background: var(--vscode-errorForeground);
            color: var(--vscode-editor-background);
        }
        .section {
            margin: 30px 0;
        }
        .section h2 {
            color: var(--vscode-charts-blue);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 5px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            background: var(--vscode-editor-background);
        }
        th, td {
            padding: 8px 12px;
            text-align: left;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        th {
            background: var(--vscode-editor-inactiveSelectionBackground);
            font-weight: 600;
        }
        tr:hover {
            background: var(--vscode-list-hoverBackground);
        }
        .cache-entry {
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🗄️ License Cache Overview</h1>
        <p>Detailed view of cached license data and performance metrics</p>
    </div>

    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-number">${stats.licenseInfoEntries}</div>
            <div class="stat-label">License Info Entries</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.licenseTextEntries}</div>
            <div class="stat-label">License Text Entries</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${memoryMB}</div>
            <div class="stat-label">Memory Usage (MB)</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${oldestAge}h</div>
            <div class="stat-label">Oldest Entry Age</div>
        </div>
    </div>

    <div class="action-buttons">
        <button class="action-btn" onclick="exportCache()">📋 Export Cache Data</button>
        <button class="action-btn danger-btn" onclick="clearCache()">🗑️ Clear All Cache</button>
    </div>

    <div class="section">
        <h2>📦 License Info Cache</h2>
        <table>
            <thead>
                <tr>
                    <th>Package</th>
                    <th>License</th>
                    <th>Age</th>
                    <th>Project Type</th>
                </tr>
            </thead>
            <tbody>
                ${cacheData.licenseInfo
									.slice(0, 50)
									.map(
										(entry: any) => `
                <tr class="cache-entry">
                    <td>${entry.key.split(':').slice(1, -1).join(':')}</td>
                    <td>${entry.data.license || 'Unknown'}</td>
                    <td>${Math.round(entry.age / (1000 * 60 * 60))}h ago</td>
                    <td>${entry.projectType}</td>
                </tr>
                `
									)
									.join('')}
                ${
									cacheData.licenseInfo.length > 50
										? `
                <tr>
                    <td colspan="4" style="text-align: center; color: var(--vscode-descriptionForeground);">
                        ... and ${
													cacheData.licenseInfo.length - 50
												} more entries
                    </td>
                </tr>
                `
										: ''
								}
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>📄 License Text Cache</h2>
        <table>
            <thead>
                <tr>
                    <th>License Name</th>
                    <th>Text Length</th>
                    <th>Age</th>
                    <th>Source</th>
                </tr>
            </thead>
            <tbody>
                ${cacheData.licenseText
									.slice(0, 20)
									.map(
										(entry: any) => `
                <tr class="cache-entry">
                    <td>${entry.licenseName}</td>
                    <td>${entry.textLength} chars</td>
                    <td>${Math.round(entry.age / (1000 * 60 * 60))}h ago</td>
                    <td>${entry.source || 'Unknown'}</td>
                </tr>
                `
									)
									.join('')}
                ${
									cacheData.licenseText.length > 20
										? `
                <tr>
                    <td colspan="4" style="text-align: center; color: var(--vscode-descriptionForeground);">
                        ... and ${
													cacheData.licenseText.length - 20
												} more entries
                    </td>
                </tr>
                `
										: ''
								}
            </tbody>
        </table>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        function exportCache() {
            vscode.postMessage({ command: 'exportCache' });
        }
        
        function clearCache() {
            if (confirm('Are you sure you want to clear all cached license data? This cannot be undone.')) {
                vscode.postMessage({ command: 'clearCache' });
            }
        }
    </script>
</body>
</html>`;
}

/**
 * Show dependency information in a webview
 */
function showDependencyInfo(item: LicenseTreeItem): void {
	try {
		const panel = vscode.window.createWebviewPanel(
			'dependencyInfo',
			`Dependency: ${item.label}`,
			vscode.ViewColumn.Beside,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
			}
		);

		panel.webview.html = generateDependencyInfoHtml(item);
	} catch (error) {
		vscode.window.showErrorMessage(
			`Failed to show dependency info: ${
				error instanceof Error ? error.message : 'Unknown error'
			}`
		);
	}
}

function generateDependencyInfoHtml(item: LicenseTreeItem): string {
	// Extract dependency information from the tree item
	const dependency = {
		name: item.dependency?.name || item.label || 'Unknown Dependency',
		version: item.dependency?.version || 'Not available',
		license: item.dependency?.license || 'Not available',
		path: item.resourceUri?.fsPath || undefined,
		// These would come from package.json or similar metadata if available
		description: item.dependency?.description || 'Dependency information',
		homepage: item.dependency?.homepage || undefined,
		repository: item.dependency?.repository || undefined,
		author: undefined,
		licenses: undefined,
	};

	return `
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Dependency Information</title>
			<style>
				body { 
					font-family: var(--vscode-font-family);
					margin: 0;
					padding: 20px;
					background: var(--vscode-editor-background);
					color: var(--vscode-editor-foreground);
					line-height: 1.6;
				}
				.header {
					border-bottom: 2px solid var(--vscode-button-background);
					padding-bottom: 15px;
					margin-bottom: 25px;
				}
				.title {
					font-size: 24px;
					font-weight: 600;
					color: var(--vscode-button-background);
					margin: 0;
				}
				.subtitle {
					font-size: 14px;
					color: var(--vscode-descriptionForeground);
					margin: 5px 0 0 0;
				}
				.info-section {
					background: var(--vscode-editor-inactiveSelectionBackground);
					border-left: 4px solid var(--vscode-button-background);
					padding: 20px;
					margin: 15px 0;
					border-radius: 4px;
				}
				.info-label {
					font-weight: 600;
					color: var(--vscode-button-background);
					margin-bottom: 8px;
				}
				.info-value {
					color: var(--vscode-editor-foreground);
					word-break: break-all;
				}
				.license-info {
					background: var(--vscode-textBlockQuote-background);
					padding: 15px;
					margin: 10px 0;
					border-radius: 4px;
					border-left: 3px solid var(--vscode-charts-blue);
				}
				.no-info {
					color: var(--vscode-descriptionForeground);
					font-style: italic;
				}
				a {
					color: var(--vscode-textLink-foreground);
					text-decoration: none;
				}
				a:hover {
					text-decoration: underline;
				}
				.footer {
					margin-top: 40px;
					padding-top: 20px;
					border-top: 1px solid var(--vscode-panel-border);
					text-align: center;
					font-size: 12px;
					color: var(--vscode-descriptionForeground);
				}
			</style>
		</head>
		<body>
			<div class="header">
				<h1 class="title">${dependency.name || 'Unknown Dependency'}</h1>
				<p class="subtitle">${dependency.description || 'Dependency Information'}</p>
			</div>

			<div class="info-section">
				<div class="info-label">Package Name:</div>
				<div class="info-value">${dependency.name || 'Not available'}</div>
			</div>

			<div class="info-section">
				<div class="info-label">Version:</div>
				<div class="info-value">${dependency.version || 'Not available'}</div>
			</div>

			<div class="info-section">
				<div class="info-label">License:</div>
				<div class="info-value">${dependency.license || 'Not available'}</div>
			</div>

			${
				dependency.path
					? `
							<div class="info-section">
				<div class="info-label">File Path:</div>
				<div class="info-value">${dependency.path || 'Not available'}</div>
			</div>
				`
					: ''
			}

			${
				dependency.homepage
					? `
			<div class="info-section">
				<div class="info-label">Homepage:</div>
				<div class="info-value"><a href="${dependency.homepage}" target="_blank">${dependency.homepage}</a></div>
			</div>
			`
					: ''
			}

			${
				dependency.repository
					? `
			<div class="info-section">
				<div class="info-label">Repository:</div>
				<div class="info-value"><a href="${dependency.repository}" target="_blank">${dependency.repository}</a></div>
			</div>
			`
					: ''
			}

			${
				dependency.author
					? `
			<div class="info-section">
				<div class="info-label">Author:</div>
				<div class="info-value">${dependency.author}</div>
			</div>
			`
					: ''
			}

			<div class="footer">
				Created with ❤️ by <a href="https://github.com/RustyDaemon" target="_blank">RustyDaemon</a>
			</div>
		</body>
		</html>
	`;
}

// This method is called when your extension is deactivated
export function deactivate() {}
