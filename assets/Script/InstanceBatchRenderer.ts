export interface VertexAttributeLike {
    name: string;
    type: number;
    num: number;
    stream?: number;
    divisor?: number;
    normalize?: boolean;
}

export interface InstanceRendererTarget {
    setVertexStream(stream: number, buffer: any, start?: number, divisor?: number, subMeshIndex?: number): boolean;
    setInstanceCount(count: number, subMeshIndex?: number): boolean;
}

export interface InstanceBatchRendererOptions {
    renderer: InstanceRendererTarget | null;
    gfx: any;
    stream?: number;
    attributes?: VertexAttributeLike[];
}

const DEFAULT_STREAM = 1;

export default class InstanceBatchRenderer {
    private _renderer: InstanceRendererTarget | null;
    private _gfx: any;
    private _stream: number;
    private _instanceFormat: any;
    private _capacity = 0;
    private _floatStride: number;
    private _instanceBytes = 0;
    private _data: Float32Array | null = null;
    private _vertexBuffer: any = null;

    constructor(options: InstanceBatchRendererOptions) {
        this._renderer = options.renderer || null;
        this._gfx = options.gfx;
        this._stream = options.stream === undefined ? DEFAULT_STREAM : options.stream;
        this._instanceFormat = new this._gfx.VertexFormat(options.attributes || []);
        this._floatStride = this._instanceFormat._bytes / 4;
    }

    destroy(): void {
        if (this._vertexBuffer) {
            this._vertexBuffer.destroy();
            this._vertexBuffer = null;
        }
        this._data = null;
        this._capacity = 0;
    }

    upload(sourceData: Float32Array, instanceCount: number): boolean {
        if (!this._renderer || !this._gfx) {
            return false;
        }

        if (instanceCount <= 0) {
            this._renderer.setInstanceCount(0);
            return true;
        }

        this._ensureCapacity(instanceCount);

        const floatCount = instanceCount * this._floatStride;
        this._data!.set(sourceData.subarray(0, floatCount), 0);
        this._vertexBuffer.update(0, this._data!.subarray(0, floatCount));
        this._renderer.setVertexStream(this._stream, this._vertexBuffer, 0, 1);
        this._renderer.setInstanceCount(instanceCount);
        return true;
    }

    private _ensureCapacity(instanceCount: number): void {
        if (instanceCount <= this._capacity && this._vertexBuffer) {
            return;
        }

        let nextCapacity = this._capacity > 0 ? this._capacity : 1;
        while (nextCapacity < instanceCount) {
            nextCapacity *= 2;
        }

        this._capacity = nextCapacity;
        this._instanceBytes = this._capacity * this._instanceFormat._bytes;
        this._data = new Float32Array(this._instanceBytes / 4);

        if (this._vertexBuffer) {
            this._vertexBuffer.destroy();
        }

        this._vertexBuffer = new this._gfx.VertexBuffer(
            //@ts-ignore
            cc.renderer.device,
            this._instanceFormat,
            this._gfx.USAGE_DYNAMIC,
            this._data
        );
    }
}
