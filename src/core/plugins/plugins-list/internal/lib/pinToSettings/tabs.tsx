import { findByProps } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import { after } from "@vendetta/patcher";
import { findInReactTree } from "@vendetta/utils";

import type { PinToSettingsTabs } from ".";

export interface PinToSettingsTabs {
	key: string;
	label: string;
	icon: string;
	page: React.ComponentType<any>;
}

export default function patchSettingsTabs(tabs: PinToSettingsTabs[]) {
	return after("render", findByProps("getScreenOptions"), (args, ret) => {
		const navigation = findInReactTree(ret, (x) => x?.props?.navigation);
		if (!navigation) return;

		const children = navigation.props.children;
		if (!Array.isArray(children)) return;

		children.push(
			...tabs.map((tab) => (
				<navigation.Screen
					key={tab.key}
					name={tab.key}
					component={tab.page}
					options={{
						title: tab.label,
						tabBarIcon: ({ focused }) => (
							<tab.icon
								width={24}
								height={24}
								fill={focused ? "#fff" : "#999"}
							/>
						),
					}}
				/>
			)),
		);
	});
}
