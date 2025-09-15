// Based on @Nexpid's Plugin Browser: https://github.com/nexpid/RevengePlugins/tree/main/src/plugins/plugin-browser

import { React } from "@vendetta/metro/common";
import { plugins } from "@vendetta/plugins";

import { emitterSymbol } from "../../stuff/util";

export default function(id: string) {
	const [status, setStatus] = React.useState(!!plugins[id]);
	const emitter = (plugins as any)[emitterSymbol] as any;

	const handler = () => {
		setStatus(!!plugins[id]);
	};
	React.useEffect(() => {
		setStatus(!!plugins[id]);
		emitter.on("SET", handler);
		emitter.on("DEL", handler);
		return () => {
			emitter.off("SET", handler);
			emitter.off("DEL", handler);
		};
	});

	return status;
}
