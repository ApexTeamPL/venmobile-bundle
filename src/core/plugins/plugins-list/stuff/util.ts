// Based on @Nexpid's Plugin Browser: https://github.com/nexpid/RevengePlugins/tree/main/src/plugins/plugin-browser

import { fetchPlugin, startPlugin, stopPlugin } from "@vendetta/plugins";

export function properLink(id: string): string {
	return !id.endsWith("/") ? `${id}/` : id;
}

export async function refetchPlugin(plugin: any) {
	const enab = plugin.enabled;
	for (let i = 0; i < 2; i++) {
		if (enab) stopPlugin(plugin.id, false);
		await fetchPlugin(plugin.id);
		if (enab) await startPlugin(plugin.id);
	}
}

export const emitterSymbol = Symbol.for("vendetta.storage.emitter");
