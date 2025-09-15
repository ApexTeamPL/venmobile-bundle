import { findByProps } from "@vendetta/metro";
import { i18n } from "@vendetta/metro/common";

const { intl, t: intlMap } = findByProps("intl") ?? {};

export default {
	format: (key: string, values?: Record<string, any>) => {
		if (intl) {
			return intl.formatMessage({ id: key }, values);
		}
		if (intlMap && intlMap[key]) {
			return intlMap[key];
		}
		return key;
	},
};
