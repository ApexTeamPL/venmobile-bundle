import { findByProps } from "@vendetta/metro";
import { React, ReactNative as RN } from "@vendetta/metro/common";
import { showToast } from "@vendetta/ui/toasts";

import type * as t from "./types";

export const IconButton = ({ icon, onPress, style, ...props }: t.IconButtonProps) => {
	const { TouchableOpacity } = findByProps("TouchableOpacity") ?? RN;
	return (
		<TouchableOpacity
			style={[
				{
					padding: 8,
					borderRadius: 8,
					alignItems: "center",
					justifyContent: "center",
				},
				style,
			]}
			onPress={onPress}
			{...props}
		>
			{icon}
		</TouchableOpacity>
	);
};

export const Stack = ({ children, style, ...props }: t.StackProps) => {
	const { View } = findByProps("View") ?? RN;
	return (
		<View
			style={[
				{
					flexDirection: "row",
					alignItems: "center",
					gap: 8,
				},
				style,
			]}
			{...props}
		>
			{children}
		</View>
	);
};

export const TextInput = ({ value, onChangeText, placeholder, style, ...props }: t.TextInputProps) => {
	const { TextInput: RNTextInput } = findByProps("TextInput") ?? RN;
	return (
		<RNTextInput
			value={value}
			onChangeText={onChangeText}
			placeholder={placeholder}
			style={[
				{
					borderWidth: 1,
					borderColor: "#ccc",
					borderRadius: 8,
					padding: 12,
					fontSize: 16,
				},
				style,
			]}
			{...props}
		/>
	);
};

export const ContextMenu = ({ children, actions, ...props }: t.ContextMenuProps) => {
	// Simplified context menu implementation
	return (
		<RN.View {...props}>
			{children}
		</RN.View>
	);
};
