const assert = require("node:assert/strict");
const sharp = require("sharp");
const {
    COMPATIBLE_COVER_MAX_BYTES,
    COMPATIBLE_COVER_MAX_EDGE,
    prepareDownloadCoverImage,
} = require("../src/common/download-cover-image.ts");

async function run() {
    const original = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const preserved = await prepareDownloadCoverImage(
        original,
        "image/jpeg",
        "original",
    );
    assert.strictEqual(preserved.data, original);
    assert.equal(preserved.mimeType, "image/jpeg");

    const width = 1600;
    const height = 1200;
    const pixels = Buffer.alloc(width * height * 4);
    for (let index = 0; index < pixels.length; index += 4) {
        pixels[index] = 40;
        pixels[index + 1] = 120;
        pixels[index + 2] = 220;
        pixels[index + 3] = index % 16 === 0 ? 0 : 255;
    }
    const png = await sharp(pixels, {
        raw: { width, height, channels: 4 },
    }).png().toBuffer();

    const compatible = await prepareDownloadCoverImage(
        png,
        "image/png",
        "compatible-jpeg",
    );
    assert.equal(compatible.mimeType, "image/jpeg");
    assert.deepEqual(
        [...compatible.data.subarray(0, 3)],
        [0xff, 0xd8, 0xff],
    );
    assert.ok(compatible.data.length <= COMPATIBLE_COVER_MAX_BYTES);

    const metadata = await sharp(compatible.data).metadata();
    assert.equal(metadata.format, "jpeg");
    assert.ok((metadata.width ?? 0) <= COMPATIBLE_COVER_MAX_EDGE);
    assert.ok((metadata.height ?? 0) <= COMPATIBLE_COVER_MAX_EDGE);
    assert.equal(metadata.space, "srgb");
    assert.equal(metadata.isProgressive, false);

    const transparentPng = await sharp({
        create: {
            width: 8,
            height: 8,
            channels: 4,
            background: { r: 20, g: 30, b: 40, alpha: 0 },
        },
    }).png().toBuffer();
    const flattened = await prepareDownloadCoverImage(
        transparentPng,
        "image/png",
        "compatible-jpeg",
    );
    const flattenedPixels = await sharp(flattened.data).raw().toBuffer();
    assert.ok([...flattenedPixels].every((channel) => channel >= 250));

    const webp = await sharp(pixels, {
        raw: { width, height, channels: 4 },
    }).webp().toBuffer();
    const convertedWebp = await prepareDownloadCoverImage(
        webp,
        "image/webp",
        "compatible-jpeg",
    );
    assert.equal((await sharp(convertedWebp.data).metadata()).format, "jpeg");

    console.log("download-cover-image: all assertions passed");
}

void run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
