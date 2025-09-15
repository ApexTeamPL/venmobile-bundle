import { NavigationNative } from "@vendetta/metro/common";
import { after } from "@vendetta/patcher";
import { Forms } from "@vendetta/ui/components";
import { findInReactTree } from "@vendetta/utils";

import { logger } from "@vendetta";
import intlProxy from "../intlProxy";
import type { PinToSettingsTabs } from "./tabs";

export interface PinToSettingsOptions {
	key: string;
	icon?: { uri: string };
	trailing?: () => React.ReactElement;
	title: () => string;
	predicate: () => boolean;
	page: React.ComponentType<any>;
}

export default function patchSettingsPin({
	key,
	icon,
	trailing,
	title,
	predicate,
	page,
}: PinToSettingsOptions) {
	return after("render", Forms.FormSection, (args, ret) => {
		if (!predicate()) return;

		const tabs = findInReactTree(ret, (x) => x?.props?.children?.props?.children);
		if (!tabs) return;

		const children = tabs.props.children;
		if (!Array.isArray(children)) return;

		children.push(
			<Forms.FormRow
				key={key}
				label={title()}
				leading={icon && <Forms.FormRow.Icon source={icon} />}
				trailing={trailing && trailing()}
				onPress={() => {
					NavigationNative.push(page);
				}}
			/>,
		);
	});
}
