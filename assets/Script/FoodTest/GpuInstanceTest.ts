import InstanceBatchRenderer, { InstanceRendererTarget, VertexAttributeLike } from "../Core/GpuInstance/InstanceBatchRenderer";

const { ccclass, property } = cc._decorator;
//@ts-ignore
const gfx = cc.gfx;

type ExtendedMeshRenderer = cc.MeshRenderer & InstanceRendererTarget;

const FLOATS_PER_INSTANCE = 20;

@ccclass
export default class GpuInstanceTest extends cc.Component {
    @property({ type: cc.SpriteAtlas, tooltip: '踩点图集。' })
    atlas: cc.SpriteAtlas | null = null;

    @property({ type: cc.EffectAsset, tooltip: '推荐使用 gpu-footprint-instanced.effect。' })
    effectAsset: cc.EffectAsset | null = null;

    @property({ type: cc.Material, tooltip: '可直接指定材质；为空时运行时根据 effectAsset 创建。' })
    material: cc.Material | null = null;

    @property({ tooltip: '进入场景后自动绘制。' })
    playOnLoad = true;

    @property({ min: 1, tooltip: '踩点数量。' })
    count = 10000;

    @property({ min: 1, tooltip: '踩点尺寸。' })
    footprintSize = 18;

    @property({ tooltip: '指定图集帧名；为空时每个实例随机选图。' })
    spriteFrameName = '';

    @property({ tooltip: '水平留白。' })
    paddingX = 8;

    @property({ tooltip: '垂直留白。' })
    paddingY = 8;

    @property({ tooltip: '是否每帧重建实例数据并重新上传，用于动态压测。' })
    rebuildEveryFrame = true;

    @property({ min: 1, tooltip: '每多少帧打印一次 benchmark 日志。' })
    logIntervalFrames = 60;

    private _meshRenderer: ExtendedMeshRenderer | null = null;
    private _batchRenderer: InstanceBatchRenderer | null = null;
    private _sharedMesh: cc.Mesh | null = null;
    private _sharedMaterial: cc.Material | null = null;
    private _instanceData: Float32Array | null = null;
    private _instanceSourceData: Float32Array | null = null;
    private _resolvedFrames: cc.SpriteFrame[] = [];
    private _instanceFrameIndices: number[] = [];
    private _sourceDataDirty = true;
    private _benchmarkFrames = 0;
    private _benchmarkTotalMs = 0;
    private _benchmarkMaxMs = 0;

    onLoad(): void {
        this._meshRenderer = (this.getComponent(cc.MeshRenderer) || this.addComponent(cc.MeshRenderer)) as ExtendedMeshRenderer;
        this._sharedMesh = this._createQuadMesh();
        this._sharedMaterial = this._createSharedMaterial();

        if (!this._meshRenderer || !this._sharedMesh || !this._sharedMaterial) {
            cc.warn('[GpuInstanceTest] Failed to initialize renderer resources.');
            return;
        }

        this._meshRenderer.mesh = this._sharedMesh;
        this._meshRenderer.enableAutoBatch = false;
        this._meshRenderer.setMaterial(0, this._sharedMaterial);

        if (!(cc.renderer as any).device.caps.supportInstancing) {
            cc.warn('[GpuInstanceTest] Current device/runtime does not support hardware instancing.');
        }

        const attributes: VertexAttributeLike[] = [
            { name: 'a_instanced_transform', type: gfx.ATTR_TYPE_FLOAT32, num: 4, stream: 1, divisor: 1 },
            { name: 'a_instanced_color', type: gfx.ATTR_TYPE_FLOAT32, num: 4, stream: 1, divisor: 1 },
            { name: 'a_instanced_uv_top', type: gfx.ATTR_TYPE_FLOAT32, num: 4, stream: 1, divisor: 1 },
            { name: 'a_instanced_uv_bottom', type: gfx.ATTR_TYPE_FLOAT32, num: 4, stream: 1, divisor: 1 },
            { name: 'a_instanced_misc', type: gfx.ATTR_TYPE_FLOAT32, num: 4, stream: 1, divisor: 1 },
        ];

        this._batchRenderer = new InstanceBatchRenderer({
            renderer: this._meshRenderer,
            gfx,
            stream: 1,
            attributes,
        });
    }

    start(): void {
        if (!this.playOnLoad) {
            return;
        }

        this.renderFootprints();
    }

    update(): void {
        if (!this.rebuildEveryFrame) {
            return;
        }

        const costMs = this._measureMs(() => {
            this.renderFootprints(false);
        });
        this._recordBenchmark(costMs);
    }

    onDestroy(): void {
        if (this._batchRenderer) {
            this._batchRenderer.destroy();
        }
        this._batchRenderer = null;
        this._instanceData = null;
        this._instanceSourceData = null;
        this._resolvedFrames = [];
        this._instanceFrameIndices = [];
        this._sourceDataDirty = true;
        this._meshRenderer = null;
        this._sharedMesh = null;
        this._sharedMaterial = null;
    }

    renderFootprints(logBuild = true): void {
        if (!this._batchRenderer || !this._meshRenderer) {
            cc.warn('[GpuInstanceTest] Renderer is not initialized.');
            return;
        }

        if (!this.atlas) {
            cc.warn('[GpuInstanceTest] Missing sprite atlas.');
            return;
        }

        const spriteFrames = this._getResolvedFrames();
        if (spriteFrames.length === 0) {
            cc.warn('[GpuInstanceTest] Sprite atlas does not contain usable frames.');
            return;
        }

        const texture = spriteFrames[0].getTexture();
        if (!texture) {
            cc.warn('[GpuInstanceTest] Sprite frame texture is missing.');
            return;
        }

        if (this._sharedMaterial) {
            this._sharedMaterial.setProperty('mainTexture', texture);
        }

        this._ensureInstanceData(this.count);
        this._ensureSourceData(this.count);
        this._ensureFrameSelection(spriteFrames.length, this.count);
        let actualCount = 0;
        const buildCostMs = this._measureMs(() => {
            actualCount = this._writeInstanceData(this.count, spriteFrames);
            this._batchRenderer!.upload(this._instanceData!, actualCount);
        });

        if (logBuild) {
            cc.log(
                `[GpuInstanceTest] mode=${this.rebuildEveryFrame ? 'dynamic' : 'static'} count=${actualCount} ` +
                `atlasFrames=${spriteFrames.length} initCost=${buildCostMs.toFixed(3)}ms`
            );
        }
    }

    private _resolveSpriteFrames(): cc.SpriteFrame[] {
        if (!this.atlas) {
            return [];
        }

        if (this.spriteFrameName) {
            const frame = this.atlas.getSpriteFrame(this.spriteFrameName);
            if (frame) {
                return [frame];
            }

            cc.warn(`[GpuInstanceTest] SpriteFrame "${this.spriteFrameName}" not found. Falling back to random atlas frames.`);
        }

        return this.atlas.getSpriteFrames().filter((frame) => !!frame && !!frame.getTexture());
    }

    private _getResolvedFrames(): cc.SpriteFrame[] {
        if (this._resolvedFrames.length > 0) {
            return this._resolvedFrames;
        }

        this._resolvedFrames = this._resolveSpriteFrames();
        return this._resolvedFrames;
    }

    private _ensureInstanceData(instanceCount: number): void {
        const floatCount = Math.max(1, instanceCount) * FLOATS_PER_INSTANCE;
        if (!this._instanceData || this._instanceData.length < floatCount) {
            this._instanceData = new Float32Array(floatCount);
        }
    }

    private _ensureSourceData(instanceCount: number): void {
        const floatCount = Math.max(1, instanceCount) * FLOATS_PER_INSTANCE;
        if (!this._instanceSourceData || this._instanceSourceData.length !== floatCount) {
            this._instanceSourceData = new Float32Array(floatCount);
            this._sourceDataDirty = true;
        }
    }

    private _ensureFrameSelection(frameCount: number, instanceCount: number): void {
        const count = Math.max(0, instanceCount | 0);
        if (this._instanceFrameIndices.length === count) {
            return;
        }

        this._instanceFrameIndices = new Array(count);
        for (let i = 0; i < count; i++) {
            this._instanceFrameIndices[i] = frameCount <= 1 ? 0 : ((Math.random() * frameCount) | 0);
        }
        this._sourceDataDirty = true;
    }

    private _writeInstanceData(instanceCount: number, spriteFrames: cc.SpriteFrame[]): number {
        this._populateSourceDataIfNeeded(instanceCount, spriteFrames);
        const floatCount = Math.max(0, instanceCount | 0) * FLOATS_PER_INSTANCE;
        this._instanceData!.set(this._instanceSourceData!.subarray(0, floatCount), 0);
        return floatCount / FLOATS_PER_INSTANCE;
    }

    private _populateSourceDataIfNeeded(instanceCount: number, spriteFrames: cc.SpriteFrame[]): void {
        const count = Math.max(0, instanceCount | 0);
        if (!this._instanceSourceData || this._instanceSourceData.length < count * FLOATS_PER_INSTANCE) {
            return;
        }

        if (!this._sourceDataDirty) {
            return;
        }

        const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
        const rows = Math.max(1, Math.ceil(count / columns));
        const width = Math.max(this.footprintSize, cc.winSize.width - this.paddingX * 2);
        const height = Math.max(this.footprintSize, cc.winSize.height - this.paddingY * 2);
        const stepX = columns > 1 ? width / (columns - 1) : 0;
        const stepY = rows > 1 ? height / (rows - 1) : 0;
        const startX = -width * 0.5;
        const startY = height * 0.5;

        let cursor = 0;
        for (let i = 0; i < count; i++) {
            const frame = spriteFrames[this._instanceFrameIndices[i] || 0];
            if (!frame) {
                continue;
            }

            const col = i % columns;
            const row = Math.floor(i / columns);
            const x = startX + col * stepX;
            const y = startY - row * stepY;
            const rotation = Math.random() * Math.PI * 2;
            const uv = this._buildUvQuad(frame);

            this._instanceSourceData![cursor++] = x;
            this._instanceSourceData![cursor++] = y;
            this._instanceSourceData![cursor++] = this.footprintSize;
            this._instanceSourceData![cursor++] = this.footprintSize;

            this._instanceSourceData![cursor++] = 1;
            this._instanceSourceData![cursor++] = 1;
            this._instanceSourceData![cursor++] = 1;
            this._instanceSourceData![cursor++] = 1;

            this._instanceSourceData![cursor++] = uv[0];
            this._instanceSourceData![cursor++] = uv[1];
            this._instanceSourceData![cursor++] = uv[2];
            this._instanceSourceData![cursor++] = uv[3];

            this._instanceSourceData![cursor++] = uv[4];
            this._instanceSourceData![cursor++] = uv[5];
            this._instanceSourceData![cursor++] = uv[6];
            this._instanceSourceData![cursor++] = uv[7];

            this._instanceSourceData![cursor++] = rotation;
            this._instanceSourceData![cursor++] = 0;
            this._instanceSourceData![cursor++] = 0;
            this._instanceSourceData![cursor++] = 0;
        }

        this._sourceDataDirty = false;
    }

    private _buildUvQuad(spriteFrame: cc.SpriteFrame): number[] {
        const uv = (spriteFrame as any).uv as number[] | undefined;
        if (uv && uv.length >= 8) {
            // Convert SpriteFrame uv [bl, br, tl, tr] to [tl, tr, bl, br].
            return [
                uv[4], uv[5],
                uv[6], uv[7],
                uv[0], uv[1],
                uv[2], uv[3],
            ];
        }

        const texture = spriteFrame.getTexture();
        const rect = spriteFrame.getRect();
        const texWidth = texture ? texture.width : 1;
        const texHeight = texture ? texture.height : 1;
        const left = rect.x / texWidth;
        const right = (rect.x + rect.width) / texWidth;
        const top = rect.y / texHeight;
        const bottom = (rect.y + rect.height) / texHeight;

        return [
            left, top,
            right, top,
            left, bottom,
            right, bottom,
        ];
    }

    private _createSharedMaterial(): cc.Material | null {
        let material = this.material;
        if (!material && this.effectAsset) {
            material = cc.Material.create(this.effectAsset, 0);
        }

        if (!material) {
            return null;
        }

        material.define('USE_INSTANCING', true);
        material.setProperty('alphaThreshold', 0.01);
        return material;
    }

    private _createQuadMesh(): cc.Mesh | null {
        const vfmt = new gfx.VertexFormat([
            { name: gfx.ATTR_POSITION, type: gfx.ATTR_TYPE_FLOAT32, num: 3 },
            { name: gfx.ATTR_UV0, type: gfx.ATTR_TYPE_FLOAT32, num: 2 },
        ]);

        const mesh = new cc.Mesh();
        //@ts-ignore
        mesh.init(vfmt, 4, false, 0);
        mesh.setVertices(gfx.ATTR_POSITION, [
            cc.v3(-0.5, 0.5, 0),
            cc.v3(-0.5, -0.5, 0),
            cc.v3(0.5, 0.5, 0),
            cc.v3(0.5, -0.5, 0),
        ]);
        mesh.setVertices(gfx.ATTR_UV0, [
            cc.v2(0, 0),
            cc.v2(0, 1),
            cc.v2(1, 0),
            cc.v2(1, 1),
        ]);
        mesh.setIndices([0, 1, 2, 1, 3, 2]);
        mesh.setBoundingBox(cc.v3(-0.5, -0.5, -0.01), cc.v3(0.5, 0.5, 0.01));
        return mesh;
    }

    private _measureMs(fn: () => void): number {
        const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
        fn();
        const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
        return end - start;
    }

    private _recordBenchmark(costMs: number): void {
        this._benchmarkFrames++;
        this._benchmarkTotalMs += costMs;
        if (costMs > this._benchmarkMaxMs) {
            this._benchmarkMaxMs = costMs;
        }

        const interval = Math.max(1, this.logIntervalFrames | 0);
        if (this._benchmarkFrames < interval) {
            return;
        }

        const avgMs = this._benchmarkTotalMs / this._benchmarkFrames;
        cc.log(
            `[GpuInstanceTest][Benchmark] mode=${this.rebuildEveryFrame ? 'dynamic' : 'static'} count=${this.count} ` +
            `avgUpdate=${avgMs.toFixed(3)}ms maxUpdate=${this._benchmarkMaxMs.toFixed(3)}ms frames=${this._benchmarkFrames}`
        );

        this._benchmarkFrames = 0;
        this._benchmarkTotalMs = 0;
        this._benchmarkMaxMs = 0;
    }
}
