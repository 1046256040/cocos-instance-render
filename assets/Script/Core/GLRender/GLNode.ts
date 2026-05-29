import { GLRender } from "./GLRender";

export class GLNode extends cc.Node {

    halfWinWidth = cc.winSize.width / 2;
    halfWinHeight = cc.winSize.height / 2;

    vCount = 0;
    vPositions = [];
    vTexCoords = [];

    protected glRender: GLRender = null;

    protected material: cc.Material = null;

    setTexture(texture: cc.Texture2D, effectAsset: cc.EffectAsset) {
        this.vCount = 0;
        this.vPositions = [];
        this.vTexCoords = [];

        this.glRender = this.getComponent(GLRender);
        if (!this.glRender) {
            this.glRender = this.addComponent(GLRender);
            this.material = new cc.Material();
            //@ts-ignore
            this.material.effectAsset = effectAsset;
            this.glRender.setMaterial(0, this.material);
        }
        const material = this.glRender.getMaterial(0);
        //@ts-ignore
        material.setProperty('texture', texture);
        this.glRender.init(texture);
    }

    setBloom(bloom: number) {
        this.material?.setProperty('bloom', bloom);
    }

    setAlpha(alpha: number) {
        this.material?.setProperty('alpha', alpha);
    }

    /** 闪白强度 0~1，对应 gl-sprite / gl-sprite-draw 的 u_rate */
    setFlashRate(rate: number) {
        this.glRender?.setFlashRate(rate);
    }

    setRenderData() {
        this.glRender.setRenderData(this.vCount, this.vPositions, this.vTexCoords);
    }
}