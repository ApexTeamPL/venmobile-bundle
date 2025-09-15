import { React, ReactNative as RN, stylesheet } from "@vendetta/metro/common";
import { semanticColors } from "@vendetta/ui";
import type { ViewStyle } from "react-native";

const styles = stylesheet.createThemedStyleSheet({
	badge: {
		backgroundColor: semanticColors.BACKGROUND_SECONDARY,
		borderRadius: 8,
		paddingHorizontal: 6,
		paddingVertical: 2,
		alignSelf: "flex-start",
	} as ViewStyle,
	text: {
		color: semanticColors.TEXT_NORMAL,
		fontSize: 12,
		fontWeight: "600",
	},
});

export default function TextBadge({
	children,
	variant = "default",
	style,
	...props
}: {
	children: React.ReactNode;
	variant?: "default" | "danger" | "success";
	style?: ViewStyle;
}) {
	const variantStyles = {
		default: {},
		danger: { backgroundColor: semanticColors.DANGER },
		success: { backgroundColor: semanticColors.SUCCESS },
	};

	return (
		<RN.View
			style={[styles.badge, variantStyles[variant], style]}
			{...props}
		>
			<RN.Text style={styles.text}>{children}</RN.Text>
		</RN.View>
	);
}
