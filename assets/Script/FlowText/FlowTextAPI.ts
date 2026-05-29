import InstanceBatchRenderer, { InstanceRendererTarget, VertexAttributeLike } from '../Core/GpuInstance/InstanceBatchRenderer';
import {
    AnimationType,
    buildCharMetrics,
    buildGlyphLayout,
    createRecommendedPreset,
    createTextState,
    DEFAULT_CHARSET,
    DEFAULT_NUMBER_OFFSETS,
    formatNumber,
    getTotalDuration,
    sampleTextState,
    TextPreset,
    TextState,
    TextType,
} from './FlowTextCore';

const { ccclass, property } = cc._decorator;

type ExtendedMeshRenderer = cc.MeshRenderer & InstanceRendererTarget;

interface ActiveTextEntry {
    state: TextState;
}

//@ts-ignore
const gfx = cc.gfx;

@ccclass
export default class FlowTextAPI extends cc.Component {

    @property({ type: cc.Texture2D, tooltip: '字形图集，字符顺序必须与 glyphCharset 一致。' })
    glyphAtlas: cc.Texture2D | null = null;

    @property({ type: cc.EffectAsset, tooltip: '推荐使用 assets/effects/flow-text-instanced.effect。' })
    glyphEffect: cc.EffectAsset | null = null;

    @property({ type: cc.Material, tooltip: '可直接指定材质；为空时会根据 glyphEffect 运行时创建。' })
    glyphMaterial: cc.Material | null = null;

    @property({ type: cc.Mesh, tooltip: '为空时脚本会自动生成一个单位 quad。' })
    glyphMesh: cc.Mesh | null = null;

    @property({ type: [cc.Float], tooltip: '每个字符的额外横向偏移，顺序必须与 glyphCharset 一致。用于处理不同字符宽度差异。' })
    glyphOffsetList: number[] = DEFAULT_NUMBER_OFFSETS.slice();

    @property({ min: 1 })
    glyphColumns = 8;

    @property({ min: 1 })
    glyphRows = 4;

    @property({ tooltip: '图集是否按从上到下的行顺序排列。' })
    glyphRowsTopToBottom = true;

    @property
    glyphInterval = 22;

    @property
    limit = 256;

    @property
    showDamageUnit = true;

    @property
    showFlyText = true;

    // todo: 不用数组存储
    private _activeTexts: ActiveTextEntry[] = [];
    private _palette: TextPreset[] = [];
    private _charMetrics: Record<string, number> = {};
    private _sharedMesh: cc.Mesh | null = null;
    private _sharedMaterial: cc.Material | null = null;
    private _meshRenderer: ExtendedMeshRenderer | null = null;
    private _batchRenderer: InstanceBatchRenderer | null = null;
    private _instanceData: Float32Array | null = null;

    onLoad(): void {
        this._activeTexts = [];
        this._palette = this._buildPalette();
        this._charMetrics = buildCharMetrics(this._getGlyphOffsetList());
        this._sharedMesh = this.glyphMesh || this._createQuadMesh();
        this._sharedMaterial = this._createSharedMaterial();
        this._meshRenderer = (this.getComponent(cc.MeshRenderer) || this.addComponent(cc.MeshRenderer)) as ExtendedMeshRenderer;
        this._batchRenderer = null;
        this._instanceData = null;

        if (!this._sharedMaterial || !this._sharedMesh) {
            cc.warn('[FlowTextAPI] Missing glyph material/effect; flow text will update logic but cannot render.');
            return;
        }

        this._meshRenderer.mesh = this._sharedMesh;
        this._meshRenderer.enableAutoBatch = false;
        this._meshRenderer.setMaterial(0, this._sharedMaterial);

        if (!(cc.renderer as any).device.caps.supportInstancing) {
            cc.warn('[FlowTextAPI] Current device/runtime does not support hardware instancing in the patched renderer path.');
        }

        const attributes: VertexAttributeLike[] = [
            { name: 'a_instanced_transform', type: gfx.ATTR_TYPE_FLOAT32, num: 4, stream: 1, divisor: 1 },
            { name: 'a_instanced_color', type: gfx.ATTR_TYPE_FLOAT32, num: 4, stream: 1, divisor: 1 },
            { name: 'a_instanced_glyph', type: gfx.ATTR_TYPE_FLOAT32, num: 4, stream: 1, divisor: 1 },
        ];

        this._batchRenderer = new InstanceBatchRenderer({
            renderer: this._meshRenderer,
            gfx: gfx,
            stream: 1,
            attributes,
        });
    }

    showText(position: cc.Vec2 | cc.Vec3, text: string, textType: number = TextType.Normal): void {
        if (!this.showFlyText) {
            return;
        }

        const type = typeof textType === 'number' ? textType : TextType.Normal;
        const preset = this._palette[type] || this._palette[TextType.Normal];
        const randomAngle = preset.animationType === AnimationType.RandomTranslate
            ? Math.max(-preset.flySpreadAngle, Math.min(preset.flySpreadAngle, (Math.random() * 2 - 1) * preset.flySpreadAngle))
            : 0;

        this._activeTexts.push({
            state: createTextState({
                position: { x: position.x, y: position.y },
                text: String(text),
                textType: type,
                preset,
                randomAngle,
            }),
        });

        this._trimOverflow();
    }

    showNumber(position: cc.Vec2 | cc.Vec3, value: number, textType: number = TextType.Normal): void {
        const type = typeof textType === 'number' ? textType : TextType.Normal;
        const preset = this._palette[type] || this._palette[TextType.Normal];
        const text = formatNumber(value, {
            withUnit: this.showDamageUnit,
            withSign: !!preset.withSign,
        });

        this.showText(position, text, type);
    }

    hideText(textType?: number): void {
        if (typeof textType !== 'number') {
            this._activeTexts.length = 0;
            this._uploadInstances(0);
            return;
        }

        for (let i = this._activeTexts.length - 1; i >= 0; i--) {
            if (this._activeTexts[i].state.textType === textType) {
                this._activeTexts.splice(i, 1);
            }
        }
    }

    setLimit(limit: number): void {
        this.limit = Math.max(0, limit | 0);
        this._trimOverflow();
    }

    setDamageTextSettings(showDamageText: boolean, textLimit: number): void {
        this.showFlyText = !!showDamageText;
        this.setLimit(textLimit);
    }

    update(dt: number): void {
        if (!this._batchRenderer) {
            return;
        }

        const glyphCount = this._calculateGlyphCount();
        this._ensureInstanceData(glyphCount);
        let cursor = 0;

        for (let i = this._activeTexts.length - 1; i >= 0; i--) {
            const entry = this._activeTexts[i];
            const state = entry.state;
            state.elapsed += dt;

            if (state.elapsed >= getTotalDuration(state.preset)) {
                this._activeTexts.splice(i, 1);
                continue;
            }

            const sampled = sampleTextState(state, state.elapsed);
            const glyphs = buildGlyphLayout(
                state.text,
                sampled.position,
                sampled.scale,
                this._charMetrics,
                this.glyphInterval
            );

            cursor = this._writeGlyphInstances(cursor, glyphs, sampled.alpha, state.preset.color);
        }

        this._uploadInstances(cursor / 12);
    }

    onDestroy(): void {
        this.hideText();
        if (this._batchRenderer) {
            this._batchRenderer.destroy();
        }
        this._activeTexts = [];
        this._meshRenderer = null;
        this._sharedMesh = null;
        this._sharedMaterial = null;
        this._instanceData = null;
    }

    private _buildPalette(): TextPreset[] {
        const palette: TextPreset[] = [];
        palette[TextType.Normal] = createRecommendedPreset(TextType.Normal);
        palette[TextType.Crit] = createRecommendedPreset(TextType.Crit);
        palette[TextType.Miss] = createRecommendedPreset(TextType.Miss);
        palette[TextType.Immune] = createRecommendedPreset(TextType.Immune);
        palette[TextType.Heal] = createRecommendedPreset(TextType.Heal);
        return palette;
    }

    private _getGlyphOffsetList(): number[] {
        const source = this.glyphOffsetList;
        if (!Array.isArray(source) || source.length === 0) {
            return DEFAULT_NUMBER_OFFSETS;
        }

        const fallback = DEFAULT_NUMBER_OFFSETS;
        const result = new Array<number>(DEFAULT_CHARSET.size);
        for (let i = 0; i < result.length; i++) {
            if (typeof source[i] === 'number' && !isNaN(source[i])) {
                result[i] = source[i];
            }
            else {
                result[i] = fallback[i] || 0;
            }
        }
        return result;
    }

    private _createSharedMaterial(): cc.Material | null {
        let material = this.glyphMaterial;
        if (!material && this.glyphEffect) {
            material = cc.Material.create(this.glyphEffect, 0);
        }

        if (!material) {
            return null;
        }

        material.define('USE_INSTANCING', true);
        if (this.glyphAtlas) {
            material.setProperty('mainTexture', this.glyphAtlas);
        }
        material.setProperty('glyphGrid', new cc.Vec4(
            this.glyphColumns,
            this.glyphRows,
            1 / this.glyphColumns,
            1 / this.glyphRows
        ));
        material.setProperty('glyphUvControl', new cc.Vec4(
            this.glyphRowsTopToBottom ? 1 : 0,
            0,
            0,
            0
        ));
        material.setProperty('alphaThreshold', 0.01);
        return material;
    }

    private _createQuadMesh(): cc.Mesh | null {
        const vfmt = new gfx.VertexFormat([
            { name: gfx.ATTR_POSITION, type: gfx.ATTR_TYPE_FLOAT32, num: 3 },
            { name: gfx.ATTR_UV0, type: gfx.ATTR_TYPE_FLOAT32, num: 2 },
        ]);

        const mesh = new cc.Mesh();
        mesh.init(vfmt, 4, false, true);
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

    private _trimOverflow(): void {
        if (this.limit <= 0) {
            this.hideText();
            return;
        }

        while (this._activeTexts.length > this.limit) {
            this._activeTexts.shift();
        }
    }

    private _calculateGlyphCount(): number {
        let total = 0;
        for (let i = 0; i < this._activeTexts.length; i++) {
            total += this._activeTexts[i].state.text.length;
        }
        return total;
    }

    private _ensureInstanceData(glyphCount: number): void {
        const floatCount = Math.max(1, glyphCount) * 12;
        if (!this._instanceData || this._instanceData.length < floatCount) {
            this._instanceData = new Float32Array(floatCount);
        }
    }

    private _writeGlyphInstances(cursor: number, glyphs: Array<{ char: string; x: number; y: number; scale: number }>, alpha: number, color: { r: number; g: number; b: number; a: number }): number {
        for (let i = 0; i < glyphs.length; i++) {
            const glyphIndex = DEFAULT_CHARSET.get(glyphs[i].char);
            if (glyphIndex < 0) {
                continue;
            }

            const glyph = glyphs[i];
            this._instanceData![cursor++] = glyph.x;
            this._instanceData![cursor++] = glyph.y;
            this._instanceData![cursor++] = glyph.scale * this.glyphInterval;
            this._instanceData![cursor++] = 0;

            this._instanceData![cursor++] = color.r;
            this._instanceData![cursor++] = color.g;
            this._instanceData![cursor++] = color.b;
            this._instanceData![cursor++] = color.a;

            this._instanceData![cursor++] = glyphIndex;
            this._instanceData![cursor++] = alpha;
            this._instanceData![cursor++] = 0;
            this._instanceData![cursor++] = 0;
        }
        return cursor;
    }

    private _uploadInstances(glyphCount: number): void {
        if (!this._batchRenderer) {
            return;
        }

        if (!glyphCount) {
            this._batchRenderer.upload(new Float32Array(0), 0);
            return;
        }

        this._batchRenderer.upload(this._instanceData!, glyphCount);
    }
}
