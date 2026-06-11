import { RibbonRender } from "./RibbonRender";

/** 斜接缩放上限，避免锐角处尖刺无限延伸。 */
const MITER_LIMIT = 20;

export interface RibbonInstanceOptions {
    /** 挂载 RibbonRender 的节点。 */
    node: cc.Node;
    /** Effect；material 为空时据此创建材质。 */
    effect?: cc.EffectAsset | null;
    /** 直接指定材质；优先于 effect。 */
    material?: cc.Material | null;
    /** 丝带纹理（会被设为 wrap=repeat 以支持沿路径平铺）。 */
    texture?: cc.Texture2D | null;
    /** 丝带宽度。 */
    width?: number;
    /** 纹理沿路径的平铺长度（世界单位）；为空时取纹理宽度。 */
    tileLength?: number;
    /** 每段 Catmull-Rom 细分数（>1 平滑转角，1=折线不平滑）。默认 12。 */
    subdivisions?: number;
}

/**
 * 路径丝带渲染（连续三角带）。
 *
 * - 输入 points（节点本地坐标）、texture、width，沿路径绘制一条带宽度的丝带。
 * - 路径经 Catmull-Rom 样条细分平滑；每个（细分）点生成左右两个顶点，相邻段共享顶点，
 *   组成一条连续 triangle-strip → 单次 draw call、MSAA 下无缝、UV 沿弧长连续。
 * - 纹理沿路径按弧长平铺（U = 累积弧长 / tileLength，shader fract 平铺）。
 */
export default class RibbonInstance {
    private _render: RibbonRender | null = null;
    private _material: cc.Material | null = null;

    private _texture: cc.Texture2D | null = null;
    private _width: number;
    private _tileLength: number;
    private _subdivisions: number;

    // 平滑后的路径点（Catmull-Rom 细分结果，复用避免每帧分配）。
    private _smoothPts: cc.Vec2[] = [];
    // 每点斜接法线与缩放、U（按点数复用）。
    private _miterX: Float32Array | null = null;
    private _miterY: Float32Array | null = null;
    private _miterScale: Float32Array | null = null;
    private _miterCap: Float32Array | null = null; // 偏移上限（≈曲率半径），防内侧折叠
    private _u: Float32Array | null = null;
    private _pointCapacity = 0;
    // 输出给 RibbonRender 的左右顶点与 UV（Float32Array，按顶点数复用）。
    private _positions: Float32Array = new Float32Array(0);
    private _uvs: Float32Array = new Float32Array(0);
    private _vertexCapacity = 0;

    constructor(options: RibbonInstanceOptions) {
        this._width = options.width === undefined ? 10 : options.width;
        this._tileLength = options.tileLength || 0;
        this._subdivisions = options.subdivisions === undefined ? 12 : Math.max(1, options.subdivisions | 0);

        const node = options.node;
        this._render = (node.getComponent(RibbonRender) || node.addComponent(RibbonRender)) as RibbonRender;
        this._material = this._createMaterial(options);

        if (!this._render || !this._material) {
            cc.warn('[RibbonInstance] 初始化失败：缺少 RibbonRender / material。');
            return;
        }

        this._render.setMaterial(0, this._material);

        if (options.texture) {
            this.setTexture(options.texture);
        }
        this._applyParam();
        this._render.init(this._texture);
    }

    setWidth(width: number): void {
        this._width = width;
    }

    setTileLength(tileLength: number): void {
        this._tileLength = tileLength;
    }

    /** 每段细分数（>1 平滑转角，1=折线）。 */
    setSubdivisions(subdivisions: number): void {
        this._subdivisions = Math.max(1, subdivisions | 0);
    }

    setTexture(texture: cc.Texture2D | null): void {
        this._texture = texture;
        if (texture) {
            // 关掉动态图集打包，否则采样的是图集、UV 0~1 不对应整张图，平铺失效。
            (texture as any).packable = false;
            const WrapMode = (cc.Texture2D as any).WrapMode;
            (texture as any).setWrapMode(WrapMode.REPEAT, WrapMode.REPEAT);
        }
        if (this._material && texture) {
            this._material.setProperty('texture', texture);
        }
        if (this._render) {
            this._render.init(texture);
        }
    }

    /**
     * 设置路径并立即重建上传。points 为节点本地坐标，至少 2 个点。
     */
    setPath(points: cc.Vec2[]): void {
        if (!this._render) {
            return;
        }

        const m = points ? points.length : 0;
        if (m < 2) {
            // 点数不足：不绘制。
            this._render.setRenderData(0, this._positions, this._uvs);
            return;
        }

        // 路径平滑：Catmull-Rom 样条细分，使转角平滑过渡。
        let src: cc.Vec2[];
        let n: number;
        if (this._subdivisions > 1) {
            n = this._buildSmoothPath(points, m);
            src = this._smoothPts;
        } else {
            src = points;
            n = m;
        }

        this._ensurePointArrays(n);
        this._ensureVertexArrays(n * 2); // 每点 2 顶点
        this._computeArcLengthU(src, n);
        this._computeMiter(src, n);

        // 每个点生成左右两个顶点。
        const halfWidth = this._width * 0.5;
        const positions = this._positions;
        const uvs = this._uvs;
        const mx = this._miterX!;
        const my = this._miterY!;
        const ms = this._miterScale!;
        const cap = this._miterCap!;
        const u = this._u!;

        let vc = 0; // 顶点游标
        for (let i = 0; i < n; i++) {
            const px = src[i].x;
            const py = src[i].y;
            // 偏移按曲率半径钳制，避免急转弯内侧折叠。
            let off = halfWidth * ms[i];
            if (off > cap[i]) {
                off = cap[i];
            }
            const ox = mx[i] * off;
            const oy = my[i] * off;
            const ui = u[i];

            // 左顶点（+法线）
            positions[2 * vc] = px + ox;
            positions[2 * vc + 1] = py + oy;
            uvs[2 * vc] = ui;
            uvs[2 * vc + 1] = 0;
            vc++;

            // 右顶点（-法线）
            positions[2 * vc] = px - ox;
            positions[2 * vc + 1] = py - oy;
            uvs[2 * vc] = ui;
            uvs[2 * vc + 1] = 1;
            vc++;
        }

        this._render.setRenderData(vc, positions, uvs);
    }

    destroy(): void {
        if (this._render && this._render.isValid) {
            //@ts-ignore
            this._render.destroy();
        }
        this._render = null;
        this._material = null;
        this._texture = null;
        this._smoothPts = [];
        this._miterX = this._miterY = this._miterScale = this._miterCap = this._u = null;
        this._pointCapacity = 0;
        this._positions = new Float32Array(0);
        this._uvs = new Float32Array(0);
        this._vertexCapacity = 0;
    }

    /**
     * Catmull-Rom 样条细分，把折线 points 平滑为曲线，结果写入复用的 _smoothPts。
     * 返回平滑后点数 = (m-1)*subdivisions + 1。
     */
    private _buildSmoothPath(points: cc.Vec2[], m: number): number {
        const sub = this._subdivisions;
        const count = (m - 1) * sub + 1;
        this._ensureSmoothPts(count);
        const out = this._smoothPts;

        let idx = 0;
        for (let i = 0; i < m - 1; i++) {
            const p0 = points[i > 0 ? i - 1 : i];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[i + 2 < m ? i + 2 : i + 1];
            for (let j = 0; j < sub; j++) {
                const t = j / sub;
                const t2 = t * t;
                const t3 = t2 * t;
                out[idx].x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t
                    + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2
                    + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
                out[idx].y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t
                    + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2
                    + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
                idx++;
            }
        }
        // 末点精确落在最后一个控制点上。
        const last = points[m - 1];
        out[idx].x = last.x;
        out[idx].y = last.y;
        idx++;
        return idx;
    }

    private _ensureSmoothPts(count: number): void {
        while (this._smoothPts.length < count) {
            this._smoothPts.push(cc.v2(0, 0));
        }
    }

    /** 累积弧长 → 每点 U。 */
    private _computeArcLengthU(points: cc.Vec2[], m: number): void {
        const tileLength = this._resolveTileLength();
        const u = this._u!;
        u[0] = 0;
        let accLen = 0;
        for (let i = 1; i < m; i++) {
            const dx = points[i].x - points[i - 1].x;
            const dy = points[i].y - points[i - 1].y;
            accLen += Math.sqrt(dx * dx + dy * dy);
            u[i] = accLen / tileLength;
        }
    }

    /** 每点斜接法线与缩放。端点退化为段法线；内部点取相邻段法线的角平分方向。 */
    private _computeMiter(points: cc.Vec2[], m: number): void {
        const mx = this._miterX!;
        const my = this._miterY!;
        const ms = this._miterScale!;
        const cap = this._miterCap!;

        for (let i = 0; i < m; i++) {
            let inX = 0, inY = 0, outX = 0, outY = 0;
            let inLen = 0, outLen = 0;
            let hasIn = false, hasOut = false;

            if (i > 0) {
                const dx = points[i].x - points[i - 1].x;
                const dy = points[i].y - points[i - 1].y;
                inLen = Math.sqrt(dx * dx + dy * dy) || 1;
                inX = -dy / inLen; // perp(dir)
                inY = dx / inLen;
                hasIn = true;
            }
            if (i < m - 1) {
                const dx = points[i + 1].x - points[i].x;
                const dy = points[i + 1].y - points[i].y;
                outLen = Math.sqrt(dx * dx + dy * dy) || 1;
                outX = -dy / outLen;
                outY = dx / outLen;
                hasOut = true;
            }

            let nx: number, ny: number, scale: number;
            let capVal = Infinity;
            if (hasIn && hasOut) {
                let sx = inX + outX;
                let sy = inY + outY;
                const sl = Math.sqrt(sx * sx + sy * sy);
                if (sl < 1e-4) {
                    nx = outX; ny = outY; scale = 1;
                } else {
                    sx /= sl; sy /= sl;
                    const d = sx * inX + sy * inY; // cos(半角)
                    scale = d > 1e-3 ? 1 / d : MITER_LIMIT;
                    if (scale > MITER_LIMIT) scale = MITER_LIMIT;
                    nx = sx; ny = sy;
                }

                // 局部曲率半径 R = d / (2 sin(转角/2))，转角 = 两段方向夹角。
                // 偏移超过 R 时内侧会折叠自交，故钳制偏移 ≤ 0.9R（拐角处略收窄而不破碎）。
                const cosTurn = inX * outX + inY * outY; // = 方向夹角余弦
                const turn = Math.acos(Math.max(-1, Math.min(1, cosTurn)));
                if (turn > 1e-3) {
                    const segLen = 0.5 * (inLen + outLen);
                    capVal = 0.9 * segLen / (2 * Math.sin(turn * 0.5));
                }
            } else if (hasIn) {
                nx = inX; ny = inY; scale = 1;
            } else {
                nx = outX; ny = outY; scale = 1;
            }

            mx[i] = nx;
            my[i] = ny;
            ms[i] = scale;
            cap[i] = capVal;
        }
    }

    private _resolveTileLength(): number {
        if (this._tileLength > 0) {
            return this._tileLength;
        }
        if (this._texture && this._texture.width > 0) {
            return this._texture.width;
        }
        return 64;
    }

    private _applyParam(): void {
        if (!this._material) {
            return;
        }
        this._material.setProperty('alpha', 1);
    }

    private _ensureVertexArrays(vertCount: number): void {
        if (vertCount <= this._vertexCapacity) {
            return;
        }
        this._vertexCapacity = vertCount;
        // 每顶点 2 floats（pos 2 + uv 2 分两组）。
        this._positions = new Float32Array(vertCount * 2);
        this._uvs = new Float32Array(vertCount * 2);
    }

    private _ensurePointArrays(m: number): void {
        if (this._miterX && m <= this._pointCapacity) {
            return;
        }
        this._pointCapacity = m;
        this._miterX = new Float32Array(m);
        this._miterY = new Float32Array(m);
        this._miterScale = new Float32Array(m);
        this._miterCap = new Float32Array(m);
        this._u = new Float32Array(m);
    }

    private _createMaterial(options: RibbonInstanceOptions): cc.Material | null {
        let material = options.material || null;
        if (!material && options.effect) {
            material = cc.Material.create(options.effect, 0);
        }
        return material;
    }
}
