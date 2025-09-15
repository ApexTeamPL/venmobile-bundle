import { findByProps } from "@vendetta/metro";
import { React, ReactNative as RN } from "@vendetta/metro/common";
import { semanticColors } from "@vendetta/ui";
import type { TextProps } from "react-native";

export default function Text({
	children,
	style,
	variant = "text-sm/medium",
	color = "TEXT_NORMAL",
	...props
}: TextProps & {
	variant?: string;
	color?: keyof typeof semanticColors;
}) {
	const { Text: RNText } = findByProps("Text") ?? RN;
	return (
		<RNText
			style={[
				{
					color: semanticColors[color],
					fontSize: 16,
					fontWeight: "500",
				},
				style,
			]}
			{...props}
		>
			{children}
		</RNText>
	);
}
