/**
 * 粒子形状发射模块
 * 控制粒子出生位置的分布
 */

const AnimatorBase = require('./p_animator-base');

const ShapeType = cc.Enum({
    Ring: 0,
    Box: 1,
    Cone: 2
});

const ParticleShapeModule = cc.Class({
    name: 'cc.particle.ParticleShapeModule',
    extends: AnimatorBase,

    properties: {
        /**
         * !#en Whether to enable this module.
         * !#zh 是否启用此模块
         * @property {Boolean} enable
         * @override
         */
        enable: {
            default: false,
            override: true,
            tooltip: CC_DEV && '是否启用形状发射模块',
            notify: function () {
                if (CC_EDITOR) {
                    // 通知编辑器刷新属性面板
                    cc.engine?.repaintInEditMode();
                }
            }
        },

        /**
         * !#en Shape type
         * !#zh 形状类型
         * @property {ShapeType} shapeType
         */
        shapeType: {
            default: ShapeType.Ring,
            type: ShapeType,
            serializable: true,
            tooltip: CC_DEV && '发射形状类型',
            notify: function () {
                if (CC_EDITOR) {
                    // 通知编辑器刷新属性面板
                    cc.engine?.repaintInEditMode();
                }
            }
        },

        /**
         * !#en Source position offset
         * !#zh 相对于中心点的偏移
         * @property {Vec2} sourcePos
         */
        sourcePos: {
            default: function () {
                return cc.v2(0, 0);
            },
            serializable: true,
            tooltip: CC_DEV && '相对于中心点的偏移',
            visible: function () {
                return this.enable;
            }
        },

        /**
         * !#en Thickness (0-1)
         * !#zh 厚度，范围0-1
         * @property {Number} thickness
         */
        thickness: {
            default: 0,
            range: [0, 1],
            serializable: true,
            tooltip: CC_DEV && '厚度，1为填充满，0为只在边缘',
            visible: function () {
                return this.enable && (this.shapeType === ShapeType.Ring || this.shapeType === ShapeType.Box);
            }
        },

        // Ring 模式属性
        /**
         * !#en Radius of the ring
         * !#zh 环形的最大半径
         * @property {Number} radius
         */
        radius: {
            default: 50,
            serializable: true,
            tooltip: CC_DEV && '环形的最大半径',
            visible: function () {
                return this.enable && this.shapeType === ShapeType.Ring;
            }
        },

        // Box 模式属性
        /**
         * !#en Width of the box
         * !#zh 矩形的宽度
         * @property {Number} width
         */
        width: {
            default: 100,
            serializable: true,
            tooltip: CC_DEV && '矩形的宽度',
            visible: function () {
                return this.enable && this.shapeType === ShapeType.Box;
            }
        },

        /**
         * !#en Height of the box
         * !#zh 矩形的高度
         * @property {Number} height
         */
        height: {
            default: 100,
            serializable: true,
            tooltip: CC_DEV && '矩形的高度',
            visible: function () {
                return this.enable && this.shapeType === ShapeType.Box;
            }
        },

        // Cone 模式属性
        /**
         * !#en Cone angle spread (angle variance)
         * !#zh 锥形扩散角度（角度变化范围）
         * @property {Number} angle
         */
        angle: {
            default: 20,
            serializable: true,
            tooltip: CC_DEV && '锥形扩散角度（粒子发射角度的变化范围，例如：20表示在±20°范围内随机）',
            visible: function () {
                return this.enable && this.shapeType === ShapeType.Cone;
            }
        }
    },

    ctor() {
    },

    /**
     * !#en Calculate spawn position for a particle
     * !#zh 计算粒子的出生位置
     * @method getSpawnPosition
     * @param {Vec2} outPos - 输出位置
     */
    getSpawnPosition(outPos) {
        if (!this.enable) {
            outPos.x = 0;
            outPos.y = 0;
            return;
        }

        if (this.shapeType === ShapeType.Ring) {
            this._getSpawnPositionRing(outPos);
        } else if (this.shapeType === ShapeType.Box) {
            this._getSpawnPositionBox(outPos);
        } else if (this.shapeType === ShapeType.Cone) {
            this._getSpawnPositionCone(outPos);
        }

        // 应用偏移
        outPos.x += this.sourcePos.x;
        outPos.y += this.sourcePos.y;
    },

    /**
     * !#en Get angle offset for Cone mode
     * !#zh 获取 Cone 模式的角度偏移
     * @method getAngleOffset
     * @return {Number} 角度偏移（弧度）
     */
    getAngleOffset() {
        if (!this.enable || this.shapeType !== ShapeType.Cone) {
            return 0;
        }
        // 在 [-angle, +angle] 范围内随机
        return (Math.random() - 0.5) * 2 * this.angle;
    },

    /**
     * !#en Calculate spawn position for ring shape
     * !#zh 计算环形的出生位置
     * @private
     */
    _getSpawnPositionRing(outPos) {
        // 随机角度
        const angle = Math.random() * Math.PI * 2;

        // 根据 thickness 计算半径
        // thickness = 0: 整个圆内随机
        // thickness = 1: 只在圆的边缘
        const minRadius = this.radius * (1 - this.thickness);
        const maxRadius = this.radius;
        const radius = minRadius + Math.random() * (maxRadius - minRadius);

        // 计算位置
        outPos.x = Math.cos(angle) * radius;
        outPos.y = Math.sin(angle) * radius;
    },

    /**
     * !#en Calculate spawn position for cone shape
     * !#zh 计算锥形的出生位置
     * @private
     */
    _getSpawnPositionCone(outPos) {
        // Cone 模式从点发射，位置固定在原点
        outPos.x = 0;
        outPos.y = 0;
    },

    /**
     * !#en Calculate spawn position for box shape
     * !#zh 计算矩形的出生位置
     * @private
     */
    _getSpawnPositionBox(outPos) {
        const halfWidth = this.width / 2;
        const halfHeight = this.height / 2;

        if (this.thickness === 1) {
            // 整个矩形内随机
            outPos.x = (Math.random() - 0.5) * this.width;
            outPos.y = (Math.random() - 0.5) * this.height;
        } else {
            // 在矩形环内随机分布
            const innerHalfWidth = halfWidth * this.thickness;
            const innerHalfHeight = halfHeight * this.thickness;

            // 随机决定是横向（左右）还是纵向（上下）
            if (Math.random() > 0.5) {
                // 横向：x 在环范围，y 在全范围
                const randomX = Math.random() - 0.5;
                const symbolX = Math.sign(randomX);
                const rangeX = Math.abs(randomX);
                outPos.x = (halfWidth - innerHalfWidth + innerHalfWidth * rangeX) * symbolX;
                outPos.y = (Math.random() - 0.5) * this.height;
            } else {
                // 纵向：x 在全范围，y 在环范围
                outPos.x = (Math.random() - 0.5) * this.width;
                const randomY = Math.random() - 0.5;
                const symbolY = Math.sign(randomY);
                const rangeY = Math.abs(randomY);
                outPos.y = (halfHeight - innerHalfHeight + innerHalfHeight * rangeY) * symbolY;
            }
        }
    }
});

// 导出并注册到全局命名空间（微信小游戏序列化需要）
cc.particle = cc.particle || {};
cc.particle.ParticleShapeModule = ParticleShapeModule;
cc.particle.ShapeType = ShapeType;

module.exports = ParticleShapeModule;
module.exports.ShapeType = ShapeType;

