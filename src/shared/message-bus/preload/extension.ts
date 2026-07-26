import { ipcRenderer } from "electron";
import { IAppState, ICommand, IPortMessage } from "@shared/message-bus/type";
import EventEmitter from "eventemitter3";
import exposeInMainWorld from "@/preload/expose-in-main-world";

let extPort: MessagePort | null = null;
let appState: IAppState = {};
const ee = new EventEmitter<{
    stateChanged: [IAppState, IAppState];
}>();

// 初始化
let connected = false;
let pingTimer: NodeJS.Timeout | null = null;
// 缓存未建立连接时的消息
const cachedMessages: IPortMessage[] = [];
// 记录本窗口订阅的字段，端口重建后需要重新登记
let subscribedKeys: (keyof IAppState)[] | null = null;

ipcRenderer.on("port", (e) => {
    const nextPort = e.ports[0];
    if (!nextPort) {
        return;
    }
    // 主窗口重建后主进程会重新派发端口：先彻底断开旧端口，避免 ping 定时器
    // 泄漏，并把订阅重新排队，让新的主 renderer 重新登记本窗口。
    if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = null;
    }
    if (extPort) {
        extPort.onmessage = null;
        extPort.close();
        connected = false;
        if (subscribedKeys) {
            cachedMessages.push({
                type: "subscribeAppState",
                payload: subscribedKeys,
                timestamp: Date.now(),
            });
        }
    }
    extPort = nextPort;
    pingTimer = setInterval(() => {
        // 向主进程发送 ping
        extPort?.postMessage({
            type: "ping",
            timestamp: Date.now(),
        });
    }, 300);
    extPort.onmessage = (evt) => {
        const data = evt.data;

        if (data.type === "syncAppState") {
            appState = {
                ...appState,
                ...(data.payload || {}),
            };
            ee.emit("stateChanged", appState, data.payload || {});
        } else if (data.type === "ping") {
            connected = true;
            if (pingTimer) {
                clearInterval(pingTimer);
            }
            pingTimer = null;
            if (cachedMessages.length) {
                cachedMessages.forEach((message) => {
                    extPort?.postMessage(message);
                });
                cachedMessages.length = 0;
            }
        }
    };
});

function sendCommand<T extends keyof ICommand>(command: T, data?: ICommand[T]) {
    const message: IPortMessage = {
        type: "command",
        payload: {
            command,
            data,
        },
        timestamp: Date.now(),
    };

    if (!extPort || !connected) {
        cachedMessages.push(message);
        return;
    }
    extPort.postMessage(message);
}

function subscribeAppState(keys: (keyof IAppState)[]) {
    subscribedKeys = keys;
    const message: IPortMessage = {
        type: "subscribeAppState",
        payload: keys,
        timestamp: Date.now(),
    };

    if (!extPort || !connected) {
        cachedMessages.push(message);
        return;
    }
    extPort.postMessage(message);
}

function getAppState() {
    return appState;
}

function onStateChange(
    cb: (appState: IAppState, changedAppState: IAppState) => void,
) {
    ee.on("stateChanged", cb);
}

function offStateChange(
    cb: (appState: IAppState, changedAppState: IAppState) => void,
) {
    ee.off("stateChanged", cb);
}

const mod = {
    getAppState,
    subscribeAppState,
    sendCommand,
    onStateChange,
    offStateChange,
};

exposeInMainWorld("@shared/message-bus/extension", mod);
