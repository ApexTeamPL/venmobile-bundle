// Based on @Nexpid's Plugin Browser: https://github.com/nexpid/RevengePlugins/tree/main/src/plugins/plugin-browser

import { findAssetId } from "@lib/api/assets";
import { after } from "@lib/api/patcher";
import { findInReactTree } from "@lib/utils";
import { TableRow } from "@metro/common/components";
import { findByNameLazy, findByPropsLazy } from "@metro/wrappers";
import { wrapOnPress } from "@lib/ui/settings/patches/shared";

// Inject one row into the existing Vencore section
export default function patchSettings(): () => void {
  const settingConstants = findByPropsLazy("SETTING_RENDERER_CONFIG");
  const SettingsOverviewScreen = findByNameLazy("SettingsOverviewScreen", false);

  // Define our row (rendered via custom page route)
  const rowKey = "VENCORE_PLUGIN_BROWSER";
  const rowConfig = {
    type: "pressable",
    title: () => "Plugin Browser",
    icon: findAssetId("ActivitiesIcon"),
    IconComponent: () => <TableRow.Icon source={findAssetId("ActivitiesIcon")} />,
    usePredicate: () => true,
    onPress: wrapOnPress(undefined, undefined, () => import("../components/pages/PluginBrowserPage"), "Plugin Browser"),
    withArrow: true,
  };

  // Extend renderer config to include our row key
  const original = settingConstants.SETTING_RENDERER_CONFIG;
  let current = original;
  Object.defineProperty(settingConstants, "SETTING_RENDERER_CONFIG", {
    configurable: true,
    get: () => ({ ...current, [rowKey]: rowConfig }),
    set: v => { current = v; }
  });

  // On first render, append our row key into the Vencore section
  const unpatch = after("default", SettingsOverviewScreen, (_args, ret) => {
    const { sections } = findInReactTree(ret, i => i?.props?.sections).props;
    const venSection = sections?.find((s: any) => s?.label === "Vencore" || s?.title === "Vencore");
    if (venSection && Array.isArray(venSection.settings) && !venSection.settings.includes(rowKey)) {
      venSection.settings = [...venSection.settings, rowKey];
    }
  });

  // cleanup
  return () => {
    unpatch?.();
    Object.defineProperty(settingConstants, "SETTING_RENDERER_CONFIG", {
      value: original, writable: true
    });
  };
}

export { patchSettings };
