/**
 * 粒子旋转随时间变化模块
 * 根据曲线控制粒子在生命周期内的旋转变化
 */

const AnimatorBase = require('./p_animator-base');

// 直接 require 3D 粒子系统的 CurveRange 模块
// 处理 TypeScript 的 export default 语法
const CurveRangeModule = require('../../core/3d/particle/animator/curve-range');
const CurveRange = CurveRangeModule.default || CurveRangeModule;

/**
 * 粒子旋转随时间变化模块
 */
const RotationOvertimeModule = cc.Class({
    name: 'cc.particle.RotationOvertimeModule',
    extends: AnimatorBase,

    properties: {
        /**
         * !#en Size curve over particle lifetime
         * !#zh 粒子生命周期内的大小曲线
         */
        rotation: {
            default: function () {
                const range = new CurveRange();
                range.constant = 1.0;
                return range;
            },
            range: [-1, 1],
            type: CurveRange,
            serializable: true,
            tooltip: CC_DEV && '定义粒子在生命周期内的旋转变化曲线（单位：圈/turn，1=360度）',
            visible: function (this) {
                return !this.separateAxes;
            }
        }
    },

    ctor() {
        if (!this.rotation) {
            this.rotation = new CurveRange();
            this.rotation.constant = 1.0;
        }
    },

    /**
     * !#en Animate particle rotation based on its lifetime
     * !#zh 根据粒子生命周期更新粒子旋转
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

        // 特殊处理：TwoConstants 表示“本次生命周期的总旋转量 delta（turn）”
        // 要求：出生时随机一次，整个生命周期内按线性旋转到 delta
        const Mode = CurveRange.Mode;
        if (this.rotation && this.rotation.mode === Mode.TwoConstants) {
            if (particle._rotationOTRandom === undefined) {
                particle._rotationOTRandom = Math.random();
            }
            if (particle._rotationOTDelta === undefined) {
                particle._rotationOTDelta = this.rotation.evaluate(0, particle._rotationOTRandom);
                if (!Number.isFinite(particle._rotationOTDelta)) {
                    particle._rotationOTDelta = 0;
                }
            }
            particle.rotation = particle.startRotation + 360 * (particle._rotationOTDelta * normalizedTime);
            return;
        }

        // 其他模式：按曲线采样（TwoCurves 需要稳定 rndRatio，避免每帧抖动）
        if (particle._rotationOTRandom === undefined) {
            particle._rotationOTRandom = Math.random();
        }
        const rotationTurns = this.rotation ? this.rotation.evaluate(normalizedTime, particle._rotationOTRandom) : 0;
        particle.rotation = particle.startRotation + 360 * (Number.isFinite(rotationTurns) ? rotationTurns : 0);
    }
});

// 导出并注册到全局命名空间（微信小游戏序列化需要）
cc.particle = cc.particle || {};
cc.particle.RotationOvertimeModule = RotationOvertimeModule;
module.exports = RotationOvertimeModule;

