import { IAppState, ICommand } from "@shared/message-bus/type";
import { IWindowManager } from "@/types/window-manager";
import { BrowserWindow, ipcMain, MessageChannelMain } from "electron";
import { PlayerState, RepeatMode } from "@/common/constant";
import EventEmitter from "eventemitter3";
import {
    assertIpcPayload,
    assertPlainObject,
    isIpcSenderAllowed,
} from "@shared/ipc-security/main";

/**
 * 消息总线
 * 包括应用状态、指令的同步
 */
class MessageBus {

    private windowManager!: IWindowManager;
    private extensionWindowIds = new Set<number>();
    /** 已绑定 close→unmount 通知的扩展窗口，避免重建端口时重复注册。 */
    private unmountBoundWindows = new WeakSet<BrowserWindow>();
    private appState: IAppState = {
        musicItem: null,
        playerState: PlayerState.None,
        repeatMode: RepeatMode.Loop,
        lyricText: null,
    };
    private ee = new EventEmitter<{
        stateChanged: [IAppState, IAppState]
    }>();

    public setup(windowManager: IWindowManager) {
        this.windowManager = windowManager;

        // 配置现有窗口
        const extensionWindows = this.windowManager.getExtensionWindows();
        for (const bWindow of extensionWindows) {
            this.createPortForExtensionWindow(bWindow);
        }
        windowManager.on("WindowCreated", (data) => {
            if (data.windowName !== "main") {
                this.createPortForExtensionWindow(data.browserWindow);
                return;
            }
            // 主窗口可以在歌词/迷你窗口存活时被销毁并重建。旧端口的对端在已死的
            // renderer 里，不重新建连的话扩展窗口会永久失去状态同步和指令通道。
            for (const bWindow of this.windowManager.getExtensionWindows()) {
                this.createPortForExtensionWindow(bWindow);
            }
        });

        ipcMain.on("@shared/message-bus/sync-app-state", (event, data: IAppState) => {
            if (!isIpcSenderAllowed(event, ["main"])) {
                return;
            }
            try {
                assertIpcPayload(data, 2 * 1024 * 1024);
                assertPlainObject(data, "app state");
                const allowedKeys = new Set([
                    "musicItem",
                    "playerState",
                    "repeatMode",
                    "lyricText",
                    "parsedLrc",
                    "fullLyric",
                    "progress",
                    "duration",
                    "lyricClock",
                ]);
                if (Object.keys(data).some((key) => !allowedKeys.has(key))) {
                    throw new Error("App state contains an unknown key");
                }
            } catch {
                return;
            }
            this.appState = {
                ...this.appState,
                ...data,
            };
            this.ee.emit("stateChanged", this.appState, data);
        });
    }

    public onAppStateChange(cb: (state: IAppState, changedAppState: IAppState) => void) {
        this.ee.on("stateChanged", cb);
    }

    /**
     * 发送指令
     * @param command 指令
     * @param data 数据
     */
    public sendCommand<T extends keyof ICommand>(command: T, data?: ICommand[T]) {
        const mainWindow = this.windowManager.mainWindow;
        // 托盘菜单和 deep link 会在主窗口销毁后继续发指令，访问已销毁窗口的
        // webContents 会抛 "Object has been destroyed"。
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("@shared/message-bus/message", {
                type: "command",
                payload: {
                    command,
                    data,
                },
                timestamp: Date.now(),
            });
        }
    }

    public getAppState() {
        return this.appState;
    }

    // 创建通信端口
    private createPortForExtensionWindow(bWindow: BrowserWindow) {
        const mainWindow = this.windowManager.mainWindow;
        if (
            !mainWindow
            || mainWindow.isDestroyed()
            || bWindow === mainWindow
            || bWindow.isDestroyed()
        ) {
            return;
        }
        const { port1, port2 } = new MessageChannelMain();
        const extWindowId = bWindow.id;
        this.extensionWindowIds.add(extWindowId);

        // 通知主窗口更新
        mainWindow.webContents.postMessage("port", {
            payload: extWindowId,
            type: "mount",
            timestamp: Date.now(),
        }, [port1]);

        bWindow.webContents.postMessage("port", null, [port2]);

        // 重建端口时不要叠加 close 监听；unmount 通知必须取当前主窗口，
        // 否则会 post 到已销毁的旧主窗口上抛异常。
        if (this.unmountBoundWindows.has(bWindow)) {
            return;
        }
        this.unmountBoundWindows.add(bWindow);
        bWindow.on("close", () => {
            const currentMainWindow = this.windowManager.mainWindow;
            if (currentMainWindow && !currentMainWindow.isDestroyed()) {
                currentMainWindow.webContents.postMessage("port", {
                    payload: extWindowId,
                    type: "unmount",
                    timestamp: Date.now(),
                });
            }
            this.extensionWindowIds.delete(extWindowId);
        });

    }
}


const messageBus = new MessageBus();
export default messageBus;
