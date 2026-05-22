/**
 * 粒子颜色随时间变化模块
 * 根据曲线控制粒子在生命周期内的大小变化
 */

const AnimatorBase = require('./p_animator-base');

// 直接 require 3D 粒子系统的 CurveRange 模块
// 处理 TypeScript 的 export default 语法
const GradientRangeModule = require('../../core/3d/particle/animator/gradient-range');
const GradientRange = GradientRangeModule.default || GradientRangeModule;

/**
 * 粒子颜色随时间变化模块
 */
const ColorOvertimeModule = cc.Class({
    name: 'cc.particle.ColorOvertimeModule',
    extends: AnimatorBase,

    properties: {
        /**
         * !#en Whether to enable this module.
         * !#zh 是否启用此模块
         * @property {Boolean} enable
         * @override
         */
        enable: {
            default: true,
            override: true,
            tooltip: CC_DEV && '是否启用颜色随时间变化模块'
        },

        /**
         * !#en Color curve over particle lifetime
         * !#zh 粒子生命周期内的颜色变化
         */
        color: {
            default: function () {
                const range = new GradientRange();
                range.mode = GradientRange.Mode.Color;
                range.color = cc.color(255, 255, 255, 255);
                return range;
            },
            type: GradientRange,
            serializable: true,
            tooltip: CC_DEV && '定义粒子在生命周期内的颜色变化',
        }
    },

    ctor() {
        if (!this.color) {
            this.color = new GradientRange();
        }
        this.color.mode = GradientRange.Mode.Color;
        if (!this.color.color) {
            this.color.color = cc.color(255, 255, 255, 255);
        }
    },

    /**
     * !#en Animate particle color based on its lifetime
     * !#zh 根据粒子生命周期更新粒子颜色
     * @param {Object} particle - 粒子对象
     * @param {Number} dt - 时间增量（未使用，保留接口一致性）
     */
    animate(particle, dt) {
        if (!this.enable || !particle) {
            return;
        }

        // 根据曲线计算当前颜色
        particle.color.set(particle.startColor);
        particle.color.multiply(this.color.evaluate(1.0 - particle.timeToLive / particle.totalLifeTime, null));
    }
});

// 导出并注册到全局命名空间（微信小游戏序列化需要）
cc.particle = cc.particle || {};
cc.particle.ColorOvertimeModule = ColorOvertimeModule;
module.exports = ColorOvertimeModule;

