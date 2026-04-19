/**
 * AudioWorkletProcessor for recording audio
 * 用于录音的 AudioWorklet 处理器
 */
class RecorderProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = 4096;
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;

        // 监听主线程的 flush 命令，将剩余缓冲区数据发送出去
        this.port.onmessage = (event) => {
            if (event.data.command === 'flush' && this.bufferIndex > 0) {
                this.port.postMessage({
                    eventType: 'data',
                    audioData: this.buffer.slice(0, this.bufferIndex)
                });
                this.bufferIndex = 0;
            }
        };
    }

    process(inputs) {
        const input = inputs[0];

        if (input.length > 0) {
            const inputChannel = input[0];

            for (let i = 0; i < inputChannel.length; i++) {
                this.buffer[this.bufferIndex++] = inputChannel[i];

                // 当缓冲区满时，发送数据到主线程
                if (this.bufferIndex >= this.bufferSize) {
                    this.port.postMessage({
                        eventType: 'data',
                        audioData: this.buffer.slice()
                    });
                    this.bufferIndex = 0;
                }
            }
        }

        // 返回 true 表示继续处理
        return true;
    }
}

registerProcessor('recorder-processor', RecorderProcessor);
