import OpenCC from "opencc-js/t2cn";

export type SearchableValue = string | number | null | undefined;

export interface ISearchMatchOptions {
    caseSensitive?: boolean;
}

const traditionalToSimplified = OpenCC.Converter({
    from: "t",
    to: "cn",
});
const combiningMarksPattern = /\p{M}+/gu;
const compactSeparatorsPattern = /[\p{P}\p{S}\s]+/gu;

export function normalizeSearchValue(
    value: SearchableValue,
    options: ISearchMatchOptions = {},
) {
    if (value === null || value === undefined) {
        return "";
    }

    const compatibleText = String(value).normalize("NFKC");
    const simplifiedText = traditionalToSimplified(compatibleText)
        .normalize("NFKD")
        .replace(combiningMarksPattern, "");
    return (options.caseSensitive ? simplifiedText : simplifiedText.toLocaleLowerCase())
        .trim()
        .replace(/\s+/gu, " ");
}

function compactSearchValue(value: string) {
    return value.replace(compactSeparatorsPattern, "");
}

/**
 * 逐键过滤时被搜的字段本身不会变，只有 query 在变。归一化一次要跑
 * NFKC + OpenCC 繁简 + NFKD + 若干正则，10k 首 × 5 个字段 = 每次按键
 * 五万次重复计算，所以按原始字符串缓存结果。超过上限直接清空（比维护
 * LRU 更便宜，命中率损失只在切换超大库时出现）。
 */
const MAX_CACHED_VALUES = 100_000;
const normalizedValueCache = new Map<string, string>();
const compactValueCache = new Map<string, string>();

function cachedNormalizeValue(
    value: SearchableValue,
    options: ISearchMatchOptions,
) {
    if (value === null || value === undefined) {
        return "";
    }
    const raw = String(value);
    if (!raw) {
        return "";
    }
    const cacheKey = `${options.caseSensitive ? 1 : 0} ${raw}`;
    const cached = normalizedValueCache.get(cacheKey);
    if (cached !== undefined) {
        return cached;
    }
    const normalized = normalizeSearchValue(raw, options);
    if (normalizedValueCache.size >= MAX_CACHED_VALUES) {
        normalizedValueCache.clear();
    }
    normalizedValueCache.set(cacheKey, normalized);
    return normalized;
}

function cachedCompactValue(value: string) {
    if (!value) {
        return "";
    }
    const cached = compactValueCache.get(value);
    if (cached !== undefined) {
        return cached;
    }
    const compact = compactSearchValue(value);
    if (compactValueCache.size >= MAX_CACHED_VALUES) {
        compactValueCache.clear();
    }
    compactValueCache.set(value, compact);
    return compact;
}

export function createSearchMatcher(
    query: string,
    options: ISearchMatchOptions = {},
) {
    const normalizedQuery = normalizeSearchValue(query, options);
    const compactQuery = compactSearchValue(normalizedQuery);
    const tokens = normalizedQuery.split(/\s+/u).filter(Boolean);

    return (values: ReadonlyArray<SearchableValue>) => {
        if (!normalizedQuery) {
            return true;
        }

        const normalizedValues = values
            .map((value) => cachedNormalizeValue(value, options))
            .filter(Boolean);
        const searchableText = normalizedValues.join("\n");
        if (searchableText.includes(normalizedQuery)) {
            return true;
        }

        const compactValues = normalizedValues.map(cachedCompactValue);
        if (
            compactQuery.length >= 2
            && compactValues.some((value) => value.includes(compactQuery))
        ) {
            return true;
        }

        return tokens.length > 1 && tokens.every((token) => {
            if (searchableText.includes(token)) {
                return true;
            }
            const compactToken = compactSearchValue(token);
            return compactToken.length >= 2
                && compactValues.some((value) => value.includes(compactToken));
        });
    };
}

export function matchesSearchValues(
    values: ReadonlyArray<SearchableValue>,
    query: string,
    options: ISearchMatchOptions = {},
) {
    return createSearchMatcher(query, options)(values);
}
