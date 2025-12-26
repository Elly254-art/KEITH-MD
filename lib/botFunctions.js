var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });

const axios = require("axios");
const cheerio = require("cheerio");
const path = require("path");
const util = require("util");
const zlib = require("zlib");
// const sharp = require('sharp');
const { session } = require('../settings');
const FormData = require('form-data');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { Readable } = require('stream');
ffmpeg.setFfmpegPath(ffmpegPath);

/* ========= SAFE file-type IMPORT (ESM compatible) ========= */
async function fromBufferSafe(buffer) {
    const { fileTypeFromBuffer } = await import('file-type');
    return await fileTypeFromBuffer(buffer);
}
/* ========================================================== */

const sessionDir = path.join(__dirname, "..", "session");
const sessionPath = path.join(sessionDir, "creds.json");

async function stickerToImage(webpData, options = {}) {
    try {
        const {
            upscale = true,
            targetSize = 512,
            framesToProcess = 200
        } = options;

        if (Buffer.isBuffer(webpData)) {
            const sharpInstance = sharp(webpData, {
                sequentialRead: true,
                animated: true,
                limitInputPixels: false,
                pages: framesToProcess
            });

            const metadata = await sharpInstance.metadata();
            const isAnimated = metadata.pages > 1 || metadata.hasAlpha;

            if (isAnimated) {
                return await sharpInstance
                    .gif({
                        compressionLevel: 0,
                        quality: 100,
                        effort: 1,
                        loop: 0
                    })
                    .resize({
                        width: upscale ? targetSize : metadata.width,
                        height: upscale ? targetSize : metadata.height,
                        fit: 'contain',
                        background: { r: 0, g: 0, b: 0, alpha: 0 },
                        kernel: 'lanczos3'
                    })
                    .toBuffer();
            } else {
                return await sharpInstance
                    .ensureAlpha()
                    .resize({
                        width: upscale ? targetSize : metadata.width,
                        height: upscale ? targetSize : metadata.height,
                        fit: 'contain',
                        background: { r: 0, g: 0, b: 0, alpha: 0 },
                        kernel: 'lanczos3'
                    })
                    .png({
                        compressionLevel: 0,
                        quality: 100,
                        progressive: false,
                        palette: true
                    })
                    .toBuffer();
            }
        } else if (typeof webpData === 'string') {
            const sharpInstance = sharp(webpData, {
                sequentialRead: true,
                animated: true,
                limitInputPixels: false,
                pages: framesToProcess
            });

            const metadata = await sharpInstance.metadata();
            const isAnimated = metadata.pages > 1 || metadata.hasAlpha;
            const outputPath = webpData.replace(/\.webp$/, isAnimated ? '.gif' : '.png');

            if (isAnimated) {
                await sharpInstance.gif().toFile(outputPath);
            } else {
                await sharpInstance.png().toFile(outputPath);
            }

            const imageBuffer = await fs.promises.readFile(outputPath);
            await fs.promises.unlink(outputPath);
            await fs.promises.unlink(webpData);
            return imageBuffer;
        } else {
            throw new Error('Invalid input type for stickerToImage');
        }
    } catch (error) {
        console.error('Error in stickerToImage:', error);
        throw error;
    }
}

async function withTempFiles(inputBuffer, extension, processFn) {
    const tempInput = `temp_${Date.now()}.input`;
    const tempOutput = `temp_${Date.now()}.${extension}`;

    try {
        fs.writeFileSync(tempInput, inputBuffer);
        await processFn(tempInput, tempOutput);
        return fs.readFileSync(tempOutput);
    } finally {
        if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
        if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
    }
}

async function toAudio(buffer) {
    return withTempFiles(buffer, 'mp3', (input, output) => {
        return new Promise((resolve, reject) => {
            ffmpeg(input)
                .noVideo()
                .audioCodec('libmp3lame')
                .audioBitrate(64)
                .audioChannels(1)
                .toFormat('mp3')
                .on('error', reject)
                .on('end', resolve)
                .save(output);
        });
    });
}

async function toVideo(buffer) {
    return withTempFiles(buffer, 'mp4', (input, output) => {
        return new Promise((resolve, reject) => {
            ffmpeg()
                .input('color=black:s=640x360:r=1')
                .inputOptions(['-f lavfi'])
                .input(input)
                .outputOptions([
                    '-shortest',
                    '-preset ultrafast',
                    '-movflags faststart',
                    '-pix_fmt yuv420p'
                ])
                .videoCodec('libx264')
                .audioCodec('aac')
                .toFormat('mp4')
                .on('error', reject)
                .on('end', resolve)
                .save(output);
        });
    });
}

async function toPtt(buffer) {
    return withTempFiles(buffer, 'ogg', (input, output) => {
        return new Promise((resolve, reject) => {
            ffmpeg(input)
                .audioCodec('libopus')
                .audioBitrate(24)
                .audioChannels(1)
                .audioFrequency(16000)
                .toFormat('ogg')
                .on('error', reject)
                .on('end', resolve)
                .save(output);
        });
    });
}

/* ===== REST OF FILE UNCHANGED ===== */

const sleep = async ms => new Promise(resolve => setTimeout(resolve, ms));

function keithRandom(ext) {
    return `${Date.now()}_${Math.floor(Math.random() * 10000)}${ext}`;
}

module.exports = {
    dBinary,
    eBinary,
    dBase,
    eBase,
    runtime,
    sleep,
    keithFancy,
    stickerToImage,
    toAudio,
    toVideo,
    toPtt,
    formatVideo,
    formatAudio,
    monospace,
    formatBytes,
    keithBuffer,
    keithJson,
    latestWaVersion,
    keithRandom,
    isUrl,
    keithStore,
    isNumber,
    loadSession,
    verifyJidState,
    fromBufferSafe
};
