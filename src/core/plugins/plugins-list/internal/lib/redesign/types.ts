import type { ViewStyle, TextStyle } from "react-native";

export interface IconButtonProps {
	icon: React.ReactNode;
	onPress: () => void;
	style?: ViewStyle;
}

export interface StackProps {
	children: React.ReactNode;
	style?: ViewStyle;
}

export interface TextInputProps {
	value: string;
	onChangeText: (text: string) => void;
	placeholder?: string;
	style?: TextStyle;
}

export interface ContextMenuProps {
	children: React.ReactNode;
	actions: Array<{
		label: string;
		onPress: () => void;
	}>;
}
