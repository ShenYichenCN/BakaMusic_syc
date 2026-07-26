const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
    createChangedConfigPatch,
    createResetConfigUpdate,
} = require("../src/shared/app-config/config-utils");

const sharedValue = { enabled: true };
assert.deepEqual(createChangedConfigPatch(
    { alpha: 1, beta: sharedValue },
    { alpha: 1, beta: sharedValue },
), {});
assert.deepEqual(createChangedConfigPatch(
    { alpha: 1, beta: sharedValue },
    { alpha: 2, beta: sharedValue },
), { alpha: 2 });

assert.deepEqual(createResetConfigUpdate(
    { alpha: 1, secret: "stored" },
    { alpha: 2 },
), {
    config: { alpha: 2 },
    patch: { alpha: 2, secret: null },
});

const mainSource = fs.readFileSync(path.join(
    __dirname,
    "../src/shared/app-config/main.ts",
), "utf8");
assert.match(mainSource, /CONFIG_WRITE_DEBOUNCE_MS/);
assert.match(mainSource, /originalFs\.renameSync\(temporaryPath, this\.configPath\)/);
assert.match(mainSource, /createResetConfigUpdate/);
assert.match(mainSource, /catch \(error\) \{[\s\S]*?配置更新回调执行失败/);
assert.match(mainSource, /ipcMain\.handle\("@shared\/app-config\/set-app-config"/);
assert.match(mainSource, /lyricWritableConfigKeys/);
assert.match(mainSource, /assertIpcSender\(event, \["main", "lyric"\]\)/);
assert.match(mainSource, /senderRole === "lyric"/);
assert.match(mainSource, /@shared\/app-config\/migrate-local-watch-dirs/);
assert.match(mainSource, /grantPathAccess\(directory, true\)/);
assert.match(mainSource, /"download\.fileNamingType"/);
assert.match(mainSource, /"download\.fileNamingPreset"/);
assert.match(mainSource, /"download\.fileNamingCustom"/);
assert.match(mainSource, /"playMusic\.wasapiExclusive"/);

const hostSource = fs.readFileSync(path.join(
    __dirname,
    "../src/shared/native-playback/utility/native-playback-host.ts",
), "utf8");
assert.match(hostSource, /audio-exclusive/);
assert.match(hostSource, /ao", "wasapi"/);
assert.match(hostSource, /BAKAMUSIC_WASAPI_EXCLUSIVE/);
assert.match(hostSource, /audio-device-list/);
assert.match(hostSource, /list-audio-devices/);

const playbackCommonSource = fs.readFileSync(path.join(
    __dirname,
    "../src/shared/native-playback/common.ts",
), "utf8");
assert.match(playbackCommonSource, /operation: "audio-exclusive"/);
assert.match(playbackCommonSource, /INativeAudioOutputDevice/);

const mediaDevicesHookSource = fs.readFileSync(path.join(
    __dirname,
    "../src/hooks/useMediaDevices.ts",
), "utf8");
assert.match(mediaDevicesHookSource, /listAudioDevices/);
assert.match(mediaDevicesHookSource, /fromNativeDevices/);

const defaultConfigSource = fs.readFileSync(path.join(
    __dirname,
    "../src/shared/app-config/default-app-config.ts",
), "utf8");
assert.match(defaultConfigSource, /"download\.fileNamingType": "preset"/);
assert.match(defaultConfigSource, /"download\.fileNamingPreset": "title-artist"/);

const rendererSource = fs.readFileSync(path.join(
    __dirname,
    "../src/shared/app-config/renderer.ts",
), "utf8");
assert.match(rendererSource, /private setupPromise: Promise<void> \| null = null/);
assert.match(rendererSource, /update\.replace/);
assert.match(rendererSource, /public async setConfig/);

const localMusicSource = fs.readFileSync(path.join(
    __dirname,
    "../src/renderer/core/local-music/index.ts",
), "utf8");
assert.match(localMusicSource, /await AppConfig\.migrateLocalWatchDirectories/);
assert.match(
    localMusicSource,
    /filter\(\(item\) => isInSelectedDirs\(item\.\$\$localPath, selectedDirectories\)\)/,
);

// 旧监听目录迁移必须限制授权范围，且不得在主线程同步阻塞
assert.match(mainSource, /function assertMigratableWatchDirectory/);
assert.match(mainSource, /assertMigratableWatchDirectory\(realPath\)/);
assert.match(mainSource, /Legacy watch path is a filesystem root/);
assert.match(mainSource, /Legacy watch path is too broad/);
assert.match(mainSource, /Legacy watch path is inside a system directory/);
const migrationHandler = mainSource.slice(
    mainSource.indexOf("@shared/app-config/migrate-local-watch-dirs"),
);
const migrationHandlerBody = migrationHandler.slice(0, migrationHandler.indexOf("@shared/app-config/reset"));
assert.doesNotMatch(migrationHandlerBody, /statSync|realpathSync/);
assert.match(migrationHandlerBody, /await fs\.stat\(resolved\)/);
assert.match(migrationHandlerBody, /await fs\.realpath\(resolved\)/);

console.log("app-config: all assertions passed");
