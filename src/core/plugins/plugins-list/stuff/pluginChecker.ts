// Based on @Nexpid's Plugin Browser: https://github.com/nexpid/RevengePlugins/tree/main/src/plugins/plugin-browser

import { safeFetch } from "@vendetta/utils";

import { vstorage } from "..";
import type { FullPlugin } from "../types";
import { properLink } from "./util";

let lastPluginCache = new Array<string>();

export function getChanges(): string[] {
    if (!lastPluginCache.length || !vstorage.pluginCache?.length) return [];
    return lastPluginCache.filter(id => !vstorage.pluginCache.includes(id));
}

export function updateChanges() {
    vstorage.pluginCache = [...lastPluginCache];
}

export async function run() {
    try {
        const response = await safeFetch("https://plugins-list.pages.dev/plugins-data.json", {
            cache: "no-store",
        });
        if (!response.ok) {
            console.error("[PluginChecker] Failed to fetch plugin list, status:", response.status);
            return;
        }
        const pluginData = await response.json() as FullPlugin[];

        lastPluginCache = pluginData.map(plugin => properLink(plugin.installUrl));
    } catch (error) {
        console.error("[PluginChecker] Error fetching or processing plugin list:", error);
    }
}

export function initThing(): () => void {
	const interval = setInterval(run, 1000 * 60 * 60);
	run();

	return () => {
		clearInterval(interval);
	};
}
