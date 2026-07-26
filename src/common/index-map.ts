export interface IIndexMap {
    indexOf: (mediaItem?: IMedia.IMediaBase | null) => number;
    has: (mediaItem?: IMedia.IMediaBase | null) => boolean;
    update: (mediaItems?: IMedia.IMediaBase[]) => void;
}

/**
 * 键统一按字符串归一，和 media-util 的 isSameMedia、unique-map 保持同一套媒体
 * 身份语义：插件常返回 number 型 id，而路由参数、持久化数据是 string。用严格
 * 相等做 Map key 会让同一首歌在队列里"找不到"，进而出现重复入队和 currentIndex=-1。
 */
export function createIndexMap(mediaItems?: IMedia.IMediaBase[]): IIndexMap {
    const indexMap: Map<string, Map<string, number>> = new Map();

    update(mediaItems);

    function update(mediaItems?: IMedia.IMediaBase[]) {
        indexMap.clear();
        if (!mediaItems) {
            return;
        }
        mediaItems?.forEach((mediaItem, index) => {
            if (!mediaItem) {
                return;
            }
            const { platform, id } = mediaItem;
            const platformKey = `${platform}`;
            let idMap = indexMap.get(platformKey);
            if (!idMap) {
                idMap = new Map();
                indexMap.set(platformKey, idMap);
            }
            idMap.set(`${id}`, index);
        });
    }

    function indexOf(mediaItem?: IMedia.IMediaBase | null) {
        if (!mediaItem) {
            return -1;
        }
        return indexMap.get(`${mediaItem.platform}`)?.get(`${mediaItem.id}`) ?? -1;
    }

    function has(mediaItem?: IMedia.IMediaBase | null) {
        if (!mediaItem) {
            return false;
        }
        return indexMap.get(`${mediaItem.platform}`)?.has(`${mediaItem.id}`) ?? false;
    }

    return {
        update,
        indexOf,
        has,
    };
}
