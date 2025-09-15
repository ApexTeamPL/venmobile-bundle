import { find, findByName, findByProps } from "@vendetta/metro";
import { ReactNative as RN } from "@vendetta/metro/common";

// FlashList
export const FlashList = findByProps("FlashList")?.FlashList;

// Reanimated
export const Reanimated = findByProps("useSharedValue");

// WebView
export const WebView = find((x: any) => x?.WebView && !x.default)?.WebView;

// Svg
export const Svg = findByProps("SvgXml");

// Video
export const Video = findByProps("DRMType", "FilterType")?.default;

// Joi
export const Joi = findByProps("isJoi");

// Zustand
export const zustand = (findByProps("create", "useStore") ?? {
	create: findByName("create"),
});

// DocumentPicker
export const DocumentPicker = findByProps("pickSingle", "isCancel");
export const DocumentsNew = findByProps("pick", "saveDocuments");

// MobileAudioSound
const _MAS = findByProps("MobileAudioSound")?.MobileAudioSound;

export class MobileAudioSound {
	public onPlay?: () => void;
	public onStop?: () => void;
	public onEnd?: () => void;
	public onLoad?: (loaded: boolean) => void;

	private mas: any;

	public duration?: number;
	public isLoaded?: boolean;
	public isPlaying?: boolean;

	private get ensureSoundGetter() {
		return this.mas?._ensureSound || this.mas?.ensureSound;
	}

	private async _preloadSound(skip?: boolean) {
		const { _duration } = await this.ensureSoundGetter.bind(this.mas)();
		this.duration = RN.Platform.select({
			ios: _duration ? _duration * 1000 : _duration,
			default: _duration,
		});
		this.isLoaded = !!_duration;

		if (!skip) this.onLoad?.(!!_duration);
		return !!_duration;
	}

	constructor(
		public url: string,
		public usage: "notification" | "voice" | "ring_tone" | "media",
		public volume: number,
		events?: {
			onPlay?: () => void;
			onStop?: () => void;
			onEnd?: () => void;
			onLoad?: (loaded: boolean) => void;
		},
	) {
		this.mas = new _MAS(
			url,
			{
				media: "vibing_wumpus",
				notification: "activity_launch",
				ring_tone: "call_ringing",
				voice: "mute",
			}[usage],
			volume,
			"default",
		);
		this.mas.volume = volume;

		this._preloadSound();
		for (const [key, val] of Object.entries(events ?? {})) this[key] = val;
	}

	private _playTimeout?: number;

	async play() {
		if (!this.isLoaded && this.isLoaded !== false) {
			await this._preloadSound();
		}
		if (!this.isLoaded) return;

		this.mas.volume = this.volume;
		await this.mas.play();
		this.isPlaying = true;
		this.onPlay?.();

		clearTimeout(this._playTimeout);
		this._playTimeout = setTimeout(
			() => (this.onEnd?.(), this.stop()),
			this.duration,
		) as any;
	}

	async stop() {
		if (!this.isLoaded) return;

		this.mas.stop();
		this.isPlaying = false;
		this.onStop?.();

		clearTimeout(this._playTimeout);
		await this._preloadSound(true);
	}
}

// Native modules
export const RNCacheModule = (RN.NativeModules.MMKVManager
	?? RN.NativeModules.NativeCacheModule);

export const RNChatModule = (RN.NativeModules.DCDChatManager
	?? RN.NativeModules.NativeChatModule);

export const RNFileModule = (RN.NativeModules.RTNFileManager
	?? RN.NativeModules.DCDFileManager
	?? RN.NativeModules.NativeFileModule);
