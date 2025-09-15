import { create } from "zustand";

interface LangStore {
	lang: string;
	setLang: (lang: string) => void;
}

export const useLangStore = create<LangStore>((set) => ({
	lang: "en",
	setLang: (lang) => set({ lang }),
}));
