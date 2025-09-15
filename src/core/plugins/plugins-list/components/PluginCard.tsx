// Based on @Nexpid's Plugin Browser: https://github.com/nexpid/RevengePlugins/tree/main/src/plugins/plugin-browser

import { clipboard, React, ReactNative as RN, url } from "@vendetta/metro/common";
import { installPlugin, plugins, removePlugin } from "@vendetta/plugins";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { showToast } from "@vendetta/ui/toasts";
import { findByProps } from "@vendetta/metro";
import { semanticColors } from "@vendetta/ui";

import TextBadge from "../internal/components/TextBadge";
import Text from "../internal/components/Text";
import { resolveSemanticColor } from "../internal/types";

import { lang } from "../lang";
import type { FullPlugin } from "../types";
import Card from "./Card";

const { openAlert } = findByProps("openAlert", "dismissAlert");
const { AlertModal, AlertActions, AlertActionButton } = findByProps("AlertModal", "AlertActions", "AlertActionButton");

const getStatusVariant = (status: FullPlugin["status"]): "success" | "danger" | "default" => {
	switch (status) {
		case "working":
			return "success";
		case "broken":
			return "danger";
		case "warning":
			return "default";
		default:
			return "default";
	}
};

export default function PluginCard({
	item,
	changes,
}: {
	item: FullPlugin;
	changes: string[];
}) {
	const usableLink = item.installUrl;
	const githubLink = item.sourceUrl;

	const isNew = React.useMemo(() => changes.includes(usableLink), [changes, usableLink]);

	const [statusState, setStatusState] = React.useState<{
		hasPlugin: boolean;
		pending: boolean;
	}>({
		hasPlugin: !!plugins[usableLink],
		pending: false,
	});

	React.useEffect(() => {
		setStatusState({
			hasPlugin: !!plugins[usableLink],
			pending: false,
		});
	}, [item, usableLink]);

	const performInstall = async () => {
		if (statusState.pending) return;
		setStatusState({
			hasPlugin: !!plugins[usableLink],
			pending: true,
		});

		const shouldRemove = !!plugins[usableLink];

		try {
			if (shouldRemove) removePlugin(usableLink);
			else await installPlugin(usableLink);
		} catch (_e) {
			showToast(
				lang.format(
					shouldRemove
						? "toast.plugin.delete.fail"
						: "toast.plugin.install.fail",
					{ plugin: item.name },
				),
				getAssetIDByName("CircleXIcon-primary"),
			);
		}

		showToast(
			lang.format(
				shouldRemove
					? "toast.plugin.delete.success"
					: "toast.plugin.install.success",
				{ plugin: item.name },
			),
			getAssetIDByName(shouldRemove ? "TrashIcon" : "DownloadIcon"),
		);

		setStatusState({
			hasPlugin: !!plugins[usableLink],
			pending: false,
		});
	};

	const installFunction = async () => {
		if (statusState.pending) return;

		const shouldRemove = !!plugins[usableLink];

		if (!shouldRemove && (item.status === "broken" || item.status === "warning")) {
			const defaultMessage = item.status === "broken"
				? "Installing broken plugins may crash your client or cause unexpected behavior."
				: "This plugin may not work as expected.";

			openAlert("plugin-install-warning", (
				<AlertModal
					title="Warning!"
					content={<Text variant="text-md/semibold" color="TEXT_NORMAL">{defaultMessage}</Text>}
					extraContent={item.warningMessage && (
						<RN.View style={{
							backgroundColor: resolveSemanticColor(semanticColors.BACKGROUND_SECONDARY),
							borderRadius: 8,
							padding: 12,
						}}>
							<Text variant="text-md/normal" color="TEXT_MUTED">
								{item.warningMessage}
							</Text>
						</RN.View>
					)}
					actions={
						<AlertActions>
							<AlertActionButton
								text="Install Anyway"
								variant="primary"
								onPress={async () => {
									await performInstall();
								}}
							/>
							<AlertActionButton
								text="Cancel"
								variant="secondary"
							/>
						</AlertActions>
					}
				/>
			));
			return;
		}
		await performInstall();
	};

	const copyPluginLink = () => {
		clipboard.setString(usableLink);
		showToast(
			lang.format("toast.copy_link", {}),
			getAssetIDByName("CopyIcon"),
		);
	};

	const copySourceUrl = () => {
		if (githubLink) {
			clipboard.setString(githubLink);
			showToast(
				lang.format("toast.copy_link", {}),
				getAssetIDByName("CopyIcon"),
			);
		}
	};

	const showWarningMessage = () => {
		if (item.warningMessage) {
			openAlert("plugin-warning", (
				<AlertModal
					title="Plugin Warning"
					content={
						<RN.View style={{
							backgroundColor: resolveSemanticColor(semanticColors.BACKGROUND_SECONDARY),
							borderRadius: 8,
							padding: 12,
						}}>
							<Text variant="text-md/normal" color="TEXT_MUTED">
								{item.warningMessage}
							</Text>
						</RN.View>
					}
					actions={
						<AlertActions>
							<AlertActionButton
								text="Close"
								variant="secondary"
							/>
						</AlertActions>
					}
				/>
			));
		}
	};

	return (
		<Card
			headerLabel={item.name}
			headerSuffix={
				<RN.View style={{ flexDirection: "row", alignItems: "center" }}>
					{item.status && (
						<TextBadge
							variant={getStatusVariant(item.status)}
							style={{ marginRight: 4 }}
						>
							{item.status}
						</TextBadge>
					)}
					{isNew && (
						<TextBadge
							variant="success"
							style={{ marginRight: 4 }}
						>
							{lang.format("browser.plugin.new", {})}
						</TextBadge>
					)}
				</RN.View>
			}
			highlight={!!isNew}
			headerSublabel={item.authors && item.authors.length > 0
				? `by ${item.authors.join(", ")}`
				: undefined}
			descriptionLabel={item.description}
			overflowTitle={item.name}
			actions={[
				{
					icon: statusState.hasPlugin ? "TrashIcon" : "DownloadIcon",
					disabled: statusState.pending,
					loading: statusState.pending,
					isDestructive: statusState.hasPlugin,
					onPress: installFunction,
				},
			]}
			overflowActions={[
				{
					label: lang.format(
						statusState.hasPlugin ? "sheet.plugin.uninstall" : "sheet.plugin.install",
						{},
					),
					icon: statusState.hasPlugin ? "TrashIcon" : "DownloadIcon",
					isDestructive: statusState.hasPlugin,
					onPress: installFunction,
				},
				{
					label: "Copy Plugin Link",
					icon: "CopyIcon",
					onPress: copyPluginLink,
				},
				...(githubLink
					? [
						{
							label: "Copy Source URL",
							icon: "CopyIcon",
							onPress: copySourceUrl,
						},
						{
							label: lang.format("sheet.plugin.open_github", {}),
							icon: "img_account_sync_github_white",
							onPress: async () => {
								showToast(
									lang.format("toast.open_link", {}),
									getAssetIDByName("LinkExternalSmallIcon"),
								);
								if (await RN.Linking.canOpenURL(githubLink)) {
									RN.Linking.openURL(githubLink);
								} else {
									url.openURL(githubLink);
								}
							},
						},
					]
					: []),
				...(item.warningMessage
					? [
						{
							label: "Show Warning Message",
							icon: "CircleInformationIcon-primary",
							onPress: showWarningMessage,
						},
					]
					: []),
			]}
		/>
	);
}
