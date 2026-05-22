/**
 * 粒子大小随时间变化模块
 * 根据曲线控制粒子在生命周期内的大小变化
 */

const AnimatorBase = require('./p_animator-base');

// 直接 require 3D 粒子系统的 CurveRange 模块
// 处理 TypeScript 的 export default 语法
const CurveRangeModule = require('../../core/3d/particle/animator/curve-range');
const CurveRange = CurveRangeModule.default || CurveRangeModule;

/**
 * 粒子大小随时间变化模块
 */
const SizeOvertimeModule = cc.Class({
    name: 'cc.particle.SizeOvertimeModule',
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
            tooltip: CC_DEV && '是否启用大小随时间变化模块'
        },

        /**
         * !#en Size curve over particle lifetime
         * !#zh 粒子生命周期内的大小曲线
         */
        size: {
            default: function () {
                const range = new CurveRange();
                range.mode = CurveRange.Mode.Constant;
                range.constant = 1.0;
                return range;
            },
            type: CurveRange,
            serializable: true,
            tooltip: CC_DEV && '定义粒子在生命周期内的大小变化曲线',
            visible: function (this) {
                return !this.separateAxes;
            }
        }
    },

    ctor() {
        if (!this.size) {
            this.size = new CurveRange();
        }
        this.size.mode = CurveRange.Mode.Constant;
        this.size.constant = 1.0;
    },

    /**
     * !#en Animate particle size based on its lifetime
     * !#zh 根据粒子生命周期更新粒子大小
     * @param {Object} particle - 粒子对象
     * @param {Number} dt - 时间增量（未使用，保留接口一致性）
     */
    animate(particle, dt) {
        if (!this.enable || !particle) {
            return;
        }

        // 计算归一化的生命周期进度（从0到1）
        // particle.totalLifeTime: 初始生命时间
        // particle.timeToLive: 剩余生命时间
        let normalizedTime = 0;
        if (particle.totalLifeTime && particle.totalLifeTime > 0) {
            normalizedTime = 1.0 - (particle.timeToLive / particle.totalLifeTime);
            normalizedTime = Math.max(0, Math.min(1, normalizedTime));
        }

        // 根据曲线计算当前大小系数
        const sizeMultiplier = this.size.evaluate(normalizedTime);

        // 应用到粒子大小
        // particle.startSizeForCurve: 粒子的初始大小
        if (particle.startSizeForCurve !== undefined) {
            particle.size = particle.startSizeForCurve * sizeMultiplier;

            // 确保大小不为负
            if (particle.size < 0) {
                particle.size = 0;
            }
        }
    }
});

// 导出并注册到全局命名空间（微信小游戏序列化需要）
cc.particle = cc.particle || {};
cc.particle.SizeOvertimeModule = SizeOvertimeModule;
module.exports = SizeOvertimeModule;

