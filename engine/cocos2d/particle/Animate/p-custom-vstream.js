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
const CustomVStreamModule = cc.Class({
    name: 'cc.particle.CustomVStreamModule',
    extends: AnimatorBase,

    properties: {
        /**
         * !#en Size curve over particle lifetime
         * !#zh 粒子生命周期内的大小曲线
         */
        vstreamX: {
            default: function () {
                const range = new CurveRange();
                range.constant = 1.0;
                return range;
            },
            type: CurveRange,
            serializable: true,
            tooltip: CC_DEV && '定义粒子在生命周期内顶点流(uv1)X值的变化曲线',
            visible: function (this) {
                return true;
            }
        },
        vstreamY: {
            default: function () {
                const range = new CurveRange();
                range.constant = 1.0;
                return range;
            },
            type: CurveRange,
            serializable: true,
            tooltip: CC_DEV && '定义粒子在生命周期内顶点流(uv1)Y值的变化曲线',
            visible: function (this) {
                return true;
            }
        },
        vstreamZ: {
            default: function () {
                const range = new CurveRange();
                range.constant = 1.0;
                return range;
            },
            type: CurveRange,
            serializable: true,
            tooltip: CC_DEV && '定义粒子在生命周期内顶点流(uv1)Z值的变化曲线',
        },
        vstreamW: {
            default: function () {
                const range = new CurveRange();
                range.constant = 1.0;
                return range;
            },
            type: CurveRange,
            serializable: true,
            tooltip: CC_DEV && '定义粒子在生命周期内顶点流(uv1)W值的变化曲线',
        },
    },

    ctor() {
        if (!this.size) {
            this.size = new CurveRange();
            this.size.constant = 1.0;
        }
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
        const vstreamX = this.vstreamX.evaluate(normalizedTime);
        const vstreamY = this.vstreamY.evaluate(normalizedTime);
        const vstreamZ = this.vstreamZ.evaluate(normalizedTime);
        const vstreamW = this.vstreamW.evaluate(normalizedTime);

        // 应用到粒子大小
        particle.vstream.x = vstreamX;
        particle.vstream.y = vstreamY;
        particle.vstream.z = vstreamZ;
        particle.vstream.w = vstreamW;
    }
});

// 导出并注册到全局命名空间（微信小游戏序列化需要）
cc.particle = cc.particle || {};
cc.particle.CustomVStreamModule = CustomVStreamModule;
module.exports = CustomVStreamModule;

