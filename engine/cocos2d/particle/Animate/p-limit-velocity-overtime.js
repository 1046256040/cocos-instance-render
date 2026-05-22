/**
 * 粒子限速模块
 * 限制粒子速度不超过指定值
 */

const AnimatorBase = require('./p_animator-base');

// 直接 require 3D 粒子系统的 CurveRange 模块
const CurveRangeModule = require('../../core/3d/particle/animator/curve-range');
const CurveRange = CurveRangeModule.default || CurveRangeModule;

// 随机数偏移量
const LIMIT_VELOCITY_RAND_OFFSET = 23541;

/**
 * 在超出限制时进行阻尼
 * @param {Number} vel - 当前速度
 * @param {Number} limit - 速度限制
 * @param {Number} dampen - 阻尼系数
 * @returns {Number} 阻尼后的速度
 */
function dampenBeyondLimit(vel, limit, dampen) {
    const sgn = Math.sign(vel);
    let abs = Math.abs(vel);
    if (abs > limit) {
        // 使用缓入插值（先慢后快）- 二次方缓动
        const t = dampen * dampen;
        abs = abs + (limit - abs) * t;
    }
    return abs * sgn;
}

/**
 * 粒子限速模块（2D版本）
 */
const LimitVelocityOvertimeModule = cc.Class({
    name: 'cc.particle.LimitVelocityOvertimeModule',
    extends: AnimatorBase,

    properties: {
        /**
         * !#en Whether to limit the two axes separately
         * !#zh 是否分别限制两个轴
         */
        separateAxes: {
            default: false,
            serializable: true,
            tooltip: CC_DEV && '是否分别限制X和Y轴的速度'
        },

        /**
         * !#en Speed limit (when not separating axes)
         * !#zh 速度限制（不分轴时）
         */
        limit: {
            default: function () {
                const range = new CurveRange();
                range.constant = 1;
                return range;
            },
            type: CurveRange,
            serializable: true,
            tooltip: CC_DEV && '速度上限',
            visible: function () {
                return !this.separateAxes;
            }
        },

        /**
         * !#en Speed limit in X direction
         * !#zh X轴方向的速度限制
         */
        limitX: {
            default: function () {
                const range = new CurveRange();
                range.constant = 1;
                return range;
            },
            type: CurveRange,
            serializable: true,
            tooltip: CC_DEV && 'X轴方向的速度上限',
            visible: function () {
                return this.separateAxes;
            }
        },

        /**
         * !#en Speed limit in Y direction
         * !#zh Y轴方向的速度限制
         */
        limitY: {
            default: function () {
                const range = new CurveRange();
                range.constant = 1;
                return range;
            },
            type: CurveRange,
            serializable: true,
            tooltip: CC_DEV && 'Y轴方向的速度上限',
            visible: function () {
                return this.separateAxes;
            }
        },

        /**
         * !#en Damping coefficient
         * !#zh 阻尼系数
         */
        dampen: {
            default: 0.1,
            serializable: true,
            tooltip: CC_DEV && '当速度超过限制时的阻尼系数（0-1之间，越大阻尼越强）',
            range: [0, 1]
        }
    },

    ctor() {
        if (!this.limit) {
            this.limit = new CurveRange();
            this.limit.constant = 1;
        }
        if (!this.limitX) {
            this.limitX = new CurveRange();
            this.limitX.constant = 1;
        }
        if (!this.limitY) {
            this.limitY = new CurveRange();
            this.limitY.constant = 1;
        }
    },

    /**
     * !#en Limit particle velocity
     * !#zh 限制粒子速度
     * @param {Object} particle - 粒子对象
     * @param {Number} dt - 时间增量
     */
    animate(particle, dt) {
        if (!this.enable || !particle) {
            return;
        }

        // 计算归一化的生命周期进度
        let normalizedTime = 0;
        if (particle.totalLifeTime && particle.totalLifeTime > 0) {
            normalizedTime = 1.0 - (particle.timeToLive / particle.totalLifeTime);
            normalizedTime = Math.max(0, Math.min(1, normalizedTime));
        }

        // 只对重力模式的粒子有效（有 dir 属性）
        if (!particle.dir) {
            return;
        }

        if (this.separateAxes) {
            // 分别限制X和Y轴
            const limitX = this.limitX.evaluate(normalizedTime);
            const limitY = this.limitY.evaluate(normalizedTime);

            particle.dir.x = dampenBeyondLimit(particle.dir.x, limitX, this.dampen);
            particle.dir.y = dampenBeyondLimit(particle.dir.y, limitY, this.dampen);
        } else {
            // 限制整体速度大小
            const limitSpeed = this.limit.evaluate(normalizedTime);

            // 计算当前速度大小
            const currentSpeed = Math.sqrt(particle.dir.x * particle.dir.x + particle.dir.y * particle.dir.y);

            if (currentSpeed > limitSpeed && currentSpeed > 0) {
                // 计算阻尼后的速度
                const dampedSpeed = dampenBeyondLimit(currentSpeed, limitSpeed, this.dampen);

                // 保持方向，只改变速度大小
                const scale = dampedSpeed / currentSpeed;
                particle.dir.x *= scale;
                particle.dir.y *= scale;
            }
        }
    }
});

// 导出并注册到全局命名空间（微信小游戏序列化需要）
cc.particle = cc.particle || {};
cc.particle.LimitVelocityOvertimeModule = LimitVelocityOvertimeModule;
module.exports = LimitVelocityOvertimeModule;

