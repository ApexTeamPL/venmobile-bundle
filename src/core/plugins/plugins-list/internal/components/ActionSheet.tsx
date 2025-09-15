import { findByProps } from "@vendetta/metro";
import { React, ReactNative as RN } from "@vendetta/metro/common";
import { showActionSheet } from "@vendetta/ui/alerts";

export function showSimpleActionSheet(
	title: string,
	options: string[],
	callback: (index: number) => void,
) {
	showActionSheet({
		title,
		options,
		callback,
	});
}

export function hideActionSheet() {
	// Action sheet is automatically hidden when an option is selected
	// This is a placeholder for compatibility
}
