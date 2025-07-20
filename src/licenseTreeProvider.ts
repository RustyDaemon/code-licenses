import * as vscode from 'vscode';
import { FilterOptions, LicenseInfo, ProjectInfo } from './types';

export class LicenseTreeProvider
	implements vscode.TreeDataProvider<LicenseTreeItem>
{
	private _onDidChangeTreeData: vscode.EventEmitter<
		LicenseTreeItem | undefined | null | void
	> = new vscode.EventEmitter<LicenseTreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<
		LicenseTreeItem | undefined | null | void
	> = this._onDidChangeTreeData.event;

	private projects: ProjectInfo[] = [];
	private filterOptions: FilterOptions = {};

	constructor() {}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	updateProjects(projects: ProjectInfo[]): void {
		this.projects = projects;
		this.refresh();
	}

	setFilterOptions(options: FilterOptions): void {
		this.filterOptions = options;
		this.refresh();
	}

	getTreeItem(element: LicenseTreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: LicenseTreeItem): Thenable<LicenseTreeItem[]> {
		if (!this.projects || this.projects.length === 0) {
			return Promise.resolve([]);
		}

		if (element) {
			if (element.itemType === 'project') {
				return Promise.resolve(this.getProjectDependencies(element));
			} else if (element.itemType === 'license' && element.dependencies) {
				// Show dependencies under a license group
				const dependencyItems = element.dependencies.map(dep => {
					const projectInfo = (dep as any).projectName
						? ` (${(dep as any).projectName})`
						: '';
					return new LicenseTreeItem(
						`${dep.name}${projectInfo}`,
						vscode.TreeItemCollapsibleState.None,
						'dependency',
						element.project,
						undefined,
						dep
					);
				});
				return Promise.resolve(dependencyItems);
			} else {
				return Promise.resolve([]);
			}
		} else {
			return Promise.resolve(this.getProjectNodes());
		}
	}

	private getProjectNodes(): LicenseTreeItem[] {
		return this.projects.map(project => {
			const dependencyCount = project.dependencies.length;

			return new LicenseTreeItem(
				`${project.name} (${dependencyCount} deps)`,
				vscode.TreeItemCollapsibleState.Collapsed,
				'project',
				project
			);
		});
	}

	private getLicenseGroupNodes(): LicenseTreeItem[] {
		// Collect all dependencies from all projects, tagged with project info
		const allDependencies: (LicenseInfo & {
			projectName: string;
			projectType: string;
		})[] = [];

		this.projects.forEach(project => {
			project.dependencies.forEach(dep => {
				allDependencies.push({
					...dep,
					projectName: project.name,
					projectType: project.type,
				});
			});
		});

		// Group by license
		const licenseGroups = new Map<
			string,
			(LicenseInfo & { projectName: string; projectType: string })[]
		>();
		allDependencies.forEach(dep => {
			// Ensure license is always a string
			let license: string;
			if (typeof dep.license === 'string') {
				license = dep.license || 'Unknown';
			} else {
				license = String(dep.license) || 'Unknown';
			}
			if (!licenseGroups.has(license)) {
				licenseGroups.set(license, []);
			}
			licenseGroups.get(license)!.push(dep);
		});

		// Create license group tree items
		const items: LicenseTreeItem[] = [];
		for (const [license, dependencies] of licenseGroups.entries()) {
			const licenseItem = new LicenseTreeItem(
				`${license} (${dependencies.length})`,
				vscode.TreeItemCollapsibleState.Collapsed,
				'license',
				undefined, // No single project
				dependencies as any // Cast to match interface
			);
			items.push(licenseItem);
		}

		return items.sort((a, b) => a.label.localeCompare(b.label));
	}

	private getProjectDependencies(
		projectItem: LicenseTreeItem
	): LicenseTreeItem[] {
		if (!projectItem.project) {
			return [];
		}

		const project = projectItem.project;
		const licenseGroups = this.groupDependenciesByLicense(project.dependencies);
		const items: LicenseTreeItem[] = [];

		// Create license group nodes
		for (const [license, dependencies] of licenseGroups.entries()) {
			const licenseItem = new LicenseTreeItem(
				`${license} (${dependencies.length})`,
				vscode.TreeItemCollapsibleState.Collapsed,
				'license',
				project,
				dependencies
			);

			// Add dependency items as children
			const depItems = dependencies.map(
				dep =>
					new LicenseTreeItem(
						`${dep.name}`,
						vscode.TreeItemCollapsibleState.None,
						'dependency',
						project,
						undefined,
						dep
					)
			);

			items.push(licenseItem);
		}

		return items.sort((a, b) => a.label.localeCompare(b.label));
	}

	private groupDependenciesByLicense(
		dependencies: LicenseInfo[]
	): Map<string, LicenseInfo[]> {
		const groups = new Map<string, LicenseInfo[]>();

		for (const dependency of dependencies) {
			// Ensure license is always a string
			let license: string;
			if (typeof dependency.license === 'string') {
				license = dependency.license || 'Unknown';
			} else {
				license = String(dependency.license) || 'Unknown';
			}
			if (!groups.has(license)) {
				groups.set(license, []);
			}
			groups.get(license)!.push(dependency);
		}

		return groups;
	}
}

export class LicenseTreeItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly itemType: 'project' | 'license' | 'dependency',
		public readonly project?: ProjectInfo,
		public readonly dependencies?: LicenseInfo[],
		public readonly dependency?: LicenseInfo
	) {
		super(label, collapsibleState);

		this.tooltip = this.getTooltip();
		this.description = this.getDescription();
		this.contextValue = itemType;
		this.iconPath = this.getIcon();

		// Make license items show dependencies when clicked
		if (itemType === 'license' && dependencies) {
			this.command = {
				command: 'code-licenses.showLicenseDetails',
				title: 'Show License Details',
				arguments: [this],
			};
		}

		// Make dependency items show package information when clicked
		if (itemType === 'dependency' && dependency) {
			this.command = {
				command: 'code-licenses.showDependencyInfo',
				title: 'Show Dependency Information',
				arguments: [this],
			};
		}
	}

	private getTooltip(): string {
		switch (this.itemType) {
			case 'project':
				return `Project: ${this.project?.name}\nType: ${
					this.project?.type
				}\nDependencies: ${this.project?.dependencies.length || 0}`;

			case 'license':
				const depCount = this.dependencies?.length || 0;
				const depNames =
					this.dependencies
						?.slice(0, 5)
						.map(d => d.name)
						.join(', ') || '';
				const moreText = depCount > 5 ? `... and ${depCount - 5} more` : '';
				return `License: ${
					this.label.split(' (')[0]
				}\nPackages (${depCount}): ${depNames}${moreText}`;

			case 'dependency':
				const lines = [`Package: ${this.dependency?.name}`];
				if (this.dependency?.version) {
					lines.push(`Version: ${this.dependency.version}`);
				}
				if (this.dependency?.license) {
					lines.push(`License: ${this.dependency.license}`);
				}
				if (this.dependency?.description) {
					lines.push(`Description: ${this.dependency.description}`);
				}
				if (this.dependency?.repository) {
					lines.push(`Repository: ${this.dependency.repository}`);
				}
				return lines.join('\n');

			default:
				return this.label;
		}
	}

	private getDescription(): string {
		switch (this.itemType) {
			case 'project':
				return this.project?.type || '';

			case 'license':
				return `${this.dependencies?.length || 0} packages`;

			case 'dependency':
				const parts = [];
				if (this.dependency?.version) {
					parts.push(`v${this.dependency.version}`);
				}
				if (this.dependency?.license && this.itemType === 'dependency') {
					parts.push(this.dependency.license);
				}
				return parts.join(' • ');

			default:
				return '';
		}
	}

	private getIcon(): vscode.ThemeIcon {
		switch (this.itemType) {
			case 'project':
				return new vscode.ThemeIcon('folder-library');

			case 'license':
				return this.getLicenseIcon(this.label);

			case 'dependency':
				return new vscode.ThemeIcon('package');

			default:
				return new vscode.ThemeIcon('question');
		}
	}

	private getLicenseIcon(license: string): vscode.ThemeIcon {
		const lowerLicense = license.toLowerCase();

		if (lowerLicense.includes('mit')) {
			return new vscode.ThemeIcon(
				'check',
				new vscode.ThemeColor('charts.green')
			);
		} else if (lowerLicense.includes('apache')) {
			return new vscode.ThemeIcon(
				'check',
				new vscode.ThemeColor('charts.green')
			);
		} else if (lowerLicense.includes('bsd')) {
			return new vscode.ThemeIcon(
				'check',
				new vscode.ThemeColor('charts.green')
			);
		} else if (lowerLicense.includes('gpl')) {
			return new vscode.ThemeIcon(
				'warning',
				new vscode.ThemeColor('charts.orange')
			);
		} else if (
			lowerLicense.includes('unknown') ||
			lowerLicense.includes('timeout')
		) {
			return new vscode.ThemeIcon(
				'question',
				new vscode.ThemeColor('charts.gray')
			);
		} else {
			return new vscode.ThemeIcon('law', new vscode.ThemeColor('charts.blue'));
		}
	}
}
