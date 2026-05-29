import { GLAssembler } from "./GLAssembler";

export class GLRender extends cc.RenderComponent {

    vCount = 0
    vPositions = []
    vTexCoords = []
    vAlpha = []
    texture = null;

    constructor() {
        super();
        //@ts-ignore
        this._assembler = new GLAssembler();
    }

    init(texture) {
        this.texture = texture;
    }

    onEnable() {
        super.onEnable()
        this._activateMaterial()
    }

    //override
    _resetAssembler() {
        //@ts-ignore
        this.setVertsDirty(true)
        //@ts-ignore
        this._assembler = new GLAssembler()
    }

    //override
    _activateMaterial() {
        let material = this.getMaterial(0)
        if (!material) {
            //@ts-ignore
            this.disableRender()
            return
        }

        material.setProperty('texture', this.texture);
        this.setMaterial(0, material)
        //@ts-ignore
        this.markForRender(true)
    }

    //蛇的闪白效果
    setFlashRate(rate: number) {
        const m = this.getMaterial(0);
        if (m) m.setProperty('u_rate', rate);
    }

    setRenderData(vCount: number, vPositions: number[], vTexCoords: number[]) {
        //@ts-ignore
        this._assembler.setRenderData(vCount, vPositions, vTexCoords);
    }
}