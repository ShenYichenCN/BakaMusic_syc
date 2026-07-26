import type { IAppConfig } from "../../types/app-config";

export interface IAppConfigUpdate {
    config?: IAppConfig;
    patch: IAppConfig;
    replace?: boolean;
}

export function createChangedConfigPatch(
    currentConfig: IAppConfig | null,
    incomingPatch: IAppConfig,
): IAppConfig {
    const current = currentConfig as Record<string, unknown> | null;
    const incoming = incomingPatch as Record<string, unknown>;
    const changedPatch: Record<string, unknown> = {};

    for (const key of Object.keys(incoming)) {
        const incomingValue = incoming[key];
        // 对象值可能被调用方原地修改后传回：引用相等无法证明内容未变，
        // 一律保留在补丁中，由接收方按自身副本再判定。
        if (
            (typeof incomingValue === "object" && incomingValue !== null)
            || !Object.is(current?.[key], incomingValue)
        ) {
            changedPatch[key] = incomingValue;
        }
    }
    return changedPatch as IAppConfig;
}

export function createResetConfigUpdate(
    currentConfig: IAppConfig | null,
    defaultConfig: IAppConfig,
): Required<Pick<IAppConfigUpdate, "config" | "patch">> {
    const config = { ...defaultConfig };
    const patch = createChangedConfigPatch(currentConfig, config);
    const current = currentConfig as Record<string, unknown> | null;
    const next = config as Record<string, unknown>;
    const changedPatch = patch as Record<string, unknown>;

    for (const key of Object.keys(current ?? {})) {
        if (!(key in next)) {
            changedPatch[key] = null;
        }
    }
    return { config, patch };
}
