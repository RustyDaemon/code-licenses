import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ProjectInfo } from './types';
import { DateTimeUtils } from './utils/dateTimeUtils';

export class LicenseReportExporter {
	/**
	 * Exports license report to various formats
	 */
	public async exportReport(
		projects: ProjectInfo[],
		format: 'json' | 'csv' | 'html' = 'json'
	): Promise<void> {
		try {
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (!workspaceFolder) {
				vscode.window.showErrorMessage('No workspace folder found');
				return;
			}

			const timestamp = new Date().toISOString().split('T')[0];
			const fileName = `license-report-${timestamp}.${format}`;
			const filePath = path.join(workspaceFolder.uri.fsPath, fileName);

			let content = '';

			switch (format) {
				case 'json':
					content = this.generateJsonReport(projects);
					break;
				case 'csv':
					content = this.generateCsvReport(projects);
					break;
				case 'html':
					content = this.generateHtmlReport(projects);
					break;
			}

			fs.writeFileSync(filePath, content);

			const action = await vscode.window.showInformationMessage(
				`License report exported to ${fileName}`,
				'Open File'
			);

			if (action === 'Open File') {
				const document = await vscode.workspace.openTextDocument(filePath);
				await vscode.window.showTextDocument(document);
			}
		} catch (error) {
			console.error('Error exporting license report:', error);
			vscode.window.showErrorMessage(
				`Error exporting license report: ${error}`
			);
		}
	}

	private generateJsonReport(projects: ProjectInfo[]): string {
		const report = {
			generatedAt: new Date().toISOString(),
			projects: projects.map(project => ({
				name: project.name,
				type: project.type,
				path: project.path,
				dependencyFile: project.dependencyFile,
				dependencies: project.dependencies,
				summary: this.generateProjectSummary(project),
			})),
			summary: this.generateOverallSummary(projects),
		};

		return JSON.stringify(report, null, 2);
	}

	private generateCsvReport(projects: ProjectInfo[]): string {
		const headers = [
			'Project',
			'Project Type',
			'Package Name',
			'Version',
			'License',
			'Repository',
			'Homepage',
		];
		const rows = [headers.join(',')];

		for (const project of projects) {
			for (const dependency of project.dependencies) {
				const row = [
					this.escapeCsv(project.name),
					this.escapeCsv(project.type),
					this.escapeCsv(dependency.name),
					this.escapeCsv(dependency.version),
					this.escapeCsv(dependency.license),
					this.escapeCsv(dependency.repository || ''),
					this.escapeCsv(dependency.homepage || ''),
				];
				rows.push(row.join(','));
			}
		}

		return rows.join('\n');
	}

	private generateHtmlReport(projects: ProjectInfo[]): string {
		const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>License Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1, h2, h3 { color: #333; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 30px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .license-mit { background-color: #d4edda; }
        .license-apache { background-color: #d4edda; }
        .license-bsd { background-color: #d4edda; }
        .license-gpl { background-color: #f8d7da; }
        .license-unknown { background-color: #ffeaa7; }
        .summary { background-color: #e9ecef; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    </style>
</head>
<body>
    <h1>License Report</h1>
    <p>Generated on: ${DateTimeUtils.formatDateTime(new Date())}</p>
    
    <div class="summary">
        <h2>Summary</h2>
        ${this.generateHtmlSummary(projects)}
    </div>
    
    ${projects.map(project => this.generateProjectHtml(project)).join('')}
</body>
</html>`;

		return html;
	}

	private generateHtmlSummary(projects: ProjectInfo[]): string {
		const totalDeps = projects.reduce(
			(sum, p) => sum + p.dependencies.length,
			0
		);
		const allLicenses = new Set<string>();
		projects.forEach(p =>
			p.dependencies.forEach(d => allLicenses.add(d.license))
		);

		return `
            <p><strong>Total Projects:</strong> ${projects.length}</p>
            <p><strong>Total Dependencies:</strong> ${totalDeps}</p>
            <p><strong>Unique Licenses:</strong> ${allLicenses.size}</p>
        `;
	}

	private generateProjectHtml(project: ProjectInfo): string {
		const summary = this.generateProjectSummary(project);

		return `
            <h2>${project.name} (${project.type})</h2>
            <p><strong>Dependency File:</strong> ${project.dependencyFile}</p>
            <p><strong>Total Dependencies:</strong> ${
							project.dependencies.length
						}</p>
            
            <h3>License Summary</h3>
            <ul>
                ${Object.entries(summary.licenseDistribution)
									.map(([license, count]) => `<li>${license}: ${count}</li>`)
									.join('')}
            </ul>
            
            <h3>Dependencies</h3>
            <table>
                <thead>
                    <tr>
                        <th>Package</th>
                        <th>Version</th>
                        <th>License</th>
                        <th>Repository</th>
                    </tr>
                </thead>
                <tbody>
                    ${project.dependencies
											.map(
												dep => `
                        <tr class="${this.getLicenseClass(dep.license)}">
                            <td>${dep.name}</td>
                            <td>${dep.version}</td>
                            <td>${dep.license}</td>
                            <td>${
															dep.repository
																? `<a href="${dep.repository}" target="_blank">Link</a>`
																: ''
														}</td>
                        </tr>
                    `
											)
											.join('')}
                </tbody>
            </table>
        `;
	}

	private generateProjectSummary(project: ProjectInfo) {
		const licenseDistribution: Record<string, number> = {};

		for (const dependency of project.dependencies) {
			const license = dependency.license || 'Unknown';
			licenseDistribution[license] = (licenseDistribution[license] || 0) + 1;
		}

		return {
			totalDependencies: project.dependencies.length,
			licenseDistribution,
			uniqueLicenses: Object.keys(licenseDistribution).length,
		};
	}

	private generateOverallSummary(projects: ProjectInfo[]) {
		const totalDependencies = projects.reduce(
			(sum, p) => sum + p.dependencies.length,
			0
		);
		const allLicenses = new Set<string>();
		const licenseDistribution: Record<string, number> = {};

		projects.forEach(project => {
			project.dependencies.forEach(dep => {
				const license = dep.license || 'Unknown';
				allLicenses.add(license);
				licenseDistribution[license] = (licenseDistribution[license] || 0) + 1;
			});
		});

		return {
			totalProjects: projects.length,
			totalDependencies,
			uniqueLicenses: allLicenses.size,
			licenseDistribution,
		};
	}

	private escapeCsv(value: string): string {
		if (value.includes(',') || value.includes('"') || value.includes('\n')) {
			return `"${value.replace(/"/g, '""')}"`;
		}
		return value;
	}

	private getLicenseClass(license: string): string {
		const lowerLicense = license.toLowerCase();
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
}
