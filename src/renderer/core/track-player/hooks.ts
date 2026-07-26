import _trackPlayerStore from "@renderer/core/track-player/store";
import { useCallback } from "react";

const {
    musicQueueStore,
    currentMusicStore,
    currentLyricStore,
    repeatModeStore,
    progressStore,
    playerStateStore,
    currentVolumeStore,
    isMuteStore,
    currentSpeedStore,
    currentPitchStore,
    currentQualityStore,
} = _trackPlayerStore;

export const useCurrentMusic = currentMusicStore.useValue;

export const useProgress = progressStore.useValue;

export const usePlayerState = playerStateStore.useValue;

export const useRepeatMode = repeatModeStore.useValue;

export const useMusicQueue = musicQueueStore.useValue;

export const useLyric = currentLyricStore.useValue;

/**
 * 逐字歌词播放时 currentLyricStore 几乎每个 tick 都会换新对象。只需要 parser
 * 或"是否仍在加载"的消费者应该用下面两个 selector，避免整棵子树跟着重渲染。
 */
export const useLyricParser = () => currentLyricStore.useSelector(
    (lyric) => lyric?.parser ?? null,
);

export const useIsLyricLoading = () => currentLyricStore.useSelector(
    (lyric) => lyric === null,
);

/**
 * 进度每 200ms 更新一次。歌词面板在 MusicDetail 关闭后仍保持挂载
 * （AnimatedDiv keepMounted），inactive 时选出常量以彻底切断重渲染。
 */
export const useProgressMsWhenActive = (active: boolean) => {
    const selector = useCallback(
        (progress: { currentTime: number }) => (
            active ? Math.round((progress.currentTime ?? 0) * 1000) : 0
        ),
        [active],
    );
    return progressStore.useSelector(selector);
};

export const useVolume = currentVolumeStore.useValue;

export const useIsMute = isMuteStore.useValue;

export const useSpeed = currentSpeedStore.useValue;

export const usePitch = currentPitchStore.useValue;

export const useQuality = currentQualityStore.useValue;
