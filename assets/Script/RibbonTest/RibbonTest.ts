import RibbonInstance from "../Core/Ribbon/RibbonInstance";

const { ccclass, property } = cc._decorator;

/**
 * 贪吃蛇：蛇头按当前方向匀速前进，WASD 改变方向，蛇身是蛇头走过的固定长度轨迹，
 * 用 RibbonInstance（连续三角带丝带）渲染。
 */
@ccclass
export default class RibbonTest extends cc.Component {
    @property({ type: cc.EffectAsset, tooltip: '推荐使用 ribbon.effect。' })
    effectAsset: cc.EffectAsset | null = null;

    @property({ type: cc.Material, tooltip: '可直接指定材质；为空时据 effect 创建。' })
    material: cc.Material | null = null;

    @property({ type: cc.Texture2D, tooltip: '蛇身纹理（运行时会被设为 wrap=repeat）。' })
    texture: cc.Texture2D | null = null;

    @property({ min: 1, tooltip: '蛇身宽度。' })
    width = 40;

    @property({ tooltip: '纹理平铺长度（世界单位）；<=0 时取纹理宽度。' })
    tileLength = 0;

    @property({ min: 1, tooltip: '每段细分数：>1 转弯更平滑。' })
    subdivisions = 12;

    @property({ min: 1, tooltip: '蛇头移动速度（像素/秒）。' })
    speed = 240;

    @property({ min: 1, tooltip: '转弯半径（世界单位），应 ≥ width/2 以免拐角折叠。' })
    turnRadius = 60;

    @property({ min: 1, tooltip: '蛇身长度（世界单位）。' })
    bodyLength = 400;

    @property({ min: 1, tooltip: '轨迹采样间距（越小越平滑、点越多）。' })
    sampleDist = 16;

    private _ribbon: RibbonInstance | null = null;
    private _path: cc.Vec2[] = [];
    private _dir: cc.Vec2 = cc.v2(1, 0);
    private _nextDir: cc.Vec2 = cc.v2(1, 0);

    onLoad(): void {
        const node = new cc.Node('ribbon');
        node.parent = this.node;

        this._ribbon = new RibbonInstance({
            node,
            effect: this.effectAsset,
            material: this.material,
            texture: this.texture,
            width: this.width,
            tileLength: this.tileLength,
            subdivisions: this.subdivisions,
        });

        // 初始：蛇头在原点，向右，给一小段初始身体。
        this._dir.x = 1; this._dir.y = 0;
        this._nextDir.x = 1; this._nextDir.y = 0;
        this._path = [
            cc.v2(-this.sampleDist, 0),
            cc.v2(0, 0),
        ];

        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this._onKeyDown, this);
    }

    update(dt: number): void {
        if (!this._ribbon || this._path.length < 2) {
            return;
        }

        // 按固定转弯半径平滑转向：限制角速度 = speed / turnRadius，轨迹即圆弧。
        this._steer(dt);

        // 移动蛇头（路径末点）。
        const head = this._path[this._path.length - 1];
        head.x += this._dir.x * this.speed * dt;
        head.y += this._dir.y * this.speed * dt;

        // 与上一采样点拉开 sampleDist 后，固定为新的身体节点，蛇头从此继续延伸。
        const prev = this._path[this._path.length - 2];
        if (this._dist(head, prev) >= this.sampleDist) {
            this._path.push(cc.v2(head.x, head.y));
        }

        this._trimTail();
        this._ribbon.setPath(this._path);
    }

    onDestroy(): void {
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this._onKeyDown, this);
        if (this._ribbon) {
            this._ribbon.destroy();
            this._ribbon = null;
        }
    }

    private _onKeyDown(event: any): void {
        switch (event.keyCode) {
            case cc.macro.KEY.w: this._nextDir.x = 0; this._nextDir.y = 1; break;
            case cc.macro.KEY.s: this._nextDir.x = 0; this._nextDir.y = -1; break;
            case cc.macro.KEY.a: this._nextDir.x = -1; this._nextDir.y = 0; break;
            case cc.macro.KEY.d: this._nextDir.x = 1; this._nextDir.y = 0; break;
            default: return;
        }
        // 平滑转向（_steer）会按 turnRadius 处理任意方向变化，含反向时的 U 形回转。
    }

    /** 朝目标方向平滑转向，角速度受 turnRadius 限制 → 轨迹为圆弧。 */
    private _steer(dt: number): void {
        const cur = Math.atan2(this._dir.y, this._dir.x);
        const tgt = Math.atan2(this._nextDir.y, this._nextDir.x);
        let diff = tgt - cur;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) < 1e-4) {
            return;
        }
        const maxStep = (this.speed / this.turnRadius) * dt; // 角速度 = v / R
        const step = Math.max(-maxStep, Math.min(maxStep, diff));
        const ang = cur + step;
        this._dir.x = Math.cos(ang);
        this._dir.y = Math.sin(ang);
    }

    /** 从蛇头向尾累计长度，超过 bodyLength 的尾部点裁掉。 */
    private _trimTail(): void {
        const pts = this._path;
        let acc = 0;
        let keepFrom = 0;
        for (let i = pts.length - 1; i > 0; i--) {
            acc += this._dist(pts[i], pts[i - 1]);
            if (acc > this.bodyLength) {
                keepFrom = i - 1;
                break;
            }
        }
        if (keepFrom > 0) {
            pts.splice(0, keepFrom);
        }
    }

    private _dist(a: cc.Vec2, b: cc.Vec2): number {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
}
