/**
 * Particle Trail Renderer Component
 * 粒子拖尾渲染组件
 * 
 * 这个组件会自动关联到父节点的 ParticleSystem 组件
 * 并渲染其 TrailModule 的数据
 */

const RenderComponent = require('../core/components/CCRenderComponent');
const TrailAssembler = require('./trail-assembler');

const CCParticleTrail = cc.Class({
    name: 'cc.ParticleTrail',
    extends: RenderComponent,

    editor: CC_EDITOR && {
        menu: 'i18n:MAIN_MENU.component.renderers/ParticleTrail',
        help: 'i18n:COMPONENT.help_url.particleTrail',
    },

    ctor() {
        this._particleSystem = null;
    },

    properties: {
        /**
         * !#en The particle system to render trails for
         * !#zh 要渲染拖尾的粒子系统
         * @property particleSystem
         * @type {ParticleSystem}
         */
        _particleSystem: {
            default: null,
            type: cc.ParticleSystem,
            serializable: true
        },
    },

    onLoad() {
        // 自动查找父节点的 ParticleSystem
        if (!this._particleSystem) {
            this._particleSystem = this.node.getComponent(cc.ParticleSystem);
        }

        // 初始化 Assembler
        if (!this._assembler) {
            this._assembler = new TrailAssembler(this);
        }
    },

    onEnable() {
        this._super();
        this.node._renderFlag |= cc.RenderFlow.FLAG_POST_RENDER;
    },

    onDisable() {
        this._super();
    },

    /**
     * 填充渲染数据
     */
    _updateMeshData() {
        if (!this._particleSystem || !this._particleSystem._trailModule) {
            return;
        }

        let trailModule = this._particleSystem._trailModule;
        if (!trailModule.enable) {
            return;
        }

        // 填充 Trail 数据
        this._assembler.fillTrailBuffers(trailModule);
    },

    /**
     * Post render - 在粒子渲染后渲染拖尾
     */
    _postRender(renderer) {
        if (!this._particleSystem || !this._particleSystem._trailModule) {
            return;
        }

        let trailModule = this._particleSystem._trailModule;
        if (!trailModule.enable) {
            return;
        }

        // 更新数据
        this._updateMeshData();

        // 提交渲染
        if (this._assembler && this._assembler._ia) {
            this._assembler.fillBuffers(this._particleSystem, renderer);
        }
    },
});

cc.ParticleTrail = module.exports = CCParticleTrail;

