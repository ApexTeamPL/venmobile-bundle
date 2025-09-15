import { NavigationNative, React } from "@vendetta/metro/common";

export function managePage(
	component: React.ComponentType<any>,
	title: string,
) {
	return function () {
		NavigationNative.push(component);
	};
}
