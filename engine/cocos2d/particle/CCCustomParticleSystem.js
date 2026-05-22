/****************************************************************************
 Copyright (c) 2013-2016 Chukong Technologies Inc.
 Copyright (c) 2017-2018 Xiamen Yaji Software Co., Ltd.

 https://www.cocos.com/

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated engine source code (the "Software"), a limited,
  worldwide, royalty-free, non-assignable, revocable and non-exclusive license
 to use Cocos Creator solely to develop games on your target platforms. You shall
  not use Cocos Creator software for developing other software or tools that's
  used for developing games. You are not granted to publish, distribute,
  sublicense, and/or sell copies of Cocos Creator.

 The software or tools in this License Agreement are licensed, not sold.
 Xiamen Yaji Software Co., Ltd. reserves all rights not expressly granted to you.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/

const RenderComponent = require('../core/components/CCRenderComponent');
const ParticleSimulator = require('./custom/custom-particle-simulator');
const Material = require('../core/assets/material/CCMaterial');
const BlendFunc = require('../core/utils/blend-func');
const SizeOvertimeModule = require('./Animate/p-size-overtime');
const ColorOvertimeModule = require('./Animate/p-color-overtime');
const CustomVStreamModule = require('./Animate/p-custom-vstream');
const RotationOvertimeModule = require('./Animate/p-rotation-overtime');
const TextureAnimationModule = require('./Animate/p-texture-animation');
const LimitVelocityOvertimeModule = require('./Animate/p-limit-velocity-overtime');
const ParticleShapeModule = require('./Animate/p-shape');
const TrailModule = require('./Animate/p-trail');
const CurveRangeModule = require('../core/3d/particle/animator/curve-range');
const CurveRange = CurveRangeModule.default || CurveRangeModule;

function createConstantCurve(value) {
    const range = new CurveRange();
    range.mode = CurveRange.Mode.Constant;
    range.constant = value;
    range.constantMin = value;
    range.constantMax = value;
    return range;
}

function createDefaultStartSizeCurve() {
    return createConstantCurve(50);
}

// 旧版纹理数据格式解析逻辑已不再使用
function getParticleComponents(node) {
    let parent = node.parent, comp = node.getComponent(cc.CustomParticleSystem);
    if (!parent || !comp) {
        return node.getComponentsInChildren(cc.CustomParticleSystem);
    }
    return getParticleComponents(parent);
}


/**
 * !#en Enum for emitter modes
 * !#zh 发射模式
 * @enum CustomParticleSystem.EmitterMode
 */
var EmitterMode = cc.Enum({
    /**
     * !#en Uses gravity, speed, radial and tangential acceleration.
     * !#zh 重力模式，模拟重力，可让粒子围绕一个中心点移近或移远。
     * @property {Number} GRAVITY
     */
    GRAVITY: 0,
    /**
     * !#en Uses radius movement + rotation.
     * !#zh 半径模式，可以使粒子以圆圈方式旋转，它也可以创造螺旋效果让粒子急速前进或后退。
     * @property {Number} RADIUS - Uses radius movement + rotation.
     */
    RADIUS: 1
});

/**
 * !#en Enum for particles movement type.
 * !#zh 粒子位置类型
 * @enum CustomParticleSystem.PositionType
 */
var PositionType = cc.Enum({
    /**
     * !#en
     * Living particles are attached to the world and are unaffected by emitter repositioning.
     * !#zh
     * 自由模式，相对于世界坐标，不会随粒子节点移动而移动。（可产生火焰、蒸汽等效果）
     * @property {Number} FREE
     */
    FREE: 0,

    /**
     * !#en
     * In the relative mode, the particle will move with the parent node, but not with the node where the particle is. 
     * For example, the coffee in the cup is steaming. Then the steam moves (forward) with the train, rather than moves with the cup.
     * !#zh
     * 相对模式，粒子会跟随父节点移动，但不跟随粒子所在节点移动，例如在一列行进火车中，杯中的咖啡飘起雾气，
     * 杯子移动，雾气整体并不会随着杯子移动，但从火车整体的角度来看，雾气整体会随着火车移动。
     * @property {Number} RELATIVE
     */
    RELATIVE: 1,

    /**
     * !#en
     * Living particles are attached to the emitter and are translated along with it.
     * !#zh
     * 整组模式，粒子跟随发射器移动。（不会发生拖尾）
     * @property {Number} GROUPED
     */
    GROUPED: 2
});

/**
 * !#en Enum for render type.
 * !#zh 粒子渲染类型
 * @enum CustomParticleSystem.RenderType
 */
var RenderType = cc.Enum({
    /**
     * !#en Use quad (4-vertices) rendering.
     * !#zh 使用四边形（4 顶点）粒子渲染
     * @property {Number} QUAD
     */
    QUAD: 0,

    /**
     * !#en Use mesh rendering, each particle uses the provided mesh geometry.
     * !#zh 使用 Mesh 渲染，每个粒子实例化指定的网格
     * @property {Number} MESH
     */
    MESH: 1
});

/**
 * @class CustomParticleSystem
 */

var properties = {


    /**
         * !#en Render type of this particle system.
         * !#zh 粒子渲染类型。
         * @property {CustomParticleSystem.RenderType} renderType
         */
    _renderType: {
        default: RenderType.QUAD,
        formerlySerializedAs: 'renderType'
    },

    renderType: {
        type: RenderType,
        get() {
            return this._renderType;
        },
        set(val) {
            this._renderType = val;
        },
        notify: function (val) {
            if (CC_EDITOR && this.preview) {
                this._startPreview();
            }
        },
        tooltip: CC_DEV && '粒子渲染类型（QUAD / MESH）'
    },

    /**
     * !#en SpriteFrame used for particles display
     * !#zh 用于粒子呈现的 SpriteFrame
     * @property spriteFrame
     * @type {SpriteFrame}
     */
    _spriteFrame: {
        default: null,
        type: cc.SpriteFrame
    },
    spriteFrame: {
        get: function () {
            return this._spriteFrame;
        },
        set: function (value, force) {
            var lastSprite = this._renderSpriteFrame;
            if (CC_EDITOR) {
                if (!force && lastSprite === value) {
                    return;
                }
            }
            else {
                if (lastSprite === value) {
                    return;
                }
            }
            this._renderSpriteFrame = value;

            if (!value || value._uuid) {
                this._spriteFrame = value;
            }

            this._applySpriteFrame(lastSprite);
            if (CC_EDITOR) {
                this.node.emit('spriteframe-changed', this);
            }
        },
        type: cc.SpriteFrame,
        tooltip: CC_DEV && 'i18n:COMPONENT.particle_system.spriteFrame'
    },

    /**
     * !#en Mesh used when renderType is MESH.
     * !#zh 当渲染类型为 MESH 时使用的网格资源。
     * @property {cc.Mesh} mesh
     */
    _mesh: {
        default: null,
        type: cc.Mesh
    },

    mesh: {
        type: cc.Mesh,
        get() {
            return this._mesh;
        },
        set(val) {
            this._mesh = val;
        },
        notify: function (val) {
            if (CC_EDITOR && this.preview) {
                this._startPreview();
            }
        },
        visible() {
            return this.renderType === RenderType.MESH;
        },
        tooltip: CC_DEV && 'Mesh 粒子使用的网格资源（仅在渲染类型为 MESH 时生效）'
    },
    /**
     * !#en Play particle in edit mode.
     * !#zh 在编辑器模式下预览粒子，启用后选中粒子时，粒子将自动播放。
     * @property {Boolean} preview
     * @default false
     */
    preview: {
        default: true,
        editorOnly: true,
        notify: CC_EDITOR && function (val) {
            this.resetSystem();
            if (!this.preview) {
                this.stopSystem();
                this.disableRender();
            }
            cc.engine.repaintInEditMode();
        },
        animatable: false,
        tooltip: CC_DEV && 'i18n:COMPONENT.particle_system.preview'
    },


    /**
     * !#en Current quantity of particles that are being simulated.
     * !#zh 当前播放的粒子数量。
     * @property {Number} particleCount
     * @readonly
     */
    particleCount: {
        visible: false,
        get() {
            return this._simulator.particles.length;
        },
        readonly: true
    },

    /**
     * !#en Indicate whether the system simulation have stopped.
     * !#zh 指示粒子播放是否完毕。
     * @property {Boolean} stopped
     */
    _stopped: true,
    stopped: {
        get() {
            return this._stopped;
        },
        animatable: false,
        visible: false
    },

    /**
     * !#en If set to true, the particle system will automatically start playing on onLoad.
     * !#zh 如果设置为 true 运行时会自动发射粒子。
     * @property playOnLoad
     * @type {boolean}
     * @default true
     */
    playOnLoad: {
        default: true,
        tooltip: CC_DEV && '运行时自动播放'
    },

    /**
     * !#en Indicate whether the owner node will be auto-removed when it has no particles left.
     * !#zh 粒子播放完毕后自动销毁所在的节点。
     * @property {Boolean} autoRemoveOnFinish
     */
    autoRemoveOnFinish: {
        default: false,
        animatable: false,
        tooltip: CC_DEV && 'i18n:COMPONENT.particle_system.autoRemoveOnFinish'
    },

    /**
     * !#en Indicate whether the particle system is activated.
     * !#zh 是否激活粒子。
     * @property {Boolean} active
     * @readonly
     */
    active: {
        get: function () {
            return this._simulator.active;
        },
        visible: false
    },

    /**
     * !#en Maximum particles of the system.
     * !#zh 粒子最大数量。
     * @property {Number} totalParticles
     * @default 150
     */
    totalParticles: {
        default: 5,
        tooltip: CC_DEV && '粒子最大数量'
    },
    /**
     * !#en How many seconds the emitter wil run. -1 means 'forever'.
     * !#zh 发射器生存时间，单位秒，-1表示持续发射。
     * @property {Number} duration
     * @default CustomParticleSystem.DURATION_INFINITY
     */
    duration: {
        default: -1,
        tooltip: CC_DEV && '发射器生存时间（秒），-1表示持续发射'
    },
    /**
     * !#en Emission rate of the particles.
     * !#zh 每秒发射的粒子数目。
     * @property {Number} emissionRate
     * @default 10
     */
    emissionRate: {
        default: 10,
        tooltip: CC_DEV && '每秒发射的粒子数目'
    },

    /**
     * !#en Delay time (in seconds) before playing when `playOnLoad` is true.
     * !#zh 粒子系统在运行时自动播放前的延迟时间（秒），仅在 `playOnLoad` 为 true 时生效。
     * @property {Number} delay
     * @default 0
     */
    delay: {
        default: 0,
        tooltip: CC_DEV && '自动播放延迟时间（秒）'
    },

    /**
     * !#en Prewarm particle system, similar to Unity's "Prewarm".
     * !#zh 预热粒子系统（类似 Unity 的 Prewarm）：在首次渲染前先跑一段模拟，使第一帧就处于稳定态。
     * @property {Boolean} prewarm
     * @default false
     */
    prewarm: {
        default: false,
        tooltip: CC_DEV && '预热：在首次渲染前先模拟一段时间，使第一帧即为稳定态（循环/持续发射时更有意义）'
    },

    /**
     * !#en Life of each particle setter.
     * !#zh 粒子的运行时间。
     * @property {Number} life
     * @default 1
     */
    life: {
        default: 1,
        tooltip: CC_DEV && '粒子的运行时间（秒）'
    },
    /**
     * !#en Variation of life.
     * !#zh 粒子的运行时间变化范围。
     * @property {Number} lifeVar
     * @default 0
     */
    lifeVar: {
        default: 0,
        tooltip: CC_DEV && '粒子运行时间的变化范围'
    },

    /**
     * !#en Start color of each particle.
     * !#zh 粒子初始颜色。
     * @property {cc.Color} startColor
     * @default {r: 255, g: 255, b: 255, a: 255}
     */
    _startColor: null,
    startColor: {
        type: cc.Color,
        get() {
            return this._startColor;
        },
        set(val) {
            this._startColor.r = val.r;
            this._startColor.g = val.g;
            this._startColor.b = val.b;
            this._startColor.a = val.a;
        },
        tooltip: CC_DEV && '粒子初始颜色'
    },
    /**
     * !#en Variation of the start color.
     * !#zh 粒子初始颜色变化范围。
     * @property {cc.Color} startColorVar
     * @default {r: 0, g: 0, b: 0, a: 0}
     */
    _startColorVar: null,
    startColorVar: {
        type: cc.Color,
        get() {
            return this._startColorVar;
        },
        set(val) {
            this._startColorVar.r = val.r;
            this._startColorVar.g = val.g;
            this._startColorVar.b = val.b;
            this._startColorVar.a = val.a;
        },
        tooltip: CC_DEV && '粒子初始颜色变化范围（建议使用 ColorOvertimeModule）'
    },
    _angleCurve: {
        default: null,
        type: CurveRange,
        serializable: true,
        visible: false
    },
    /**
     * !#en Angle curve of each particle.
     * !#zh 粒子发射角度曲线。
     * @property {CurveRange} angle
     */
    angle: {
        get() {
            if (!this._angleCurve) {
                this._angleCurve = createConstantCurve(90);
            }
            return this._angleCurve;
        },
        set(val) {
            if (val instanceof CurveRange) {
                this._angleCurve = val;
            } else if (typeof val === 'number') {
                this._angleCurve = createConstantCurve(val);
            } else {
                this._angleCurve = createConstantCurve(90);
            }
        },
        type: CurveRange,
        tooltip: CC_DEV && '粒子发射角度曲线'
    },

    /**
     * !#en Use 2D start size (separate X/Y).
     * !#zh 是否启用二维起始大小（分别控制宽度和高度）。
     * @property {Boolean} use2DStartSize
     */
    use2DStartSize: {
        default: false,
        tooltip: CC_DEV && '启用后使用 startSizeX / startSizeY 分别控制粒子宽高'
    },

    /**
     * !#en Start size curve for each particle (CurveRange).
     * !#zh 粒子初始大小曲线（CurveRange）。
     * @property {CurveRange} startSize
     */
    _startSizeCurve: {
        default: null,
        type: CurveRange,
        serializable: true,
        visible: false,
    },
    startSize: {
        get() {
            if (!this._startSizeCurve) {
                this._startSizeCurve = createDefaultStartSizeCurve();
            }
            return this._startSizeCurve;
        },
        set(val) {
            if (val instanceof CurveRange) {
                this._startSizeCurve = val;
            } else if (typeof val === 'number') {
                this._startSizeCurve = createConstantCurve(Math.max(0, val));
            } else if (!val) {
                this._startSizeCurve = createDefaultStartSizeCurve();
            }
        },
        type: CurveRange,
        tooltip: CC_DEV && '粒子初始大小曲线（根据粒子系统生命周期采样）',
        visible() {
            return !this.use2DStartSize;
        }
    },



    _startSizeXCurve: {
        default: null,
        type: CurveRange,
        serializable: true,
        visible: false,
    },

    /**
     * !#en Start size curve on X axis (width).
     * !#zh 起始宽度曲线（X 轴）。
     * @property {CurveRange} startSizeX
     */
    startSizeX: {
        get() {
            if (!this._startSizeXCurve) {
                this._startSizeXCurve = createDefaultStartSizeCurve();
            }
            return this._startSizeXCurve;
        },
        set(val) {
            if (val instanceof CurveRange) {
                this._startSizeXCurve = val;
            } else if (typeof val === 'number') {
                this._startSizeXCurve = createConstantCurve(Math.max(0, val));
            } else if (!val) {
                this._startSizeXCurve = createDefaultStartSizeCurve();
            }
        },
        type: CurveRange,
        tooltip: CC_DEV && '粒子初始宽度曲线（根据粒子系统生命周期采样）',
        visible() {
            return this.use2DStartSize;
        }
    },

    _startSizeYCurve: {
        default: null,
        type: CurveRange,
        serializable: true,
        visible: false,
    },

    /**
     * !#en Start size curve on Y axis (height).
     * !#zh 起始高度曲线（Y 轴）。
     * @property {CurveRange} startSizeY
     */
    startSizeY: {
        get() {
            if (!this._startSizeYCurve) {
                this._startSizeYCurve = createDefaultStartSizeCurve();
            }
            return this._startSizeYCurve;
        },
        set(val) {
            if (val instanceof CurveRange) {
                this._startSizeYCurve = val;
            } else if (typeof val === 'number') {
                this._startSizeYCurve = createConstantCurve(Math.max(0, val));
            } else if (!val) {
                this._startSizeYCurve = createDefaultStartSizeCurve();
            }
        },
        type: CurveRange,
        tooltip: CC_DEV && '粒子初始高度曲线（根据粒子系统生命周期采样）',
        visible() {
            return this.use2DStartSize;
        }
    },
    _startSpinCurve: {
        default: null,
        type: CurveRange,
        serializable: true,
        visible: false
    },
    /**
     * !#en Start spin curve of each particle.
     * !#zh 粒子开始自旋角度曲线。
     * @property {CurveRange} startSpin
     */
    startSpin: {
        get() {
            if (!this._startSpinCurve) {
                this._startSpinCurve = createConstantCurve(0);
            }
            return this._startSpinCurve;
        },
        set(val) {
            if (val instanceof CurveRange) {
                this._startSpinCurve = val;
            } else if (typeof val === 'number') {
                this._startSpinCurve = createConstantCurve(val);
            } else {
                this._startSpinCurve = createConstantCurve(0);
            }
        },
        type: CurveRange,
        tooltip: CC_DEV && '粒子开始自旋角度曲线',
    },
    /**
     * !#en Source position of the emitter.
     * !#zh 发射器位置。
     * @property {Vec2} sourcePos
     * @default cc.Vec2.ZERO
     */
    sourcePos: {
        default: cc.Vec2.ZERO,
        visible: false,
        tooltip: CC_DEV && '发射器位置（建议使用 ParticleShapeModule）'
    },

    /**
     * !#en Variation of source position.
     * !#zh 发射器位置的变化范围。（横向和纵向）
     * @property {Vec2} posVar
     * @default cc.Vec2.ZERO
     */
    posVar: {
        default: cc.Vec2.ZERO,
        visible: false,
        tooltip: CC_DEV && '发射器位置变化范围（建议使用 ParticleShapeModule）'
    },

    /**
     * !#en Particles movement type.
     * !#zh 粒子位置类型。
     * @property {CustomParticleSystem.PositionType} positionType
     * @default CustomParticleSystem.PositionType.FREE
     */
    _positionType: {
        default: PositionType.FREE,
        formerlySerializedAs: "positionType"
    },

    positionType: {
        type: PositionType,
        get() {
            return this._positionType;
        },
        set(val) {
            this._positionType = val;
            this._updateMaterial();
        },
        tooltip: CC_DEV && '粒子位置类型（FREE/RELATIVE/GROUPED）'
    },

    /**
     * !#en Particles emitter modes.
     * !#zh 发射器类型。
     * @property {CustomParticleSystem.EmitterMode} emitterMode
     * @default CustomParticleSystem.EmitterMode.GRAVITY
     */
    emitterMode: {
        default: EmitterMode.GRAVITY,
        type: EmitterMode,
        notify: CC_EDITOR && function (val) {
            // 通知编辑器刷新属性面板
            cc.engine.repaintInEditMode();
        },
        tooltip: CC_DEV && '发射器模式（GRAVITY/RADIUS）'
    },

    // GRAVITY MODE

    /**
     * !#en Gravity of the emitter.
     * !#zh 重力。
     * @property {Vec2} gravity
     * @default cc.Vec2.ZERO
     */
    gravity: {
        default: cc.Vec2.ZERO,
        visible: function () {
            return this.emitterMode === EmitterMode.GRAVITY;
        },
        tooltip: CC_DEV && '重力'
    },
    _speedCurve: {
        default: null,
        type: CurveRange,
        serializable: true,
        visible: false
    },
    /**
     * !#en Speed curve of the emitter.
     * !#zh 粒子速度曲线。
     * @property {CurveRange} speed
     */
    speed: {
        get() {
            if (!this._speedCurve) {
                this._speedCurve = createConstantCurve(180);
            }
            return this._speedCurve;
        },
        set(val) {
            if (val instanceof CurveRange) {
                this._speedCurve = val;
            } else if (typeof val === 'number') {
                this._speedCurve = createConstantCurve(val);
            } else {
                this._speedCurve = createConstantCurve(180);
            }
        },
        type: CurveRange,
        visible() {
            return this.emitterMode === EmitterMode.GRAVITY;
        },
        tooltip: CC_DEV && '粒子速度曲线'
    },
    _tangentialAccelCurve: {
        default: null,
        type: CurveRange,
        serializable: true,
        visible: false
    },
    /**
     * !#en Tangential acceleration curve (Gravity mode).
     * !#zh 切向加速度曲线（仅重力模式）。
     * @property {CurveRange} tangentialAccel
     */
    tangentialAccel: {
        get() {
            if (!this._tangentialAccelCurve) {
                this._tangentialAccelCurve = createConstantCurve(80);
            }
            return this._tangentialAccelCurve;
        },
        set(val) {
            if (val instanceof CurveRange) {
                this._tangentialAccelCurve = val;
            } else if (typeof val === 'number') {
                this._tangentialAccelCurve = createConstantCurve(val);
            } else {
                this._tangentialAccelCurve = createConstantCurve(80);
            }
        },
        type: CurveRange,
        visible() {
            return this.emitterMode === EmitterMode.GRAVITY;
        },
        tooltip: CC_DEV && '切向加速度曲线（仅重力模式）'
    },
    _radialAccelCurve: {
        default: null,
        type: CurveRange,
        serializable: true,
        visible: false
    },
    /**
     * !#en Radial acceleration curve (Gravity mode).
     * !#zh 径向加速度曲线（仅重力模式）。
     * @property {CurveRange} radialAccel
     */
    radialAccel: {
        get() {
            if (!this._radialAccelCurve) {
                this._radialAccelCurve = createConstantCurve(0);
            }
            return this._radialAccelCurve;
        },
        set(val) {
            if (val instanceof CurveRange) {
                this._radialAccelCurve = val;
            } else if (typeof val === 'number') {
                this._radialAccelCurve = createConstantCurve(val);
            } else {
                this._radialAccelCurve = createConstantCurve(0);
            }
        },
        type: CurveRange,
        visible() {
            return this.emitterMode === EmitterMode.GRAVITY;
        },
        tooltip: CC_DEV && '径向加速度曲线（仅重力模式）'
    },

    /**
     * !#en Indicate whether the rotation of each particle equals to its direction. Only available in 'Gravity' mode.
     * !#zh 每个粒子的旋转是否等于其方向，只有在重力模式下可用。
     * @property {Boolean} rotationIsDir
     * @default false
     */
    rotationIsDir: {
        default: false,
        visible: function () {
            return this.emitterMode === EmitterMode.GRAVITY;
        },
        tooltip: CC_DEV && '粒子旋转是否跟随运动方向'
    },

    // RADIUS MODE

    /**
     * !#en Starting radius of the particles. Only available in 'Radius' mode.
     * !#zh 初始半径，表示粒子出生时相对发射器的距离，只有在半径模式下可用。
     * @property {Number} startRadius
     * @default 0
     */
    startRadius: {
        default: 0,
        visible: function () {
            return this.emitterMode === EmitterMode.RADIUS;
        },
        tooltip: CC_DEV && '粒子初始半径'
    },
    /**
     * !#en Variation of the starting radius.
     * !#zh 初始半径变化范围。
     * @property {Number} startRadiusVar
     * @default 0
     */
    startRadiusVar: {
        default: 0,
        visible: function () {
            return this.emitterMode === EmitterMode.RADIUS;
        },
        tooltip: CC_DEV && '初始半径变化范围'
    },
    /**
     * !#en Ending radius of the particles. Only available in 'Radius' mode.
     * !#zh 结束半径，只有在半径模式下可用。
     * @property {Number} endRadius
     * @default 0
     */
    endRadius: {
        default: 0,
        visible: function () {
            return this.emitterMode === EmitterMode.RADIUS;
        },
        tooltip: CC_DEV && '粒子结束半径'
    },
    /**
     * !#en Variation of the ending radius.
     * !#zh 结束半径变化范围。
     * @property {Number} endRadiusVar
     * @default 0
     */
    endRadiusVar: {
        default: 0,
        visible: function () {
            return this.emitterMode === EmitterMode.RADIUS;
        },
        tooltip: CC_DEV && '结束半径变化范围'
    },
    /**
     * !#en Number of degress to rotate a particle around the source pos per second. Only available in 'Radius' mode.
     * !#zh 粒子每秒围绕起始点的旋转角度，只有在半径模式下可用。
     * @property {Number} rotatePerS
     * @default 0
     */
    rotatePerS: {
        default: 0,
        visible: function () {
            return this.emitterMode === EmitterMode.RADIUS;
        },
        tooltip: CC_DEV && '粒子每秒旋转角度'
    },
    /**
     * !#en Variation of the degress to rotate a particle around the source pos per second.
     * !#zh 粒子每秒围绕起始点的旋转角度变化范围。
     * @property {Number} rotatePerSVar
     * @default 0
     */
    rotatePerSVar: {
        default: 0,
        visible: function () {
            return this.emitterMode === EmitterMode.RADIUS;
        },
        tooltip: CC_DEV && '每秒旋转角度变化范围'
    },

    _shapeModule: {
        default: null,
        type: ParticleShapeModule,
        serializable: true,
        visible: false
    },

    shapeModule: {
        get: function () {
            if (!this._shapeModule) {
                this._shapeModule = new ParticleShapeModule();
            }
            return this._shapeModule;
        },
        set: function (value) {
            this._shapeModule = value;
        },
        type: ParticleShapeModule,
        tooltip: CC_DEV && '粒子形状发射模块'
    },

    /**
     * !#en Size overtime module
     * !#zh 粒子大小随时间变化模块
     * @property {SizeOvertimeModule} sizeOvertimeModule
     */
    _sizeOvertimeModule: {
        default: null,
        type: SizeOvertimeModule,
        serializable: true,
        visible: false
    },

    sizeOvertimeModule: {
        get: function () {
            if (!this._sizeOvertimeModule) {
                this._sizeOvertimeModule = new SizeOvertimeModule();
                this._sizeOvertimeModule.enable = true;
            }
            return this._sizeOvertimeModule;
        },
        set: function (value) {
            this._sizeOvertimeModule = value;
        },
        type: SizeOvertimeModule,
        tooltip: CC_DEV && '粒子大小随时间变化模块'
    },

    /**
     * !#en Size overtime module
     * !#zh 粒子大小随时间变化模块
     * @property {SizeOvertimeModule} sizeOvertimeModule
     */
    _colorOvertimeModule: {
        default: null,
        type: ColorOvertimeModule,
        serializable: true,
        visible: false
    },

    colorOvertimeModule: {
        get: function () {
            if (!this._colorOvertimeModule) {
                this._colorOvertimeModule = new ColorOvertimeModule();
            }
            return this._colorOvertimeModule;
        },
        set: function (value) {
            this._colorOvertimeModule = value;
        },
        type: ColorOvertimeModule,
        tooltip: CC_DEV && '粒子颜色随时间变化模块'
    },

    _rotationOvertimeModule: {
        default: null,
        type: RotationOvertimeModule,
        serializable: true,
        visible: false
    },

    rotationOvertimeModule: {
        get: function () {
            if (!this._rotationOvertimeModule) {
                this._rotationOvertimeModule = new RotationOvertimeModule();
            }
            return this._rotationOvertimeModule;
        },
        set: function (value) {
            this._rotationOvertimeModule = value;
        },
        type: RotationOvertimeModule,
        tooltip: CC_DEV && '粒子旋转随时间变化模块'
    },

    _textureAnimationModule: {
        default: null,
        type: TextureAnimationModule,
        serializable: true,
        visible: false
    },

    textureAnimationModule: {
        get: function () {
            if (!this._textureAnimationModule) {
                this._textureAnimationModule = new TextureAnimationModule();
            }
            return this._textureAnimationModule;
        },
        set: function (value) {
            this._textureAnimationModule = value;
        },
        type: TextureAnimationModule,
        tooltip: CC_DEV && '粒子纹理帧动画模块'
    },

    _limitVelocityOvertimeModule: {
        default: null,
        type: LimitVelocityOvertimeModule,
        serializable: true,
        visible: false
    },

    limitVelocityOvertimeModule: {
        get: function () {
            if (!this._limitVelocityOvertimeModule) {
                this._limitVelocityOvertimeModule = new LimitVelocityOvertimeModule();
            }
            return this._limitVelocityOvertimeModule;
        },
        set: function (value) {
            this._limitVelocityOvertimeModule = value;
        },
        type: LimitVelocityOvertimeModule,
        tooltip: CC_DEV && '粒子限速模块'
    },

    _customVStreamModule: {
        default: null,
        type: CustomVStreamModule,
        serializable: true,
        visible: false
    },

    customVStreamModule: {
        get: function () {
            if (!this._customVStreamModule) {
                this._customVStreamModule = new CustomVStreamModule();
            }
            return this._customVStreamModule;
        },
        set: function (value) {
            this._customVStreamModule = value;
        },
        type: CustomVStreamModule,
        tooltip: CC_DEV && '粒子顶点流随时间变化模块'
    },

    _trailModule: {
        default: null,
        type: TrailModule,
        serializable: true,
        visible: false
    },

    trailModule: {
        get: function () {
            if (!this._trailModule) {
                this._trailModule = new TrailModule();
            }
            return this._trailModule;
        },
        set: function (value) {
            this._trailModule = value;
        },
        type: TrailModule,
        tooltip: CC_DEV && '粒子拖尾模块'
    },





};

/**
 * Particle System base class. <br/>
 * Attributes of a Particle System:<br/>
 *  - emmision rate of the particles<br/>
 *  - Gravity Mode (Mode A): <br/>
 *  - gravity <br/>
 *  - direction <br/>
 *  - speed +-  variance <br/>
 *  - tangential acceleration +- variance<br/>
 *  - radial acceleration +- variance<br/>
 *  - Radius Mode (Mode B):      <br/>
 *  - startRadius +- variance    <br/>
 *  - endRadius +- variance      <br/>
 *  - rotate +- variance         <br/>
 *  - Properties common to all modes: <br/>
 *  - life +- life variance      <br/>
 *  - start spin +- variance     <br/>
 *  - end spin +- variance       <br/>
 *  - start size +- variance     <br/>
 *  - end size +- variance       <br/>
 *  - start color +- variance    <br/>
 *  - end color +- variance      <br/>
 *  - life +- variance           <br/>
 *  - blending function          <br/>
 *  - texture                    <br/>
 * <br/>
 * cocos2d also supports particles generated by Particle Designer (http://particledesigner.71squared.com/).<br/>
 * 'Radius Mode' in Particle Designer uses a fixed emit rate of 30 hz. Since that can't be guarateed in cocos2d,  <br/>
 * cocos2d uses a another approach, but the results are almost identical.<br/>
 * cocos2d supports all the variables used by Particle Designer plus a bit more:  <br/>
 *  - spinning particles (supported when using CustomParticleSystem)       <br/>
 *  - tangential acceleration (Gravity mode)                               <br/>
 *  - radial acceleration (Gravity mode)                                   <br/>
 *  - radius direction (Radius mode) (Particle Designer supports outwards to inwards direction only) <br/>
 * It is possible to customize any of the above mentioned properties in runtime. Example:   <br/>
 *
 * @example
 * emitter.radialAccel = 15;
 * emitter.startSpin = 0;
 *
 * @class CustomParticleSystem
 * @extends RenderComponent
 * @uses BlendFunc
 */
var CustomParticleSystem = cc.Class({
    name: 'cc.CustomParticleSystem',
    extends: RenderComponent,
    mixins: [BlendFunc],
    editor: CC_EDITOR && {
        menu: 'i18n:MAIN_MENU.component.renderers/CustomParticleSystem',
        help: 'i18n:COMPONENT.help_url.custom-particle-system',
        playOnFocus: true,
        executeInEditMode: true
    },

    ctor() {
        this.initProperties();
    },

    initProperties() {
        this._previewTimer = null;
        this._playOnLoadTimer = null;
        this._firstlyEnabled = true;
        this._focused = false;
        this._aspectRatio = 1;

        this._simulator = new ParticleSimulator(this);

        // colors
        this._startColor = cc.color(255, 255, 255, 255);
        this._startColorVar = cc.color(0, 0, 0, 0);
        this._startSizeCurve = createDefaultStartSizeCurve();
        this._angleCurve = createConstantCurve(90);
        this._startSpinCurve = createConstantCurve(0);
        this._speedCurve = createConstantCurve(180);
        this._tangentialAccelCurve = createConstantCurve(80);
        this._radialAccelCurve = createConstantCurve(0);

        // The temporary SpriteFrame object used for the renderer. Because there is no corresponding asset, it can't be serialized.
        //this._renderSpriteFrame = null;

        // Trail 渲染标志
        this._trailNeedsRender = false;
        this._trailAssembler = null;

        // 记录材质变更，以便在面板修改后自动同步必要定义与属性
        this._lastMaterialRef = null;
        this._lastMaterialHash = 0;
    },

    properties: properties,

    statics: {

        /**
         * !#en The Particle emitter lives forever.
         * !#zh 表示发射器永久存在
         * @property {Number} DURATION_INFINITY
         * @default -1
         * @static
         * @readonly
         */
        DURATION_INFINITY: -1,

        /**
         * !#en The starting size of the particle is equal to the ending size.
         * !#zh 表示粒子的起始大小等于结束大小。
         * @property {Number} START_SIZE_EQUAL_TO_END_SIZE
         * @default -1
         * @static
         * @readonly
         */
        START_SIZE_EQUAL_TO_END_SIZE: -1,

        /**
         * !#en The starting radius of the particle is equal to the ending radius.
         * !#zh 表示粒子的起始半径等于结束半径。
         * @property {Number} START_RADIUS_EQUAL_TO_END_RADIUS
         * @default -1
         * @static
         * @readonly
         */
        START_RADIUS_EQUAL_TO_END_RADIUS: -1,

        EmitterMode: EmitterMode,
        PositionType: PositionType,
        RenderType: RenderType,
    },

    // EDITOR RELATED METHODS

    onFocusInEditor: CC_EDITOR && function () {
        this._focused = true;
        let components = getParticleComponents(this.node);
        for (let i = 0; i < components.length; ++i) {
            components[i]._startPreview();
        }
    },

    onLostFocusInEditor: CC_EDITOR && function () {
        this._focused = false;
        let components = getParticleComponents(this.node);
        for (let i = 0; i < components.length; ++i) {
            components[i]._stopPreview();
        }
    },

    onRestore: CC_EDITOR && function () {
        // Because undo/redo will not call onEnable/onDisable,
        // we need call onEnable/onDisable manually to active/disactive children nodes.
        if (this.enabledInHierarchy) {
            this.node._renderComponent = null;
            this.onEnable();
        }
        else {
            this.onDisable();
        }
    },

    _startPreview: CC_EDITOR && function () {
        if (!this.preview) {
            return;
        }

        // 如果已经有预览延迟回调，先取消
        if (this._previewTimer) {
            this.unschedule(this._previewTimer);
            this._previewTimer = null;
        }

        // delay 小于等于 0 时，与原逻辑一致：立刻播放
        if (!this.delay || this.delay <= 0) {
            this.resetSystem();
            cc.engine.repaintInEditMode();
            return;
        }

        // 预览模式下也支持 delay：延迟一段时间后再播放
        const self = this;
        this._previewTimer = function () {
            // 组件或节点已失效 / 已失去焦点 / 预览被关闭时不再播放
            if (!self.isValid || !self.node || !self.node.isValid) {
                return;
            }
            if (!self.preview || !self._focused) {
                return;
            }
            self.resetSystem();
            cc.engine.repaintInEditMode();
        };

        this.scheduleOnce(this._previewTimer, this.delay);
    },

    _stopPreview: CC_EDITOR && function () {
        if (this.preview) {
            this.resetSystem();
            this.stopSystem();
            this.disableRender();
            cc.engine.repaintInEditMode();
        }
        if (this._previewTimer) {
            this.unschedule(this._previewTimer);
            this._previewTimer = null;
        }
    },

    /**
     * 根据 `playOnLoad` 和 `delay` 控制首次播放时间
     * @private
     */
    _playOnLoadWithDelay() {
        if (!this.playOnLoad) {
            return;
        }
        if (this._playOnLoadTimer) {
            this.unschedule(this._playOnLoadTimer);
            this._playOnLoadTimer = null;
        }
        // 延迟小于等于 0 时，保持原有立即播放行为
        if (!this.delay || this.delay <= 0) {
            this.resetSystem();
            return;
        }

        // 使用组件的调度系统实现一次性延迟播放
        this._playOnLoadTimer = function () {
            this._playOnLoadTimer = null;
            // 组件或节点已失效时不再播放
            if (!this.isValid || !this.node || !this.node.isValid) {
                return;
            }
            this.resetSystem();
        };
        this.scheduleOnce(this._playOnLoadTimer, this.delay);
    },

    onEnable() {
        this._super();
        if (!CC_EDITOR || cc.engine.isPlaying) {
            if (this._firstlyEnabled) {
                this._firstlyEnabled = false;
            } else {
                this._playOnLoadWithDelay();
            }
        }
    },

    onDisable() {
        if (this._playOnLoadTimer) {
            this.unschedule(this._playOnLoadTimer);
            this._playOnLoadTimer = null;
        }
        this._super();
    },

    __preload() {
        this._super();

        if (this.spriteFrame && !this._renderSpriteFrame) {
            this._applySpriteFrame(this.spriteFrame);
        }
        // auto play
        if (!CC_EDITOR || cc.engine.isPlaying) {
            this._playOnLoadWithDelay();
        }

        if (CC_EDITOR && this._focused) {
            this._startPreview();
        }
        // Upgrade color type from v2.0.0
        if (CC_EDITOR && !(this._startColor instanceof cc.Color)) {
            this._startColor = cc.color(this._startColor);
            this._startColorVar = cc.color(this._startColorVar);
        }
    },

    onDestroy() {
        if (this.autoRemoveOnFinish) {
            this.autoRemoveOnFinish = false;    // already removed
        }
        if (this._buffer) {
            this._buffer.destroy();
            this._buffer = null;
        }
        // reset uv data so next time simulator will refill buffer uv info when exit edit mode from prefab.
        this._simulator._uvFilled = 0;
        this._super();
    },

    lateUpdate(dt) {
        // 面板修改材质/宏后，材质会重建变体，需重新同步必要定义与贴图（仅编辑器）
        if (CC_EDITOR) {
            this._syncMaterialIfDirty();
        }
        if (!this._simulator.finished) {
            this._simulator.step(dt);
        }

        // 渲染 Trail（如果启用）
        this._updateTrailRender();
    },

    _syncMaterialIfDirty() {
        const mat = this.materials[0];
        if (!mat) return;
        if (mat.effect._dirty) {
            this._updateMaterial();
        }
    },

    /**
     * 更新 Trail 渲染数据
     * @private
     */
    _updateTrailRender() {
        if (!this._trailModule || !this._trailModule.enable) {
            if (this._trailAssembler && this._trailAssembler._ia) {
                this._trailAssembler._ia._count = 0;
            }
            this._trailNeedsRender = false;
            return;
        }

        // 获取或创建 Trail Assembler
        let assembler = this._trailModule.getAssembler();
        if (!assembler) {
            return;
        }

        // 填充 Trail 数据到 Buffer
        assembler.fillTrailBuffers(this._trailModule);

        // 将 Trail Assembler 标记为需要渲染
        if (assembler._ia && assembler._ia._count > 0) {
            this._trailNeedsRender = true;
            this._trailAssembler = assembler;
        } else {
            this._trailNeedsRender = false;
        }
    },

    // APIS

    /*
     * !#en Add a particle to the emitter.
     * !#zh 添加一个粒子到发射器中。
     * @method addParticle
     * @return {Boolean}
     */
    addParticle: function () {
        // Not implemented
    },

    /**
     * !#en Stop emitting particles. Running particles will continue to run until they die.
     * !#zh 停止发射器发射粒子，发射出去的粒子将继续运行，直至粒子生命结束。
     * @method stopSystem
     * @example
     * // stop particle system.
     * myParticleSystem.stopSystem();
     */
    stopSystem: function () {
        this._stopped = true;
        this._simulator.stop();
        // 清理 Trail 渲染标志
        this._trailNeedsRender = false;
    },

    /**
     * !#en Kill all living particles.
     * !#zh 杀死所有存在的粒子，然后重新启动粒子发射器。
     * @method resetSystem
     * @example
     * // play particle system.
     * myParticleSystem.resetSystem();
     */
    resetSystem: function () {
        this._stopped = false;
        // 每次重置系统时，一并清理拖尾，避免残留几何影响下一轮播放
        if (this._trailModule) {
            this._trailModule.clear();
        }
        this._trailNeedsRender = false;
        this._trailAssembler = null;
        this._simulator.reset();
        this._prewarmIfNeeded();
        this.markForRender(true);
    },

    /**
     * 预热逻辑：在首次渲染前用固定步长推进模拟，但不写 VB/不上传/不渲染。
     * 结束后再执行一次 dt=0 的渲染填充，确保第一帧就处于稳定态。
     * 语义对齐 Unity：本质上是 “Simulate(prewarmTime, fixedTimeStep=true) 然后开始渲染”。
     */
    _prewarmIfNeeded() {
        if (!this.prewarm) return;
        if (!this._simulator || !this._simulator.step) return;

        // 计算自动预热时长：duration 为 -1（持续发射）时，用 maxLife；否则用 max(duration, maxLife)
        const maxLife = Math.max(0, (this.life || 0) + (this.lifeVar || 0));
        let warmTime = 0;
        if (this.duration === -1) warmTime = maxLife;
        else warmTime = Math.max(this.duration || 0, maxLife);
        if (!(warmTime > 0)) return;

        // 固定步长（自动策略）：默认 1/60，并限制在合理范围
        let h = 1 / 60;
        h = Math.max(1 / 240, Math.min(1 / 15, h));

        // 保护：避免极端配置卡死（最多 30 秒）
        warmTime = Math.min(warmTime, 30);

        // 预热时不应该触发 stopSystem（duration 到期），所以 suppressStop=true
        let t = 0;
        while (t + h <= warmTime + 1e-6) {
            this._simulator.step(h, { noRender: true, suppressStop: true });
            t += h;
        }
        const tail = warmTime - t;
        if (tail > 1e-6) {
            this._simulator.step(tail, { noRender: true, suppressStop: true });
        }

        // 预热结束后，补一次 dt=0 的“渲染填充”（写 VB/UV），确保第一帧就能正确显示
        this._simulator._uvFilled = 0;
        this._simulator.step(0, { suppressStop: true });
        // Trail 也同步填充一次
        this._updateTrailRender();
    },

    /**
     * !#en Whether or not the system is full.
     * !#zh 发射器中粒子是否大于等于设置的总粒子数量。
     * @method isFull
     * @return {Boolean}
     */
    isFull: function () {
        return (this.particleCount >= this.totalParticles);
    },

    /**
     * !#en Sets a new texture with a rect. The rect is in texture position and size.
     * Please use spriteFrame property instead, this function is deprecated since v1.9
     * !#zh 设置一张新贴图和关联的矩形。
     * 请直接设置 spriteFrame 属性，这个函数从 v1.9 版本开始已经被废弃
     * @method setTextureWithRect
     * @param {Texture2D} texture
     * @param {Rect} rect
     * @deprecated since v1.9
     */
    setTextureWithRect: function (texture, rect) {
        if (texture instanceof cc.Texture2D) {
            this.spriteFrame = new cc.SpriteFrame(texture, rect);
        }
    },

    _validateRender() {
        let texture = this._getTexture();
        if (!texture || !texture.loaded) {
            this.disableRender();
            return;
        }
        this._super();
    },

    _onTextureLoaded() {
        this._simulator.updateUVs(true);
        this._syncAspect();
        this._updateMaterial();
        this.markForRender(true);
    },

    _syncAspect() {
        let frameRect = this._renderSpriteFrame._rect;
        this._aspectRatio = frameRect.width / frameRect.height;
    },

    _applySpriteFrame() {
        this._renderSpriteFrame = this._renderSpriteFrame || this._spriteFrame;
        if (this._renderSpriteFrame) {
            if (this._renderSpriteFrame.textureLoaded()) {
                this._onTextureLoaded();
            }
            else {
                this._renderSpriteFrame.onTextureLoaded(this._onTextureLoaded, this);
            }
        }
        else {
            this._updateMaterial();
            this.resetSystem();
            if (CC_EDITOR) {
                cc.engine.repaintInEditMode();
            }
        }
    },

    _getTexture() {
        // 新版自定义粒子系统仅依赖 spriteFrame，不再从 legacy texture 回退
        return this._renderSpriteFrame && this._renderSpriteFrame.getTexture();
    },

    _updateMaterial() {
        let material = this.materials[0];
        if (!material) return;

        material.define('CC_USE_MODEL', this._positionType !== PositionType.FREE);
        material.setProperty('texture', this._getTexture());

        BlendFunc.prototype._updateMaterial.call(this);
    },

    _finishedSimulation: function () {
        if (CC_EDITOR) {
            if (this.preview && this._focused && !this.active && !cc.engine.isPlaying) {
                this.resetSystem();
            }
            return;
        }
        this.resetSystem();
        this.stopSystem();
        this.disableRender();
        if (this.autoRemoveOnFinish && this._stopped) {
            this.node.destroy();
        }
    }
});

cc.CustomParticleSystem = module.exports = CustomParticleSystem;

