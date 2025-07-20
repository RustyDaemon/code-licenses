import * as vscode from 'vscode';
import { ProjectInfo } from './types';
import { DateTimeUtils } from './utils/dateTimeUtils';

export class LicenseReportViewer {
	private static currentPanel: vscode.WebviewPanel | undefined;

	public static createOrShow(
		projects: ProjectInfo[],
		extensionUri: vscode.Uri
	): void {
		const column = vscode.window.activeTextEditor
			? vscode.ViewColumn.Beside
			: vscode.ViewColumn.One;

		if (LicenseReportViewer.currentPanel) {
			LicenseReportViewer.currentPanel.reveal(column);
			LicenseReportViewer.currentPanel.webview.html =
				this.getWebviewContent(projects);
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			'licenseReport',
			'License Report',
			column,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
			}
		);

		LicenseReportViewer.currentPanel = panel;
		panel.webview.html = this.getWebviewContent(projects);

		panel.onDidDispose(() => {
			LicenseReportViewer.currentPanel = undefined;
		}, null);

		// Handle messages from webview
		panel.webview.onDidReceiveMessage(async message => {
			switch (message.command) {
				case 'exportData':
					this.exportData(projects, message.format);
					return;
				case 'showLicenseText':
					// Show license text directly by calling the internal function
					try {
						await vscode.commands.executeCommand(
							'code-licenses.showLicenseText',
							{
								itemType: 'license' as const,
								label: message.licenseName,
							}
						);
					} catch (error) {
						console.error('Error showing license text:', error);
						vscode.window.showErrorMessage(
							`Failed to show license text: ${error}`
						);
					}
					return;
			}
		});
	}

	private static getWebviewContent(projects: ProjectInfo[]): string {
		const totalDeps = projects.reduce(
			(sum, p) => sum + p.dependencies.length,
			0
		);
		const allLicenses = new Set<string>();
		const licenseCounts: Record<string, number> = {};
		const projectTypeCounts: Record<string, number> = {};

		projects.forEach(project => {
			projectTypeCounts[project.type] =
				(projectTypeCounts[project.type] || 0) + 1;
			project.dependencies.forEach(dep => {
				const license = dep.license || 'Unknown';
				allLicenses.add(license);
				licenseCounts[license] = (licenseCounts[license] || 0) + 1;
			});
		});

		return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>License Report</title>
    <style>
        body { 
            font-family: var(--vscode-font-family); 
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            padding: 20px; 
        }
        .header { margin-bottom: 30px; }
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
        }
        .stat-number { font-size: 2em; font-weight: bold; color: var(--vscode-charts-blue); }
        .stat-label { color: var(--vscode-descriptionForeground); }
        
        .export-buttons { margin-bottom: 20px; display: flex; gap: 10px; }
        .export-btn { 
            padding: 8px 16px; 
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none; 
            border-radius: 3px; 
            cursor: pointer; 
        }
        .export-btn:hover { background: var(--vscode-button-hoverBackground); }
        
        .section { margin-bottom: 30px; }
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
        tr:hover { background: var(--vscode-list-hoverBackground); }
        
        .license-mit { color: var(--vscode-charts-green); }
        .license-apache { color: var(--vscode-charts-green); }
        .license-bsd { color: var(--vscode-charts-green); }
        .license-gpl { color: var(--vscode-charts-orange); }
        .license-unknown { color: var(--vscode-charts-gray); }
        
        .chart-container { 
            background: var(--vscode-editor-inactiveSelectionBackground);
            padding: 15px; 
            border-radius: 5px; 
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🏛️ License Report</h1>
        <p>Generated on: ${DateTimeUtils.formatDateTime(new Date())}</p>
    </div>

    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-number">${projects.length}</div>
            <div class="stat-label">Projects</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${totalDeps}</div>
            <div class="stat-label">Total Dependencies</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${allLicenses.size}</div>
            <div class="stat-label">Unique Licenses</div>
        </div>
    </div>

    <div class="export-buttons">
        <button class="export-btn" onclick="exportData('json')">📄 Export JSON</button>
        <button class="export-btn" onclick="exportData('csv')">📊 Export CSV</button>
        <button class="export-btn" onclick="exportData('html')">🌐 Export HTML</button>
    </div>

    <div class="section">
        <h2>📊 License Distribution</h2>
        <div class="chart-container">
            <table>
                <thead>
                    <tr><th>License</th><th>Count</th><th>Percentage</th></tr>
                </thead>
                <tbody>
                    ${Object.entries(licenseCounts)
											.sort(([, a], [, b]) => b - a)
											.map(([license, count]) => {
												const percentage = ((count / totalDeps) * 100).toFixed(
													1
												);
												const licenseClass = this.getLicenseClass(license);
												return `<tr>
                                <td class="${licenseClass}"><a href="#" onclick="showLicenseText('${license.replace(
													/'/g,
													"\\'"
												)}'); return false;" style="color: inherit; text-decoration: underline; cursor: pointer;">${license}</a></td>
                                <td>${count}</td>
                                <td>${percentage}%</td>
                            </tr>`;
											})
											.join('')}
                </tbody>
            </table>
        </div>
    </div>

    <div class="section">
        <h2>📦 Project Types</h2>
        <div class="chart-container">
            <table>
                <thead>
                    <tr><th>Type</th><th>Count</th></tr>
                </thead>
                <tbody>
                    ${Object.entries(projectTypeCounts)
											.map(
												([type, count]) =>
													`<tr><td>${type}</td><td>${count}</td></tr>`
											)
											.join('')}
                </tbody>
            </table>
        </div>
    </div>

    <div class="section">
        <h2>📋 All Dependencies</h2>
        <table id="dependenciesTable">
            <thead>
                <tr>
                    <th>Project</th>
                    <th>Package</th>
                    <th>Version</th>
                    <th>License</th>
                    <th>Repository</th>
                </tr>
            </thead>
            <tbody>
                ${projects
									.map(project =>
										project.dependencies
											.map(dep => {
												const licenseClass = this.getLicenseClass(dep.license);
												return `<tr class="dependency-row" data-project="${
													project.name
												}" data-license="${dep.license}">
                            <td>${project.name}</td>
                            <td>${dep.name}</td>
                            <td>${dep.version}</td>
                            <td class="${licenseClass}"><a href="#" onclick="showLicenseText('${dep.license.replace(
													/'/g,
													"\\'"
												)}'); return false;" style="color: inherit; text-decoration: underline; cursor: pointer;">${
													dep.license
												}</a></td>
                            <td>${
															dep.repository
																? `<a href="${dep.repository}" target="_blank">🔗</a>`
																: '-'
														}</td>
                        </tr>`;
											})
											.join('')
									)
									.join('')}
            </tbody>
        </table>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        function exportData(format) {
            vscode.postMessage({
                command: 'exportData',
                format: format
            });
        }

        // Function to show license text - make it global
        window.showLicenseText = function(licenseName) {
            const vscode = acquireVsCodeApi();
            vscode.postMessage({
                command: 'showLicenseText',
                licenseName: licenseName
            });
        }
    </script>
    
    <div class="footer" style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 14px; color: #666;">
        <p>Created with ❤️ by <strong><a href="https://github.com/RustyDaemon/vscode-licenses" target="_blank" style="color: #007acc; text-decoration: none;">RustyDaemon</a></strong></p>
    </div>
</body>
</html>`;
	}

	private static getLicenseClass(license: string): string {
		// Ensure license is always a string
		const licenseStr = typeof license === 'string' ? license : String(license);
		const lowerLicense = licenseStr.toLowerCase();
		if (lowerLicense.includes('mit')) {
			return 'license-mit';
		}
		if (lowerLicense.includes('apache')) {
			return 'license-apache';
		}
		if (lowerLicense.includes('bsd')) {
			return 'license-bsd';
		}
		if (lowerLicense.includes('gpl')) {
			return 'license-gpl';
		}
		if (lowerLicense.includes('unknown')) {
			return 'license-unknown';
		}
		return '';
	}

	private static async exportData(
		projects: ProjectInfo[],
		format: string
	): Promise<void> {
		const fs = require('fs');
		const path = require('path');

		try {
			// Get save location
			const saveUri = await vscode.window.showSaveDialog({
				defaultUri: vscode.Uri.file(`licenses-report.${format}`),
				filters: {
					[format.toUpperCase()]: [format],
					'All Files': ['*'],
				},
			});

			if (!saveUri) {
				return; // User cancelled
			}

			let content = '';
			const timestamp = new Date().toLocaleString();

			switch (format.toLowerCase()) {
				case 'json':
					content = JSON.stringify(projects, null, 2);
					break;

				case 'csv':
					// CSV Header
					content =
						'Project,Package,Version,License,Repository,Homepage,Description\n';

					// CSV Content
					for (const project of projects) {
						for (const dep of project.dependencies) {
							const escapeCsv = (str: string) => `"${str.replace(/"/g, '""')}"`;
							content += `${escapeCsv(project.name)},${escapeCsv(
								dep.name
							)},${escapeCsv(dep.version)},${escapeCsv(
								dep.license
							)},${escapeCsv(dep.repository || '')},${escapeCsv(
								dep.homepage || ''
							)},${escapeCsv(dep.description || '')}\n`;
						}
					}
					break;

				case 'html':
					content = this.generateFullHtmlReport(projects, timestamp);
					break;

				default:
					throw new Error(`Unsupported format: ${format}`);
			}

			// Write file
			fs.writeFileSync(saveUri.fsPath, content, 'utf8');

			vscode.window.showInformationMessage(
				`Successfully exported ${format.toUpperCase()} report to ${path.basename(
					saveUri.fsPath
				)}`
			);
		} catch (error) {
			console.error('Export error:', error);
			const errorMessage =
				error instanceof Error ? error.message : 'Unknown error';
			vscode.window.showErrorMessage(
				`Failed to export ${format} report: ${errorMessage}`
			);
		}
	}

	private static generateFullHtmlReport(
		projects: ProjectInfo[],
		timestamp: string
	): string {
		const totalDependencies = projects.reduce(
			(sum, p) => sum + p.dependencies.length,
			0
		);
		const uniqueLicenses = new Set(
			projects.flatMap(p => p.dependencies.map(d => d.license))
		).size;

		return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>License Report - ${timestamp}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding: 30px;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e0e0e0;
        }
        .stats {
            display: flex;
            justify-content: space-around;
            margin: 20px 0;
            flex-wrap: wrap;
        }
        .stat-card {
            text-align: center;
            padding: 15px;
            border: 1px solid #ddd;
            border-radius: 6px;
            min-width: 150px;
            margin: 5px;
        }
        .stat-number {
            font-size: 24px;
            font-weight: bold;
            color: #007acc;
        }
        .project {
            margin: 30px 0;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 8px;
            background: #fafafa;
        }
        .project-header {
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid #ccc;
        }
        .deps-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }
        .deps-table th,
        .deps-table td {
            padding: 10px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        .deps-table th {
            background-color: #f0f0f0;
            font-weight: 600;
        }
        .deps-table tr:hover {
            background-color: #f9f9f9;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            font-size: 14px;
            color: #666;
        }
        .license-link {
            color: #007acc;
            text-decoration: none;
            cursor: pointer;
        }
        .license-link:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 License Report</h1>
            <p>Generated on ${timestamp}</p>
        </div>

        <div class="stats">
            <div class="stat-card">
                <div class="stat-number">${projects.length}</div>
                <div>Projects</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${totalDependencies}</div>
                <div>Total Dependencies</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${uniqueLicenses}</div>
                <div>Unique Licenses</div>
            </div>
        </div>

        ${projects
					.map(
						project => `
        <div class="project">
            <div class="project-header">
                <h2>📁 ${project.name}</h2>
                <p><strong>Path:</strong> ${project.path}</p>
                <p><strong>Type:</strong> ${project.type}</p>
                <p><strong>Dependencies:</strong> ${
									project.dependencies.length
								}</p>
            </div>
            
            <table class="deps-table">
                <thead>
                    <tr>
                        <th>Package</th>
                        <th>Version</th>
                        <th>License</th>
                        <th>Repository</th>
                        <th>Description</th>
                    </tr>
                </thead>
                <tbody>
                    ${project.dependencies
											.map(
												dep => `
                    <tr>
                        <td><strong>${dep.name}</strong></td>
                        <td>${dep.version}</td>
                        <td><span class="license-link">${
													dep.license
												}</span></td>
                        <td>${
													dep.repository
														? `<a href="${dep.repository}" target="_blank">${dep.repository}</a>`
														: '-'
												}</td>
                        <td>${dep.description || '-'}</td>
                    </tr>
                    `
											)
											.join('')}
                </tbody>
            </table>
        </div>
        `
					)
					.join('')}

        <div class="footer">
            <p>Created with ❤️ by <strong><a href="https://github.com/RustyDaemon/vscode-licenses" target="_blank" style="color: #007acc; text-decoration: none;">RustyDaemon</a></strong></p>
            <p>License information collected from various package registries</p>
        </div>
    </div>
</body>
</html>`;
	}
}
