declare module 'kafkajs-snappy' {
    export const SnappyCodec: () => {
        compress(encoder: { buffer: Buffer }): Promise<Buffer>;
        decompress(buffer: Buffer): Promise<Buffer>;
    };
}
