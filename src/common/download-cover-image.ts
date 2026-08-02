import type { DownloadCoverImageMode } from "@/common/download-postprocess";

export const COMPATIBLE_COVER_MAX_EDGE = 800;
export const COMPATIBLE_COVER_MAX_BYTES = 1024 * 1024;
export const COMPATIBLE_COVER_MAX_INPUT_PIXELS = 25_000_000;

interface IPreparedDownloadCoverImage {
    data: Buffer;
    mimeType: string;
}

async function encodeCompatibleJpeg(
    input: Buffer,
    maximumEdge: number,
    quality: number,
) {
    const sharp = (await import("sharp")).default;
    return sharp(input, {
        animated: false,
        failOn: "warning",
        limitInputPixels: COMPATIBLE_COVER_MAX_INPUT_PIXELS,
    })
        .rotate()
        .resize({
            width: maximumEdge,
            height: maximumEdge,
            fit: "inside",
            withoutEnlargement: true,
        })
        .flatten({ background: "#ffffff" })
        .toColourspace("srgb")
        .jpeg({
            quality,
            progressive: false,
            chromaSubsampling: "4:2:0",
        })
        .toBuffer();
}

/**
 * Normalize downloaded artwork for conservative hardware-player support.
 * Original mode deliberately keeps both bytes and the detected MIME unchanged.
 */
export async function prepareDownloadCoverImage(
    input: Buffer,
    mimeType: string,
    mode: DownloadCoverImageMode,
): Promise<IPreparedDownloadCoverImage> {
    if (mode === "original") {
        return {
            data: input,
            mimeType,
        };
    }

    let data = await encodeCompatibleJpeg(
        input,
        COMPATIBLE_COVER_MAX_EDGE,
        85,
    );
    if (data.length > COMPATIBLE_COVER_MAX_BYTES) {
        data = await encodeCompatibleJpeg(input, 600, 72);
    }
    if (data.length > COMPATIBLE_COVER_MAX_BYTES) {
        throw new Error(`compatible cover is too large: ${data.length}`);
    }

    return {
        data,
        mimeType: "image/jpeg",
    };
}
