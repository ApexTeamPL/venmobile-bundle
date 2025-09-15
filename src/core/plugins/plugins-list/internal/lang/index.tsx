import { findByName } from "@vendetta/metro";
import { ReactNative as RN } from "@vendetta/metro/common";

import { fluxSubscribe } from "../types";

export interface LangValues {
	[key: string]: {
		values: Record<string, string>;
	};
}

export class Lang {
	public Values: LangValues[Plugin]["values"] | undefined;

	constructor(public plugin: Plugin) {
		// Simplified language implementation
		this.Values = {};
	}

	format(key: string, values: Record<string, any> = {}) {
		return this.Values?.[key] || key;
	}

	unload() {
		// Cleanup if needed
	}
}
