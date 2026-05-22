/**
 * 粒子动画模块基类
 * 所有粒子动画模块都应继承自此基类
 */

const AnimatorBase = cc.Class({
    name: 'cc.particle.AnimatorBase',

    properties: {
        /**
         * !#en Whether to enable this module.
         * !#zh 是否启用此模块
         * @property {Boolean} enable
         */
        enable: {
            default: false,
            serializable: true,
            tooltip: CC_DEV && '是否启用此动画模块'
        }
    },

    ctor() {

    },

    /**
     * !#en Animate the particle.
     * !#zh 更新粒子属性
     * @method animate
     * @param {Object} particle - 粒子对象
     * @param {Number} dt - 时间增量（可选，某些模块需要）
     */
    animate(particle, dt) {
        // 子类需要重写此方法来实现具体的动画逻辑
        // 在此方法中修改 particle 的属性（如 size、color、rotation 等）
    }
});

// 导出并注册到全局命名空间（微信小游戏序列化需要）
cc.particle = cc.particle || {};
cc.particle.AnimatorBase = AnimatorBase;
module.exports = AnimatorBase;

