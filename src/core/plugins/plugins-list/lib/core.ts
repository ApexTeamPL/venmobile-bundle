export interface CorePluginManifestAuthor {
	name: string;
}

export interface CorePluginManifest {
	id: string;
	name: string;
	version: string;
	description: string;
	authors: CorePluginManifestAuthor[];
}

export interface CorePluginDefinition {
	manifest: CorePluginManifest;
	start: () => void | Promise<void>;
	stop: () => void | Promise<void>;
}

export function defineCorePlugin<T extends CorePluginDefinition>(plugin: T): T {
	return plugin;
}

export default defineCorePlugin;

