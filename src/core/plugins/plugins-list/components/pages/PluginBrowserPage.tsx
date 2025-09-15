import { React, NavigationNative } from "@metro/common";
import { ScrollView, View } from "react-native";
import { Stack, TableRow, TableRowGroup, Button, IconButton, Text, ActionSheet, AlertModal, AlertActions, TextInput } from "@metro/common/components";
import { findAssetId } from "@lib/api/assets";
import safeFetch from "@lib/utils/safeFetch";
import { showToast } from "@ui/toasts";
import Search from "@ui/components/Search";
import { VdPluginManager } from "@core/vendetta/plugins";
import { clipboard } from "@metro/common";
import { hideSheet, showSheet } from "@lib/ui/sheets";
import { AlertActionButton } from "@lib/ui/components/wrappers";
import { dismissAlert, openAlert } from "@lib/ui/alerts";
import { awaitStorage as awaitVdStorage, createMMKVBackend, createStorage as createVdStorage, wrapSync } from "@core/vendetta/storage";

interface PluginData {
    name: string;
    description: string;
    authors: string[];
    status: "working" | "broken" | "warning" | string;
    sourceUrl: string;
    installUrl: string;
    warningMessage?: string;
}

interface RepoPayload {
    OFFICIAL_PLUGINS?: PluginData[];
    USER_PLUGINS?: PluginData[];
}

type Repo = { key: string; name: string; url: string };

type RepoResolved = {
    official: PluginData[];
    user: PluginData[];
};

type PersistedSettings = {
    repos: Repo[];
    enabledKeys: string[];
    multiMode: boolean;
};

const DEFAULT_REPOS: Repo[] = [
    { key: "official", name: "Official Plugins", url: "https://raw.githubusercontent.com/ApexTeamPL/Plugins-List/refs/heads/main/offical-plugins.json" },
    { key: "user", name: "User Plugins", url: "https://raw.githubusercontent.com/ApexTeamPL/Plugins-List/refs/heads/main/user-plugins.json" }
];

function normalizeIdFromInstallUrl(url: string) {
    return url.endsWith("/") ? url : url + "/";
}

export default function PluginBrowserPage() {
    const navigation = NavigationNative.useNavigation();

    const settings = React.useMemo(() => wrapSync(createVdStorage<PersistedSettings>(
        createMMKVBackend("PLUGINS_LIST_SETTINGS", {
            repos: DEFAULT_REPOS,
            enabledKeys: DEFAULT_REPOS.map(r => r.key),
            multiMode: true
        })
    )), []);

    const [settingsReady, setSettingsReady] = React.useState(false);
    const [repos, setRepos] = React.useState<Repo[]>(DEFAULT_REPOS);
    const [enabledRepoKeys, setEnabledRepoKeys] = React.useState<Set<string>>(new Set(DEFAULT_REPOS.map(r => r.key)));
    const [multiMode, setMultiMode] = React.useState(true);
    const [resolved, setResolved] = React.useState<Record<string, RepoResolved>>({});
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [installing, setInstalling] = React.useState<Set<string>>(new Set());
    const [refreshTick, setRefreshTick] = React.useState(0);

	React.useEffect(() => {
        (async () => {
            await awaitVdStorage(settings);
            setRepos(settings.repos ?? DEFAULT_REPOS);
            setEnabledRepoKeys(new Set(settings.enabledKeys ?? DEFAULT_REPOS.map(r => r.key)));
            setMultiMode(settings.multiMode ?? true);
            setSettingsReady(true);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	React.useEffect(() => {
        if (!settingsReady) return;
        // persist on change after storage is ready
        settings.repos = repos;
        settings.enabledKeys = [...enabledRepoKeys];
        settings.multiMode = multiMode;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [repos, enabledRepoKeys, multiMode, settingsReady]);

    const isDefaultRepo = (r: Repo) => DEFAULT_REPOS.some(d => d.key === r.key && d.url === r.url);
    const isRepoEnabled = (key: string) => enabledRepoKeys.has(key);

    const fetchEnabledRepos = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const enabled = repos.filter(r => enabledRepoKeys.has(r.key));
            const results = await Promise.all(enabled.map(async r => {
                const response = await safeFetch(r.url);
                if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                const data: RepoPayload | PluginData[] = await response.json();
                const official = Array.isArray(data) ? (data as PluginData[]) : (data.OFFICIAL_PLUGINS ?? []);
                const user = Array.isArray(data) ? [] : (data.USER_PLUGINS ?? []);
                return [r.key, { official, user }] as [string, RepoResolved];
            }));
            const map: Record<string, RepoResolved> = {};
            for (const [k, v] of results) map[k] = v;
            setResolved(map);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            setResolved({});
        } finally {
            setLoading(false);
        }
    }, [repos, enabledRepoKeys]);

    React.useEffect(() => {
        fetchEnabledRepos();
    }, [fetchEnabledRepos]);

    React.useEffect(() => {
        const count = multiMode ? [...enabledRepoKeys].length : 1;
        const singleRepo = !multiMode ? repos.find(r => enabledRepoKeys.has(r.key)) : undefined;
        navigation.setOptions({
            title: "Plugin Browser",
            headerRight: () => (
                <Button
                    size="sm"
							variant="secondary"
                    text={multiMode ? `Repos (${count})` : (singleRepo?.name ?? "Repo")}
                    icon={findAssetId("ListBulletIcon")}
                    onPress={openRepoSheet}
                />
            )
        });
    }, [navigation, enabledRepoKeys, repos, multiMode]);

    const installPluginFromUrl = async (plugin: PluginData) => {
        const id = normalizeIdFromInstallUrl(plugin.installUrl);
        if (installing.has(id)) return;
        setInstalling(prev => new Set(prev).add(id));
        try {
            await VdPluginManager.installPlugin(id, true);
            showToast(`Installed ${plugin.name}`, findAssetId("CheckIcon"));
        } catch (e) {
            showToast(e instanceof Error ? e.message : String(e), findAssetId("CircleXIcon-primary"));
        } finally {
            setInstalling(prev => { const s = new Set(prev); s.delete(id); return s; });
            setRefreshTick(t => t + 1);
        }
    };

    const uninstallPluginByUrl = async (plugin: PluginData) => {
        const id = normalizeIdFromInstallUrl(plugin.installUrl);
        try {
            await VdPluginManager.removePlugin(id);
            showToast(`Uninstalled ${plugin.name}`, findAssetId("TrashIcon"));
        } catch (e) {
            showToast(e instanceof Error ? e.message : String(e), findAssetId("CircleXIcon-primary"));
        } finally {
            setRefreshTick(t => t + 1);
        }
    };

    const promptInstall = (plugin: PluginData) => {
        const needsWarn = (plugin.status && plugin.status !== "working") || (plugin.warningMessage && plugin.warningMessage.trim().length > 0);
        if (!needsWarn) return installPluginFromUrl(plugin);

        const lines: string[] = [];
        if (plugin.status && plugin.status !== "working") {
            if (plugin.status === "broken") lines.push("This plugin is marked as BROKEN by the repository.");
            else if (plugin.status === "warning") lines.push("This plugin may have issues on mobile.");
            else lines.push(`Status: ${plugin.status}`);
        }
        if (plugin.warningMessage) lines.push(plugin.warningMessage);

        openAlert("plugins-list-install-warning", (
            <AlertModal
                title="Warning!"
                content="This plugin may not work as expected."
                extraContent={<CardContent lines={lines} />}
                actions={<AlertActions>
                    <AlertActionButton
                        text="Install Anyway"
                        variant="primary"
                        onPress={() => { dismissAlert("plugins-list-install-warning"); installPluginFromUrl(plugin); }}
                    />
                    <AlertActionButton
                        text="Cancel"
                        variant="secondary"
                        onPress={() => dismissAlert("plugins-list-install-warning")}
                    />
                </AlertActions>}
            />
        ));
    };

    const isInstalled = (plugin: PluginData) => {
        const id = normalizeIdFromInstallUrl(plugin.installUrl);
        return Boolean(VdPluginManager.plugins[id]);
    };

    const filterList = (list: PluginData[]) => {
        if (!list) return [] as PluginData[];
        const q = searchQuery.toLowerCase();
        if (!q) return list;
        return list.filter(p =>
            p.name.toLowerCase().includes(q)
            || p.description.toLowerCase().includes(q)
            || (p.authors || []).some(a => a.toLowerCase().includes(q))
        );
    };

    const openRepoSheet = () => {
        const displayRepos: Repo[] = (repos && repos.length > 0) ? repos : DEFAULT_REPOS;
        showSheet("plugins-list-repo-sheet", () => (
            <ActionSheet>
                <TableRowGroup title="Mode">
                    <TableRow
                        label="Multi repositories"
                        subLabel={multiMode ? "Enabled" : "Disabled"}
                        trailing={<Button size="sm" text={multiMode ? "Disable" : "Enable"} onPress={() => setMultiMode(m => !m)} />}
                    />
                </TableRowGroup>
                <TableRowGroup title="Repositories">
                    {displayRepos.map(r => (
                        <TableRow
                            key={`${r.key}:${r.url}`}
                            label={r.name}
                            subLabel={r.url}
                            trailing={
                                <Stack direction="horizontal" spacing={8}>
                                    {!isDefaultRepo(r) && (
                                        <IconButton
                                            size="sm"
                                            variant="destructive"
                                            icon={findAssetId("TrashIcon")}
                                            onPress={() => {
                                                setRepos(prev => prev.filter(x => !(x.key === r.key && x.url === r.url)));
                                                setEnabledRepoKeys(prev => {
                                                    const s = new Set(prev);
                                                    s.delete(r.key);
                                                    return s;
                                                });
                                            }}
                                        />
                                    )}
                                    {multiMode ? (
                                        <Button
                                            size="sm"
                                            variant={isRepoEnabled(r.key) ? "primary" : "secondary"}
                                            text={isRepoEnabled(r.key) ? "Enabled" : "Enable"}
                                            onPress={() => setEnabledRepoKeys(prev => {
                                                const s = new Set(prev);
                                                if (s.has(r.key)) s.delete(r.key); else s.add(r.key);
                                                return s;
                                            })}
                                        />
                                    ) : (
                                        <Button
                                            size="sm"
                                            variant={isRepoEnabled(r.key) ? "primary" : "secondary"}
                                            text={isRepoEnabled(r.key) ? "Selected" : "Select"}
                                            onPress={() => {
                                                setEnabledRepoKeys(new Set([r.key]));
                                                hideSheet("plugins-list-repo-sheet");
                                            }}
                                        />
                                    )}
                                </Stack>
                            }
                        />
                    ))}
                    <TableRow
                        label="Add Repository..."
                        icon={<TableRow.Icon source={findAssetId("PlusMediumIcon")} />}
                        onPress={() => {
                            openAlert("plugins-list-add-repo", (
                                <AlertModal
                                    title="Add Repository"
                                    content="Enter the URL of the repository (JSON) you want to add."
                                    extraContent={<RepoAddForm onAdd={(name, url) => {
                                        const key = `${name}-${Date.now()}`.toLowerCase();
                                        setRepos(prev => [...prev, { key, name, url }]);
                                        setEnabledRepoKeys(prev => new Set(prev).add(key));
                                        dismissAlert("plugins-list-add-repo");
                                        hideSheet("plugins-list-repo-sheet");
                                    }} />}
                                    actions={<AlertActions>
                                        <AlertActionButton text="Close" variant="secondary" onPress={() => dismissAlert("plugins-list-add-repo")} />
                                    </AlertActions>}
                                />
                            ));
                            hideSheet("plugins-list-repo-sheet");
                        }}
                    />
                </TableRowGroup>
            </ActionSheet>
        ));
    };

    const copyLink = (url: string) => {
        clipboard.setString(url);
        // @ts-ignore
        showToast.showCopyToClipboard?.();
    };

    const copyPluginLink = (plugin: PluginData) => {
        clipboard.setString(plugin.installUrl);
        // @ts-ignore
        showToast.showCopyToClipboard?.();
    };

    const copySourceUrl = (plugin: PluginData) => {
        clipboard.setString(plugin.sourceUrl);
        // @ts-ignore
        showToast.showCopyToClipboard?.();
    };

    const showWarningMessage = (plugin: PluginData) => {
        if (plugin.warningMessage) {
            openAlert("plugin-warning", (
                <AlertModal
                    title="Plugin Warning"
                    content="This plugin has a warning message:"
                    extraContent={<CardContent lines={[plugin.warningMessage]} />}
                    actions={<AlertActions>
                        <AlertActionButton
                            text="Close"
                            variant="secondary"
                            onPress={() => dismissAlert("plugin-warning")}
                        />
                    </AlertActions>}
                />
            ));
        }
    };

    const openPluginMenu = (plugin: PluginData) => {
        const actions = [
            {
                label: "Copy Plugin Link",
                icon: findAssetId("CopyIcon"),
                onPress: () => copyPluginLink(plugin)
            }
        ];

        if (plugin.sourceUrl) {
            actions.push({
                label: "Copy Source URL",
                icon: findAssetId("CopyIcon"),
                onPress: () => copySourceUrl(plugin)
            });
        }

        if (plugin.warningMessage) {
            actions.push({
                label: "Show Warning Message",
                icon: findAssetId("CircleInformationIcon-primary"),
                onPress: () => showWarningMessage(plugin)
            });
        }

        showSheet("plugin-menu", () => (
            <ActionSheet>
                {actions.map((action, index) => (
                    <TableRow
                        key={index}
                        label={action.label}
                        icon={<TableRow.Icon source={action.icon} />}
                        onPress={() => {
                            action.onPress();
                            hideSheet("plugin-menu");
                        }}
                    />
                ))}
            </ActionSheet>
        ));
    };

    const enabledReposOrdered = repos.filter(r => enabledRepoKeys.has(r.key));

	return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 38 }}>
            <Stack style={{ paddingVertical: 24, paddingHorizontal: 12 }} spacing={16}>
                <Search placeholder="Search plugins..." onChangeText={setSearchQuery} />

                {error ? (
                    <TableRowGroup title="Error">
                        <TableRow label="Failed to fetch repositories" subLabel={error} icon={<TableRow.Icon source={findAssetId("CircleXIcon-primary")} />} />
                        <Button text="Retry" onPress={() => fetchEnabledRepos()} icon={findAssetId("RetryIcon")} />
                    </TableRowGroup>
                ) : null}

                {enabledReposOrdered.map(repo => {
                    const data = resolved[repo.key];
                    const combined = filterList([...(data?.official ?? []), ...(data?.user ?? [])]);
                    return (
                        <View key={repo.key}>
                            <TableRowGroup title={repo.name}>
                                {combined.map(p => {
                                    const installed = isInstalled(p);
                                    const normId = normalizeIdFromInstallUrl(p.installUrl);
                                    return (
                                        <TableRow
                                            key={normId}
                                            label={p.name}
                                            subLabel={`${p.description} • by ${(p.authors || []).join(", ")}`}
                                            icon={<TableRow.Icon source={findAssetId(p.status === "working" ? "CheckIcon" : p.status === "broken" ? "CircleXIcon-primary" : "WarningIcon")} />}
                                            trailing={
                                                <Stack direction="horizontal" spacing={8}>
                                                    <IconButton
                                                        size="sm"
                                                        variant="secondary"
                                                        icon={findAssetId("MoreHorizontalIcon")}
                                                        onPress={() => openPluginMenu(p)}
                                                    />
                                                    {!installed ? (
                                                        <Button
                                                            size="sm"
                                                            text={installing.has(normId) ? "Installing..." : "Install"}
                                                            disabled={installing.has(normId)}
                                                            onPress={() => promptInstall(p)}
                                                            icon={findAssetId("DownloadIcon")}
                                                        />
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            variant="destructive"
                                                            text="Uninstall"
                                                            onPress={() => uninstallPluginByUrl(p)}
                                                            icon={findAssetId("TrashIcon")}
                                                        />
                                                    )}
                                                </Stack>
                                            }
                                        />
                                    );
                                })}
                            </TableRowGroup>
                        </View>
                    );
                })}
            </Stack>
        </ScrollView>
    );
}

function RepoAddForm(props: { onAdd: (name: string, url: string) => void; }) {
    const [name, setName] = React.useState("");
    const [url, setUrl] = React.useState("");

    return (
        <Stack spacing={8}>
            <TextInput placeholder="Repository Name" value={name} onChange={setName} />
            <TextInput placeholder="https://example.com/plugins.json" value={url} onChange={setUrl} />
            <AlertActions>
                <AlertActionButton
                    text="Add"
                    variant="primary"
                    disabled={!name || !url}
                    onPress={() => props.onAdd(name, url)}
                />
            </AlertActions>
        </Stack>
    );
}

const CardContent = ({ lines }: { lines: string[] }) => (
    <Stack>
        {lines.length > 0 ? (
            <Text variant="text-sm/normal" color="text-muted">
                {lines.join("\n\n")}
            </Text>
        ) : null}
    </Stack>
);
