import { RibbonAssembler } from "./RibbonAssembler";

/**
 * 丝带渲染组件（2D RenderComponent）。配合 RibbonAssembler 把连续三角带写入 2D 渲染 buffer。
 */
export class RibbonRender extends cc.RenderComponent {
    texture: cc.Texture2D | null = null;

    constructor() {
        super();
        //@ts-ignore
        this._assembler = new RibbonAssembler();
    }

    init(texture: cc.Texture2D | null) {
        this.texture = texture;
        this._activateMaterial();
    }

    onEnable() {
        super.onEnable();
        this._activateMaterial();
    }

    //override
    _resetAssembler() {
        //@ts-ignore
        this.setVertsDirty(true);
        //@ts-ignore
        this._assembler = new RibbonAssembler();
    }

    //override
    _activateMaterial() {
        const material = this.getMaterial(0);
        if (!material) {
            //@ts-ignore
            this.disableRender();
            return;
        }
        if (this.texture) {
            material.setProperty('texture', this.texture);
        }
        this.setMaterial(0, material);
        //@ts-ignore
        this.markForRender(true);
    }

    setRenderData(vertCount: number, positions: Float32Array, uvs: Float32Array) {
        //@ts-ignore
        this._assembler.setRenderData(vertCount, positions, uvs);
        //@ts-ignore
        this.setVertsDirty(true);
    }
}
