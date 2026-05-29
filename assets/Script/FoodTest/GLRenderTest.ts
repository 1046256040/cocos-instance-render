import { IGLRender } from "../Core/GLRender/IGLRender";
import { FoodsGLNode } from "./FoodsGLNode";

const { ccclass, property } = cc._decorator;

class StaticFood implements IGLRender {
    private active = true;
    private rect: number[];
    private texCoords: number[];
    private x: number;
    private y: number;
    private size: number;
    private direction: number;

    constructor(x: number, y: number, size: number, texCoords: number[], direction: number) {
        const halfSize = size * 0.5;

        this.x = x;
        this.y = y;
        this.size = size;
        this.direction = direction;
        this.texCoords = texCoords.slice();
        this.rect = [
            x - halfSize,
            y - halfSize,
            x + halfSize,
            y + halfSize,
        ];
    }

    isActive(): boolean {
        return this.active;
    }

    getRect(): number[] {
        return this.rect;
    }

    getTexCoords(): number[] {
        return this.texCoords;
    }

    getX(): number {
        return this.x;
    }

    getY(): number {
        return this.y;
    }

    getSize(): number {
        return this.size;
    }

    getDirection(): number {
        return this.direction;
    }
}

@ccclass
export default class GLRenderTest extends cc.Component {

    @property(cc.SpriteAtlas)
    texture: cc.SpriteAtlas = null;

    @property(cc.EffectAsset)
    effectAsset: cc.EffectAsset = null;

    @property({ tooltip: '食物数量。' })
    foodCount = 10000;

    @property({ tooltip: '食物边长（像素）。' })
    foodSize = 16;

    @property({ tooltip: '图集中使用的 SpriteFrame 名称；为空时默认取第一张。' })
    spriteFrameName = '';

    @property({ tooltip: '水平留白，避免贴边。' })
    paddingX = 8;

    @property({ tooltip: '垂直留白，避免贴边。' })
    paddingY = 8;

    @property({ tooltip: '是否每帧重建渲染数据，用于动态压测。' })
    rebuildEveryFrame = true;

    @property({ min: 1, tooltip: '每多少帧打印一次 benchmark 日志。' })
    logIntervalFrames = 60;

    private _foodsNode: FoodsGLNode | null = null;
    private _benchmarkFrames = 0;
    private _benchmarkTotalMs = 0;
    private _benchmarkMaxMs = 0;

    start(): void {
        this.renderFoods();
    }

    protected update(dt: number): void {
        if (!this.rebuildEveryFrame || !this._foodsNode) {
            return;
        }

        const costMs = this._measureMs(() => {
            this._foodsNode!.calRenderData(0, 0, 1);
        });
        this._recordBenchmark(costMs);
    }

    renderFoods(): void {
        if (!this.texture) {
            cc.warn('[GLRenderTest] Missing sprite atlas.');
            return;
        }

        if (!this.effectAsset) {
            cc.warn('[GLRenderTest] Missing effect asset.');
            return;
        }

        const spriteFrame = this._resolveSpriteFrame();
        if (!spriteFrame) {
            cc.warn('[GLRenderTest] Sprite atlas does not contain a usable sprite frame.');
            return;
        }

        const texture = spriteFrame.getTexture();
        if (!texture) {
            cc.warn('[GLRenderTest] Sprite frame texture is missing.');
            return;
        }

        const texCoords = this._buildTexCoords(spriteFrame);
        const foods = this._buildStaticFoods(this.foodCount, this.foodSize, texCoords);
        const foodsNode = this._ensureFoodsNode();
        const buildCostMs = this._measureMs(() => {
            foodsNode.init(texture, this.effectAsset, foods);
            foodsNode.calRenderData(0, 0, 1);
        });

        cc.log(
            `[GLRenderTest] mode=${this.rebuildEveryFrame ? 'dynamic' : 'static'} count=${foods.length} ` +
            `frame="${spriteFrame.name}" initCost=${buildCostMs.toFixed(3)}ms`
        );
    }

    private _resolveSpriteFrame(): cc.SpriteFrame | null {
        const frames = this.texture.getSpriteFrames();
        if (frames.length === 0) {
            return null;
        }

        if (this.spriteFrameName) {
            const namedFrame = this.texture.getSpriteFrame(this.spriteFrameName);
            if (namedFrame) {
                return namedFrame;
            }

            cc.warn(`[GLRenderTest] SpriteFrame "${this.spriteFrameName}" not found. Falling back to a random frame.`);
        }

        const randomIndex = Math.floor(Math.random() * frames.length);
        return frames[randomIndex] || null;
    }

    private _buildTexCoords(spriteFrame: cc.SpriteFrame): number[] {
        const uv = (spriteFrame as any).uv as number[] | undefined;
        if (uv && uv.length >= 8) {
            // SpriteFrame.uv order is [bl, br, tl, tr]; FoodsGLNode expects [tl, tr, bl, br].
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

    private _buildStaticFoods(count: number, size: number, texCoords: number[]): IGLRender[] {
        const safeCount = Math.max(0, count | 0);
        const foods: IGLRender[] = new Array(safeCount);
        const columns = Math.max(1, Math.ceil(Math.sqrt(safeCount)));
        const rows = Math.max(1, Math.ceil(safeCount / columns));
        const width = Math.max(size, cc.winSize.width - this.paddingX * 2);
        const height = Math.max(size, cc.winSize.height - this.paddingY * 2);
        const stepX = columns > 1 ? width / (columns - 1) : 0;
        const stepY = rows > 1 ? height / (rows - 1) : 0;
        const startX = -width * 0.5;
        const startY = height * 0.5;

        for (let i = 0; i < safeCount; i++) {
            const col = i % columns;
            const row = Math.floor(i / columns);
            const x = startX + col * stepX;
            const y = startY - row * stepY;
            const direction = Math.random() * 360;

            foods[i] = new StaticFood(x, y, size, texCoords, direction);
        }

        return foods;
    }

    private _ensureFoodsNode(): FoodsGLNode {
        if (this._foodsNode && cc.isValid(this._foodsNode)) {
            return this._foodsNode;
        }

        const node = new FoodsGLNode('FoodsGLNode');
        node.parent = this.node;
        node.setPosition(0, 0);
        node.setAnchorPoint(0, 0);
        this._foodsNode = node;
        return node;
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
            `[GLRenderTest][Benchmark] mode=${this.rebuildEveryFrame ? 'dynamic' : 'static'} count=${this.foodCount} ` +
            `avgUpdate=${avgMs.toFixed(3)}ms maxUpdate=${this._benchmarkMaxMs.toFixed(3)}ms frames=${this._benchmarkFrames}`
        );

        this._benchmarkFrames = 0;
        this._benchmarkTotalMs = 0;
        this._benchmarkMaxMs = 0;
    }

}
