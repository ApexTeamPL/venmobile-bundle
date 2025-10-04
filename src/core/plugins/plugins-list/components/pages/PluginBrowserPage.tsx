// Based on @Nexpid's Plugin Browser: https://github.com/nexpid/RevengePlugins/tree/main/src/plugins/plugin-browser

import { React, NavigationNative } from "@metro/common";
import { View, RefreshControl, Linking } from "react-native";
import {
  Stack,
  Button,
  IconButton,
  Text,
  Card,
  FlashList,
  ActionSheet,
  AlertModal,
  AlertActions,
  TableRow,
  TableRowGroup,
  TextInput,
} from "@metro/common/components";
import { findAssetId } from "@lib/api/assets";
import safeFetch from "@lib/utils/safeFetch";
import { showToast } from "@ui/toasts";
import Search from "@ui/components/Search";
import { VdPluginManager } from "@core/vendetta/plugins";
import { clipboard } from "@metro/common";
import { hideSheet, showSheet } from "@lib/ui/sheets";
import { AlertActionButton } from "@lib/ui/components/wrappers";
import { dismissAlert, openAlert } from "@lib/ui/alerts";
import {
  awaitStorage as awaitVdStorage,
  createMMKVBackend,
  createStorage as createVdStorage,
  wrapSync,
} from "@core/vendetta/storage";

interface PluginData {
  name: string;
  description: string;
  authors: string[];
  status: "working" | "broken" | "warning" | string;
  sourceUrl?: string;
  installUrl: string;
  warningMessage?: string;
  repoKey?: string;
  repoName?: string;
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

export enum Sort {
  DateNewest = "Newest First",
  DateOldest = "Oldest First",
  NameAZ = "A to Z",
  NameZA = "Z to A",
  WorkingFirst = "Working First",
  BrokenFirst = "Broken First",
}

type PersistedSettings = {
  repos: Repo[];
  enabledKeys: string[];
  multiMode: boolean;
  sort: Sort;
};

const DEFAULT_REPOS: Repo[] = [
  {
    key: "official",
    name: "Official Plugins",
    url: "https://raw.githubusercontent.com/ApexTeamPL/Plugins-List/refs/heads/main/offical-plugins.json",
  },
  {
    key: "user",
    name: "User Plugins",
    url: "https://raw.githubusercontent.com/ApexTeamPL/Plugins-List/refs/heads/main/user-plugins.json",
  },
];

const DEFAULT_SORT = Sort.DateNewest;

function normalizeIdFromInstallUrl(url: string) {
  return url.endsWith("/") ? url : url + "/";
}

const PluginCard = React.memo(
  ({
    plugin,
    installing,
    setInstalling,
    setRefreshTick,
  }: {
    plugin: PluginData;
    installing: Set<string>;
    setInstalling: React.Dispatch<React.SetStateAction<Set<string>>>;
    setRefreshTick: React.Dispatch<React.SetStateAction<number>>;
  }) => {
    const normId = normalizeIdFromInstallUrl(plugin.installUrl);
    const [installed, setInstalled] = React.useState(() =>
      Boolean(VdPluginManager.plugins[normId]),
    );

    React.useEffect(() => {
      setInstalled(Boolean(VdPluginManager.plugins[normId]));
    }, [normId, setRefreshTick]);

    const installPlugin = async () => {
      if (installing.has(normId)) return;
      setInstalling((prev) => new Set(prev).add(normId));
      try {
        await VdPluginManager.installPlugin(normId, true);
        showToast(`Installed ${plugin.name}`, findAssetId("CheckIcon"));
        setInstalled(true);
      } catch (e) {
        showToast(
          e instanceof Error ? e.message : String(e),
          findAssetId("CircleXIcon-primary"),
        );
      } finally {
        setInstalling((prev) => {
          const s = new Set(prev);
          s.delete(normId);
          return s;
        });
        setRefreshTick((t) => t + 1);
      }
    };

    const uninstallPlugin = async () => {
      try {
        await VdPluginManager.removePlugin(normId);
        showToast(`Uninstalled ${plugin.name}`, findAssetId("TrashIcon"));
        setInstalled(false);
      } catch (e) {
        showToast(
          e instanceof Error ? e.message : String(e),
          findAssetId("CircleXIcon-primary"),
        );
      } finally {
        setRefreshTick((t) => t + 1);
      }
    };

    const promptInstall = () => {
      const needsWarn =
        (plugin.status && plugin.status !== "working") ||
        (plugin.warningMessage && plugin.warningMessage.trim().length > 0);
      if (!needsWarn) return installPlugin();

      const lines: string[] = [];
      if (plugin.status && plugin.status !== "working") {
        if (plugin.status === "broken")
          lines.push("This plugin is marked as BROKEN by the repository.");
        else if (plugin.status === "warning")
          lines.push("This plugin may have issues on mobile.");
        else lines.push(`Status: ${plugin.status}`);
      }
      if (plugin.warningMessage) lines.push(plugin.warningMessage);

      openAlert(
        "plugins-list-install-warning",
        <AlertModal
          title="⚠️ Plugin Warning"
          content={
            <View style={{ gap: 12 }}>
              <Text variant="text-md/medium" style={{ textAlign: "center" }}>
                {plugin.status === "broken"
                  ? "This plugin is marked as broken and may not work properly."
                  : "This plugin may have issues on mobile devices."}
              </Text>
              <View
                style={{
                  padding: 12,
                  backgroundColor:
                    plugin.status === "broken"
                      ? "rgba(239, 68, 68, 0.1)"
                      : "rgba(245, 158, 11, 0.1)",
                  borderRadius: 8,
                  borderLeftWidth: 4,
                  borderLeftColor:
                    plugin.status === "broken" ? "#EF4444" : "#F59E0B",
                }}
              >
                {lines.map((line, index) => (
                  <Text
                    key={index}
                    variant="text-sm/medium"
                    style={{
                      color: plugin.status === "broken" ? "#EF4444" : "#F59E0B",
                      marginBottom: index < lines.length - 1 ? 8 : 0,
                    }}
                  >
                    {line}
                  </Text>
                ))}
              </View>
            </View>
          }
          actions={
            <AlertActions>
              <AlertActionButton
                text={
                  plugin.status === "broken"
                    ? "Install Anyway"
                    : "Install with Warning"
                }
                variant="primary"
                onPress={() => {
                  dismissAlert("plugins-list-install-warning");
                  installPlugin();
                }}
              />
              <AlertActionButton
                text="Cancel"
                variant="secondary"
                onPress={() => dismissAlert("plugins-list-install-warning")}
              />
            </AlertActions>
          }
        />,
      );
    };

    const openPluginMenu = () => {
      const actions = [
        {
          label: "Copy Plugin Link",
          icon: findAssetId("LinkIcon"),
          onPress: () => {
            clipboard.setString(plugin.installUrl);
            showToast("Copied plugin link", findAssetId("CopyIcon"));
          },
        },
      ];

      if (plugin.sourceUrl) {
        actions.push({
          label: "Open Source URL",
          icon: findAssetId("img_account_sync_github_light"),
          onPress: () => {
            if (plugin.sourceUrl) {
              try {
                Linking.openURL(plugin.sourceUrl);
                showToast(
                  "Opening source URL...",
                  findAssetId("ExternalLinkIcon"),
                );
              } catch (e) {
                clipboard.setString(plugin.sourceUrl);
                showToast(
                  "Could not open URL, copied to clipboard",
                  findAssetId("LinkIcon"),
                );
              }
            }
          },
        });
      }

      if (plugin.warningMessage) {
        const isError = plugin.status === "broken";
        actions.push({
          label: isError ? "Show Error Details" : "Show Warning",
          icon: findAssetId(isError ? "CircleXIcon-primary" : "WarningIcon"),
          onPress: () => {
            openAlert(
              "plugin-warning",
              <AlertModal
                title={`${isError ? "❌" : "⚠️"} ${isError ? "Error Details" : "Warning Details"}`}
                content={
                  <View style={{ gap: 12 }}>
                    <Text
                      variant="text-md/medium"
                      style={{ textAlign: "center" }}
                    >
                      {isError
                        ? "This plugin has reported the following error:"
                        : "This plugin has the following warning:"}
                    </Text>
                    <View
                      style={{
                        padding: 12,
                        backgroundColor: isError
                          ? "rgba(239, 68, 68, 0.1)"
                          : "rgba(245, 158, 11, 0.1)",
                        borderRadius: 8,
                        borderLeftWidth: 4,
                        borderLeftColor: isError ? "#EF4444" : "#F59E0B",
                      }}
                    >
                      <Text
                        variant="text-sm/medium"
                        style={{ color: isError ? "#EF4444" : "#F59E0B" }}
                      >
                        {plugin.warningMessage}
                      </Text>
                    </View>
                  </View>
                }
                actions={
                  <AlertActions>
                    <AlertActionButton
                      text="Got it"
                      variant="secondary"
                      onPress={() => dismissAlert("plugin-warning")}
                    />
                  </AlertActions>
                }
              />,
            );
          },
        });
      }

      showSheet("plugin-menu", () => (
        <ActionSheet>
          <TableRowGroup title={plugin.name}>
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
          </TableRowGroup>
        </ActionSheet>
      ));
    };

    let statusColor = "text-normal";
    let statusText = plugin.status;
    let statusMessage = "";

    if (plugin.status === "working") {
      statusColor = "#4ADE80";
    } else if (plugin.status === "broken") {
      statusColor = "#EF4444";
      statusMessage =
        plugin.warningMessage ||
        "This plugin is broken and may not work properly";
    } else if (plugin.status === "warning") {
      statusColor = "#F59E0B";
      statusMessage =
        plugin.warningMessage || "This plugin may have issues on mobile";
    }

    return (
      <Card>
        <Stack spacing={16}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <View style={{ flexShrink: 1, flex: 1 }}>
              <Text numberOfLines={2} variant="heading-lg/semibold">
                {plugin.name}
              </Text>
              <Text variant="text-md/semibold" color="text-muted">
                by {plugin.authors?.join(", ") || "Unknown"}
              </Text>
              {plugin.repoName && (
                <Text variant="text-sm/medium" color="text-muted">
                  from {plugin.repoName}
                </Text>
              )}
              {statusText && (
                <Text variant="text-md/semibold" style={{ color: statusColor }}>
                  Status: {statusText}
                </Text>
              )}
            </View>
            <View style={{ marginLeft: 12 }}>
              <Stack
                direction="horizontal"
                spacing={12}
                style={{ alignItems: "center" }}
              >
                {!installed ? (
                  <IconButton
                    size="sm"
                    variant="primary"
                    icon={findAssetId("DownloadIcon")}
                    disabled={installing.has(normId)}
                    onPress={promptInstall}
                  />
                ) : (
                  <IconButton
                    size="sm"
                    variant="destructive"
                    icon={findAssetId("TrashIcon")}
                    onPress={uninstallPlugin}
                  />
                )}
                <IconButton
                  size="sm"
                  variant="secondary"
                  icon={findAssetId("MoreHorizontalIcon")}
                  onPress={openPluginMenu}
                />
              </Stack>
            </View>
          </View>
          <Text variant="text-md/medium" numberOfLines={3}>
            {plugin.description}
          </Text>
          {statusMessage && (
            <View
              style={{
                padding: 8,
                backgroundColor:
                  plugin.status === "broken"
                    ? "rgba(239, 68, 68, 0.1)"
                    : "rgba(245, 158, 11, 0.1)",
                borderRadius: 6,
                borderLeftWidth: 3,
                borderLeftColor: statusColor,
              }}
            >
              <Text variant="text-sm/medium" style={{ color: statusColor }}>
                {plugin.status === "broken" ? "❌" : "⚠️"} {statusMessage}
              </Text>
            </View>
          )}
        </Stack>
      </Card>
    );
  },
);

export default function PluginBrowserPage() {
  const navigation = NavigationNative.useNavigation();

  const settings = React.useMemo(
    () =>
      wrapSync(
        createVdStorage<PersistedSettings>(
          createMMKVBackend("PLUGINS_LIST_SETTINGS", {
            repos: DEFAULT_REPOS,
            enabledKeys: DEFAULT_REPOS.map((r) => r.key),
            multiMode: true,
            sort: DEFAULT_SORT,
          }),
        ),
      ),
    [],
  );

  const [settingsReady, setSettingsReady] = React.useState(false);
  const [repos, setRepos] = React.useState<Repo[]>(DEFAULT_REPOS);
  const [enabledRepoKeys, setEnabledRepoKeys] = React.useState<Set<string>>(
    new Set(DEFAULT_REPOS.map((r) => r.key)),
  );
  const [multiMode, setMultiMode] = React.useState(true);
  const [resolved, setResolved] = React.useState<Record<string, RepoResolved>>(
    {},
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [installing, setInstalling] = React.useState<Set<string>>(new Set());
  const [refreshTick, setRefreshTick] = React.useState(0);
  const [sort, setSort] = React.useState<Sort>(DEFAULT_SORT);

  React.useEffect(() => {
    (async () => {
      await awaitVdStorage(settings);
      setRepos(settings.repos ?? DEFAULT_REPOS);
      setEnabledRepoKeys(
        new Set(settings.enabledKeys ?? DEFAULT_REPOS.map((r) => r.key)),
      );
      setMultiMode(settings.multiMode ?? true);
      setSort(settings.sort ?? DEFAULT_SORT);
      setSettingsReady(true);
    })();
  }, []);

  React.useEffect(() => {
    if (!settingsReady) return;
    settings.repos = repos;
    settings.enabledKeys = [...enabledRepoKeys];
    settings.multiMode = multiMode;
    settings.sort = sort;
  }, [repos, enabledRepoKeys, multiMode, sort, settingsReady]);

  const isDefaultRepo = (r: Repo) =>
    DEFAULT_REPOS.some((d) => d.key === r.key && d.url === r.url);
  const isRepoEnabled = (key: string) => enabledRepoKeys.has(key);

  const fetchEnabledRepos = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const enabled = repos.filter((r) => enabledRepoKeys.has(r.key));
      const results = await Promise.all(
        enabled.map(async (r) => {
          const response = await safeFetch(r.url);
          if (!response.ok)
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          const data: RepoPayload | PluginData[] = await response.json();
          const official = Array.isArray(data)
            ? (data as PluginData[])
            : (data.OFFICIAL_PLUGINS ?? []);
          const user = Array.isArray(data) ? [] : (data.USER_PLUGINS ?? []);
          return [r.key, { official, user }] as [string, RepoResolved];
        }),
      );
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
    const singleRepo = !multiMode
      ? repos.find((r) => enabledRepoKeys.has(r.key))
      : undefined;
    navigation.setOptions({
      title: "Plugin Browser",
      headerRight: () => (
        <IconButton
          size="sm"
          variant="secondary"
          icon={findAssetId("SettingsIcon")}
          onPress={openRepoSheet}
        />
      ),
    });
  }, [navigation, enabledRepoKeys, repos, multiMode]);

  const openSortSheet = () => {
    showSheet("plugins-list-sort-sheet", () => (
      <ActionSheet>
        <TableRowGroup title="Sort By">
          {Object.values(Sort).map((sortOption) => (
            <TableRow
              key={sortOption}
              label={sortOption}
              trailing={
                <Button
                  size="sm"
                  variant={sort === sortOption ? "primary" : "secondary"}
                  text={sort === sortOption ? "Selected" : "Select"}
                  onPress={() => {
                    setSort(sortOption);
                    hideSheet("plugins-list-sort-sheet");
                  }}
                />
              }
            />
          ))}
        </TableRowGroup>
      </ActionSheet>
    ));
  };

  const openRepoSheet = () => {
    const displayRepos: Repo[] =
      repos && repos.length > 0 ? repos : DEFAULT_REPOS;
    showSheet("plugins-list-repo-sheet", () => (
      <ActionSheet>
        <TableRowGroup title="Mode">
          <TableRow
            label="Multi repositories"
            subLabel={multiMode ? "Enabled" : "Disabled"}
            trailing={
              <Button
                size="sm"
                text={multiMode ? "Disable" : "Enable"}
                onPress={() => setMultiMode((m) => !m)}
              />
            }
          />
        </TableRowGroup>
        <TableRowGroup title="Repositories">
          {displayRepos.map((r) => (
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
                        setRepos((prev) =>
                          prev.filter(
                            (x) => !(x.key === r.key && x.url === r.url),
                          ),
                        );
                        setEnabledRepoKeys((prev) => {
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
                      onPress={() =>
                        setEnabledRepoKeys((prev) => {
                          const s = new Set(prev);
                          if (s.has(r.key)) s.delete(r.key);
                          else s.add(r.key);
                          return s;
                        })
                      }
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
              openAlert(
                "plugins-list-add-repo",
                <AlertModal
                  title="Add Repository"
                  content="Enter the URL of the repository (JSON) you want to add."
                  extraContent={
                    <RepoAddForm
                      onAdd={(name, url) => {
                        const key = `${name}-${Date.now()}`.toLowerCase();
                        setRepos((prev) => [...prev, { key, name, url }]);
                        setEnabledRepoKeys((prev) => new Set(prev).add(key));
                        dismissAlert("plugins-list-add-repo");
                        hideSheet("plugins-list-repo-sheet");
                      }}
                    />
                  }
                  actions={
                    <AlertActions>
                      <AlertActionButton
                        text="Close"
                        variant="secondary"
                        onPress={() => dismissAlert("plugins-list-add-repo")}
                      />
                    </AlertActions>
                  }
                />,
              );
              hideSheet("plugins-list-repo-sheet");
            }}
          />
        </TableRowGroup>
      </ActionSheet>
    ));
  };

  // Flatten all plugins from all enabled repos into a single list
  const allPlugins = React.useMemo(() => {
    const enabledReposOrdered = repos.filter((r) => enabledRepoKeys.has(r.key));
    const plugins: PluginData[] = [];

    for (const repo of enabledReposOrdered) {
      const data = resolved[repo.key];
      if (data) {
        const repoPlugins = [...(data.official ?? []), ...(data.user ?? [])];
        for (const plugin of repoPlugins) {
          plugins.push({
            ...plugin,
            repoKey: repo.key,
            repoName: repo.name,
          });
        }
      }
    }
    return plugins;
  }, [repos, enabledRepoKeys, resolved]);

  // Sort plugins based on selected sort option
  const sortedPlugins = React.useMemo(() => {
    const plugins = [...allPlugins];

    switch (sort) {
      case Sort.NameAZ:
        return plugins.sort((a, b) => a.name.localeCompare(b.name));
      case Sort.NameZA:
        return plugins.sort((a, b) => b.name.localeCompare(a.name));
      case Sort.WorkingFirst:
        return plugins.sort((a, b) => {
          if (a.status === "working" && b.status !== "working") return -1;
          if (a.status !== "working" && b.status === "working") return 1;
          return a.name.localeCompare(b.name);
        });
      case Sort.BrokenFirst:
        return plugins.sort((a, b) => {
          if (a.status === "broken" && b.status !== "broken") return -1;
          if (a.status !== "broken" && b.status === "broken") return 1;
          return a.name.localeCompare(b.name);
        });
      case Sort.DateOldest:
        return plugins;
      case Sort.DateNewest:
      default:
        return plugins.reverse(); // Assume newer plugins are at the end
    }
  }, [allPlugins, sort]);

  const filteredPlugins = React.useMemo(() => {
    if (!searchQuery.trim()) return sortedPlugins;
    const q = searchQuery.toLowerCase();
    return sortedPlugins.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.authors || []).some((a) => a.toLowerCase().includes(q)),
    );
  }, [sortedPlugins, searchQuery]);

  const renderItem = ({ item }: { item: PluginData }) => (
    <View style={{ paddingVertical: 6, paddingHorizontal: 12 }}>
      <PluginCard
        plugin={item}
        installing={installing}
        setInstalling={setInstalling}
        setRefreshTick={setRefreshTick}
      />
    </View>
  );

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 16,
        }}
      >
        <Card style={{ gap: 16, alignItems: "center" }}>
          <Text variant="heading-lg/bold" style={{ textAlign: "center" }}>
            Failed to load plugins
          </Text>
          <Text
            variant="text-md/medium"
            color="text-muted"
            style={{ textAlign: "center" }}
          >
            {error}
          </Text>
          <Button
            text="Retry"
            onPress={fetchEnabledRepos}
            icon={findAssetId("RetryIcon")}
          />
        </Card>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 12, paddingTop: 12 }}>
        <Stack
          direction="horizontal"
          spacing={12}
          style={{ alignItems: "center" }}
        >
          <View style={{ flex: 1 }}>
            <Search
              placeholder="Search plugins..."
              onChangeText={setSearchQuery}
            />
          </View>
          <IconButton
            size="sm"
            variant="secondary"
            icon={findAssetId("img_help_icon")}
            onPress={openSortSheet}
          />
        </Stack>
      </View>

      <FlashList
        data={filteredPlugins}
        renderItem={renderItem}
        keyExtractor={(item) =>
          `${item.repoKey}-${normalizeIdFromInstallUrl(item.installUrl)}`
        }
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchEnabledRepos} />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 16 }}
        estimatedItemSize={200}
        extraData={refreshTick}
        ListEmptyComponent={
          <View style={{ padding: 32, alignItems: "center" }}>
            <Text variant="text-lg/medium" color="text-muted">
              {searchQuery ? "No plugins found" : "No plugins available"}
            </Text>
          </View>
        }
      />
    </View>
  );
}

function RepoAddForm(props: { onAdd: (name: string, url: string) => void }) {
  const [name, setName] = React.useState("");
  const [url, setUrl] = React.useState("");

  return (
    <Stack spacing={8}>
      <TextInput
        placeholder="Repository Name"
        value={name}
        onChange={setName}
      />
      <TextInput
        placeholder="https://example.com/plugins.json"
        value={url}
        onChange={setUrl}
      />
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
