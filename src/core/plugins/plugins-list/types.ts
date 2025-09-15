export interface FullPlugin {
    name: string;
    description: string;
    authors: string[];
    status: "working" | "broken" | "warning";
    sourceUrl?: string;
    installUrl: string;
    warningMessage?: string;
}
