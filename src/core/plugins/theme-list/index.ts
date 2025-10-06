import { React, NavigationNative } from "@metro/common";
import { View } from "react-native";
import { Stack, Button, IconButton, Text, Card, FlashList, useSegmentedControlState } from "@metro/common/components";
import { findAssetId } from "@lib/api/assets";
import safeFetch from "@lib/utils/safeFetch";
import { showToast } from "@ui/toasts";
import Search from "@ui/components/Search";
import { getCurrentTheme, installTheme, themes, fetchTheme, removeTheme, selectTheme } from "@lib/addons/themes";
import { clipboard } from "@metro/common";
import { hideSheet, showSheet } from "@lib/ui/sheets";
import { AlertActionButton } from "@lib/ui/components/wrappers";
import { dismissAlert, openAlert } from "@lib/ui/alerts";
import { ActionSheet, AlertModal, AlertActions, TableRow, TableRowGroup } from "@metro/common/components";
import { lazyDestructure } from "@lib/utils/lazy";
import { findByProps } from "@metro";

const { showSimpleActionSheet, hideActionSheet } = lazyDestructure(() => findByProps("showSimpleActionSheet"));

interface ThemeData {
    name: string;
    description: string;
    authors: string[];
    installUrl: string;
}

const THEME_URL = "https://raw.githubusercontent.com/kmmiio99o/theme-marketplace/refs/heads/main/themes.json";

function normalizeIdFromInstallUrl(url: string) {
    return url.endsWith("/") ? url : url + "/";
}

// @ts-ignore (i cant be bothered to type these)
function InstallButton({ theme, installing, setInstalling, setRefreshTick }) {
    const [installed, setInstalled] = React.useState(() => Boolean(themes[theme.installUrl]));

    React.useEffect(() => {
        setInstalled(Boolean(themes[theme.installUrl]));
    }, [theme.installUrl, setRefreshTick]);
    
    const installThemeAction = async () => {
        if (installing.has(theme.installUrl)) return;
        setInstalling((prev: Iterable<unknown> | null | undefined) => new Set(prev).add(theme.installUrl));
        try {
            await installTheme(theme.installUrl);
            showToast(`Installed ${theme.name}`, findAssetId("CheckIcon"));
            setInstalled(true);
        } catch (e) {
            showToast(e instanceof Error ? e.message : String(e), findAssetId("CircleXIcon-primary"));
        } finally {
            setInstalling((prev: Iterable<unknown> | null | undefined) => { const s = new Set(prev); s.delete(theme.installUrl); return s; });
            setRefreshTick((t: number) => t + 1);
        }
    };

    const uninstallTheme = async () => {
        try {
            await removeTheme(theme.installUrl);
            showToast(`Uninstalled ${theme.name}`, findAssetId("TrashIcon"));
            setInstalled(false);
        } catch (e) {
            showToast(e instanceof Error ? e.message : String(e), findAssetId("CircleXIcon-primary"));
        } finally {
            setRefreshTick((t: number) => t + 1);
        }
    };

    return (
        <Button
            size="sm"
            loading={installing.has(theme.installUrl)}
            text={!installed ? (installing.has(theme.installUrl) ? "Installing..." : "Install") : "Uninstall"}
            disabled={installing.has(theme.installUrl)}
            onPress={!installed ? installThemeAction : uninstallTheme}
            variant={!installed ? "primary" : "destructive"}
            icon={findAssetId(!installed ? "DownloadIcon" : "TrashIcon")}
        />
    );
}

// @ts-ignore (i cant be bothered to type these)
function TrailingButtons({ theme, installing, setInstalling, setRefreshTick }) {
    const copyThemeLink = () => {
        clipboard.setString(theme.installUrl);
        // @ts-ignore
        showToast.showCopyToClipboard?.();
    };

    const openThemeMenu = () => {
        const actions = [
            {
                label: "Copy Theme Link",
                icon: findAssetId("CopyIcon"),
                onPress: copyThemeLink
            }
        ];

        const sheetKey = "theme-menu";
        showSheet(sheetKey, () => (
            <ActionSheet>
                <TableRowGroup title="Theme Info">
                    {actions.map((action, index) => (
                        <TableRow
                            key={index}
                            label={action.label}
                            icon={<TableRow.Icon source={action.icon} />}
                            onPress={() => {
                                action.onPress();
                                hideSheet(sheetKey);
                            }}
                        />
                    ))}
                </TableRowGroup>
            </ActionSheet>
        ));
    };

    return (
        <Stack spacing={8} direction="horizontal">
            <IconButton
                size="sm"
                onPress={openThemeMenu}
                variant="secondary"
                icon={findAssetId("MoreHorizontalIcon")}
            />
            <InstallButton 
                theme={theme}
                installing={installing} 
                setInstalling={setInstalling} 
                setRefreshTick={setRefreshTick} 
            />
        </Stack>
    );
}

// @ts-ignore (i cant be bothered to type these)
function ThemeCard({ theme, installing, setInstalling, setRefreshTick }) {
    const { name, description, authors } = theme;

    return (
        <Card>
            <Stack spacing={16}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flexShrink: 1 }}>
                        <Text numberOfLines={1} variant="heading-lg/semibold">
                            {name}
                        </Text>
                        <Text variant="text-md/semibold" color="text-muted">
                            by {authors?.join(", ") || "Unknown"}
                        </Text>
                    </View>
                    <View>
                        <TrailingButtons 
                            theme={theme}
                            installing={installing} 
                            setInstalling={setInstalling} 
                            setRefreshTick={setRefreshTick} 
                        />
                    </View>
                </View>
                <Text variant="text-md/medium">
                    {description}
                </Text>
            </Stack>
        </Card>
    );
}

enum Sort {
    DateNewest = "Newest",
    DateOldest = "Oldest",
    NameAZ = "Name (A–Z)",
    NameZA = "Name (Z–A)",
}

export default function BrowserPage() {
    const navigation = NavigationNative.useNavigation();

    const [themesList, setThemesList] = React.useState<ThemeData[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [installing, setInstalling] = React.useState<Set<string>>(new Set());
    const [refreshTick, setRefreshTick] = React.useState(0);
    const [sort, setSort] = React.useState<Sort>(Sort.DateNewest);

    React.useEffect(() => {
        navigation.setOptions({
            title: "Theme Browser"
        });
    }, [navigation]);

    const fetchThemes = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await safeFetch(THEME_URL);
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            const data = await response.json();
            
            let themeList: ThemeData[] = [];
            if (Array.isArray(data)) {
                themeList = data;
            } else {
                // Handle any other structure for themes - try common property names
                themeList = data.OFFICIAL_THEMES || data.themes || data.THEMES || data.items || [];
            }
            
            setThemesList(themeList);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            setThemesList([]);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchThemes();
    }, [fetchThemes]);

    const filterList = (list: ThemeData[]) => {
        if (!list) return [] as ThemeData[];
        const q = searchQuery.toLowerCase();
        if (!q) return list;
        return list.filter(t =>
            t.name.toLowerCase().includes(q)
            || t.description.toLowerCase().includes(q)
            || (t.authors || []).some(a => a.toLowerCase().includes(q))
        );
    };

    const sortedAndFiltered = React.useMemo(() => {
        const list = filterList(themesList);

        switch (sort) {
            case Sort.DateNewest:
                return [...list].reverse();
            case Sort.DateOldest:
                return [...list];
            case Sort.NameAZ:
                return [...list].sort((a, b) => a.name.localeCompare(b.name));
            case Sort.NameZA:
                return [...list].sort((a, b) => b.name.localeCompare(a.name));
            default:
                return list;
        }
    }, [themesList, searchQuery, sort]);

    if (error) {
        return (
            <View style={{ flex: 1, paddingHorizontal: 8, justifyContent: "center", alignItems: "center" }}>
                <Card style={{ gap: 8 }}>
                    <Text style={{ textAlign: "center" }} variant="heading-lg/bold">
                        An error occurred while fetching the theme repository
                    </Text>
                    <Text style={{ textAlign: "center" }} variant="text-sm/medium" color="text-muted">
                        {error}
                    </Text>
                    <Button
                        size="lg"
                        text="Refetch"
                        onPress={fetchThemes}
                        icon={findAssetId("RetryIcon")}
                    />
                </Card>
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            <View style={{ justifyContent: "center", alignItems: "center", paddingHorizontal: 10 }}>
                <Stack spacing={12}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 10, paddingBottom: 6 }}>
                        <Search 
                            placeholder="Search themes..." 
                            onChangeText={setSearchQuery} 
                            style={{ flex: 1 }}
                        />
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <IconButton
                                size="sm"
                                variant="tertiary"
                                icon={findAssetId("MoreVerticalIcon")}
                                disabled={!!searchQuery}
                                onPress={() => showSimpleActionSheet({
                                    key: "ThemeListSortOptions",
                                    header: {
                                        title: "Sort Options",
                                        onClose: () => hideActionSheet("ThemeListSortOptions"),
                                    },
                                    options: Object.entries(Sort).map(([key, value]) => ({
                                        label: value,
                                        onPress: () => {
                                            setSort(value as Sort);
                                        }
                                    }))
                                })}
                            />
                        </View>
                    </View>
                </Stack>
            </View>
            
            <FlashList
                data={sortedAndFiltered}
                refreshing={loading}
                onRefresh={fetchThemes}
                estimatedItemSize={200}
                contentContainerStyle={{ paddingBottom: 90, paddingHorizontal: 5 }}
                //@ts-ignore
                renderItem={({ item: theme }) => (
                    <View style={{ paddingVertical: 6, paddingHorizontal: 8 }}>
                        <ThemeCard 
                            theme={theme}
                            installing={installing} 
                            setInstalling={setInstalling} 
                            setRefreshTick={setRefreshTick} 
                        />
                    </View>
                )}
            />
        </View>
    );
}