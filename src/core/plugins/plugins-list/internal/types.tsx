import { findByProps, findByStoreName } from "@vendetta/metro";
import { FluxDispatcher, ReactNative as RN } from "@vendetta/metro/common";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { showToast } from "@vendetta/ui/toasts";
import type { StyleSheet } from "react-native";

export const fluxSubscribe = (event: string, callback: (...args: any[]) => void) => {
	FluxDispatcher.subscribe(event, callback);
	return () => FluxDispatcher.unsubscribe(event, callback);
};

export const resolveSemanticColor = (color: string) => {
	return color;
};

export const lerp = (a: number, b: number, t: number) => {
	return a + (b - a) * t;
};
