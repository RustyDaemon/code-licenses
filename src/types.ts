// Types and interfaces for the Code Licenses extension

export interface LicenseInfo {
	name: string;
	version: string;
	license: string;
	licenseText?: string;
	repository?: string;
	homepage?: string;
	description?: string;
}

export interface ProjectInfo {
	type: ProjectType;
	name: string;
	path: string;
	dependencyFile: string;
	dependencies: LicenseInfo[];
}

export enum ProjectType {
	JavaScript = 'javascript',
	TypeScript = 'typescript',
	React = 'react',
	CSharp = 'csharp',
	Python = 'python',
	Rust = 'rust',
	Go = 'go',
	Unknown = 'unknown',
}

export interface DependencyFile {
	path: string;
	type: ProjectType;
	parser: (content: string) => Promise<LicenseInfo[]>;
}

export interface LicenseSource {
	name: string;
	getLicense: (packageName: string, version?: string) => Promise<string>;
}

export interface FilterOptions {
	licenseTypes?: string[];
	searchTerm?: string;
	projectTypes?: ProjectType[];
}

export interface LicenseCompatibility {
	license1: string;
	license2: string;
	compatible: boolean;
	reason?: string;
}

export interface DependencyNode {
	name: string;
	version: string;
	dependencies: DependencyNode[];
	license?: string;
}

export interface LicenseTextCache {
	[licenseName: string]: {
		text: string;
		fetchedAt: Date;
		source?: string;
	};
}

export interface CacheConfiguration {
	enabled: boolean;
	maxAge: number; // in milliseconds
	maxSize: number; // maximum number of entries
}
