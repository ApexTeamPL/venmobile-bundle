// Based on @Nexpid's Plugin Browser: https://github.com/nexpid/RevengePlugins/tree/main/src/plugins/plugin-browser

import { defineCorePlugin } from "..";
import { patchSettings } from "./stuff/patcher";
import { awaitStorage as awaitVdStorage, createMMKVBackend, createStorage as createVdStorage, wrapSync } from "@core/vendetta/storage";

let patches = [] as (() => unknown)[];

const DEFAULT_REPOS = [
    { key: "official", name: "Official Plugins", url: "https://raw.githubusercontent.com/ApexTeamPL/Plugins-List/refs/heads/main/offical-plugins.json" },
    { key: "user", name: "User Plugins", url: "https://raw.githubusercontent.com/ApexTeamPL/Plugins-List/refs/heads/main/user-plugins.json" }
];

export default defineCorePlugin({
    manifest: {
        id: "bunny.plugins-list",
        name: "Plugins List",
        version: "1.0.0",
        description: "A modified plugin browser that uses https://plugins-list.pages.dev as source.",
        authors: [
            { name: "nexpid" },
            { name: "Purple_Ξye™" },
        ],
    },
    async start() {
        // Initialize persistent storage so the page can read/write safely
        const settings = wrapSync(createVdStorage(
            createMMKVBackend("PLUGINS_LIST_SETTINGS", {
                repos: DEFAULT_REPOS,
                enabledKeys: DEFAULT_REPOS.map(r => r.key),
                multiMode: true
            })
        ));
        await awaitVdStorage(settings);

        patches = [patchSettings()];
    },
    stop() {
        patches.forEach(p => p?.());
        patches = [];
    }
});
