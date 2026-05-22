/**
 * 粒子纹理帧动画模块
 * 支持序列帧动画播放
 */

const AnimatorBase = require('./p_animator-base');
const CurveRangeModule = require('../../core/3d/particle/animator/curve-range');
const CurveRange = CurveRangeModule.default || CurveRangeModule;

/**
 * !#en Animation mode
 * !#zh 动画模式
 * @enum TextureAnimationModule.Mode
 */
const Mode = cc.Enum({
    /**
     * !#en Grid mode, the texture is divided into tiles
     * !#zh 网格模式，纹理被分割成网格
     * @property {Number} GRID
     */
    GRID: 0
});

/**
 * !#en Time mode for animation
 * !#zh 动画时间模式
 * @enum TextureAnimationModule.TimeMode
 */
const TimeMode = cc.Enum({
    /**
     * !#en FPS mode, frames change based on frame rate
     * !#zh FPS 模式，根据帧率切换帧
     * @property {Number} FPS
     */
    FPS: 0,
    /**
     * !#en Lifetime mode, frames controlled by curve over particle lifetime
     * !#zh 生命周期模式，使用曲线控制帧索引
     * @property {Number} LIFETIME
     */
    LIFETIME: 1
});

/**
 * 粒子纹理帧动画模块
 */
const TextureAnimationModule = cc.Class({
    name: 'cc.particle.TextureAnimationModule',
    extends: AnimatorBase,

    properties: {
        /**
         * !#en Animation mode
         * !#zh 动画模式
         */
        mode: {
            default: Mode.GRID,
            type: Mode,
            serializable: true,
            tooltip: CC_DEV && '动画模式'
        },

        /**
         * !#en Number of tiles in X and Y (columns and rows)
         * !#zh X和Y方向的网格数量（列数和行数）
         */
        tiles: {
            default: function () {
                return cc.v2(4, 4);
            },
            type: cc.Vec2,
            serializable: true,
            tooltip: CC_DEV && '序列帧图的列数和行数',
            visible: function () {
                return this.mode === Mode.GRID;
            }
        },

        /**
         * !#en Time mode for frame animation
         * !#zh 帧动画的时间模式
         */
        timeMode: {
            default: TimeMode.FPS,
            type: TimeMode,
            serializable: true,
            tooltip: CC_DEV && '时间模式'
        },

        /**
         * !#en Frames per second
         * !#zh 每秒播放帧数
         */
        fps: {
            default: 10,
            serializable: true,
            tooltip: CC_DEV && '每秒播放的帧数',
            visible: function () {
                return this.timeMode === TimeMode.FPS;
            }
        },

        /**
         * !#en Frame over lifetime curve (0-1)
         * !#zh 生命周期曲线（0-1）
         */
        frameOverTime: {
            default: function () {
                const range = new CurveRange();
                range.mode = CurveRange.Mode.Constant;
                range.constant = 1.0;
                return range;
            },
            type: CurveRange,
            serializable: true,
            tooltip: CC_DEV && '帧随生命周期变化曲线（0-1）',
            visible: function () {
                return this.timeMode === TimeMode.LIFETIME;
            }
        },

        /**
         * !#en Start frame index (0-based)
         * !#zh 起始帧索引（从0开始）
         */
        startFrame: {
            default: function () {
                const range = new CurveRange();
                range.mode = CurveRange.Mode.Constant;
                range.constant = 0;
                return range;
            },
            type: CurveRange,
            serializable: true,
            tooltip: CC_DEV && '起始帧偏移（从0开始）。每个粒子在出生时采样一次并缓存，生命周期内保持不变。'
        },

        /**
         * !#en Whether to loop the animation
         * !#zh 是否循环播放动画
         */
        loop: {
            default: true,
            serializable: true,
            tooltip: CC_DEV && '是否循环播放'
        }
    },

    statics: {
        Mode: Mode,
        TimeMode: TimeMode
    },

    ctor() {
        if (!this.tiles) {
            this.tiles = cc.v2(1, 1);
        }
    },

    /**
     * !#en Get total frame count
     * !#zh 获取总帧数
     */
    getTotalFrames() {
        if (this.mode === Mode.GRID && this.tiles) {
            return Math.floor(this.tiles.x) * Math.floor(this.tiles.y);
        }
        return 1;
    },

    /**
     * !#en Calculate current frame index based on particle lifetime
     * !#zh 根据粒子生命周期计算当前帧索引
     * @param {Object} particle - 粒子对象
     */
    getCurrentFrame(particle) {
        if (!this.enable || !particle) {
            return 0;
        }

        const totalFrames = this.getTotalFrames();
        if (totalFrames <= 1) {
            return 0;
        }

        // 起始帧偏移：每个粒子只确定一次（防止生命周期中途跳变）
        let startOffset = 0;
        if (particle._startFrameOffset === undefined) {
            if (particle._startFrameRandom === undefined) {
                particle._startFrameRandom = Math.random();
            }
            startOffset = Math.floor(this.startFrame.evaluate(0, particle._startFrameRandom));

            if (!Number.isFinite(startOffset)) {
                startOffset = 0;
            }

            // 归一化到合法范围
            if (this.loop) {
                startOffset = ((startOffset % totalFrames) + totalFrames) % totalFrames;
            } else {
                startOffset = Math.max(0, Math.min(startOffset, totalFrames - 1));
            }

            particle._startFrameOffset = startOffset;
        } else {
            startOffset = particle._startFrameOffset;
        }

        // 计算已经过的时间
        const elapsedTime = particle.totalLifeTime - particle.timeToLive;

        let frameIndex = 0;
        if (this.timeMode === TimeMode.FPS && this.fps > 0) {
            // 根据 FPS 计算当前帧
            const frameTime = 1.0 / this.fps;
            frameIndex = Math.floor(elapsedTime / frameTime);
        } else if (this.timeMode === TimeMode.LIFETIME && this.frameOverTime) {
            const lifetimeRatio = 1.0 - Math.max(0, particle.timeToLive) / Math.max(particle.totalLifeTime, 0.0001);
            if (particle._frameRandom === undefined) {
                particle._frameRandom = Math.random();
            }
            let ratio = this.frameOverTime.evaluate(lifetimeRatio, particle._frameRandom);
            frameIndex = Math.floor(ratio);
        }

        // 加上起始帧偏移
        frameIndex += startOffset;

        // 处理循环
        if (this.loop) {
            frameIndex = ((frameIndex % totalFrames) + totalFrames) % totalFrames;
        } else {
            frameIndex = Math.min(frameIndex, totalFrames - 1);
        }

        return Math.max(0, frameIndex);
    },

    /**
     * !#en Calculate UV coordinates for a specific frame
     * !#zh 计算指定帧的UV坐标
     * @param {Number} frameIndex - 帧索引
     * @param {Array} baseUV - 基础UV坐标 [bl.u, bl.v, br.u, br.v, tl.u, tl.v, tr.u, tr.v]
     * @returns {Array} 新的UV坐标数组
     */
    getFrameUV(frameIndex, baseUV) {
        if (this.mode !== Mode.GRID || !this.tiles) {
            return baseUV;
        }

        const cols = Math.floor(this.tiles.x);
        const rows = Math.floor(this.tiles.y);

        if (cols <= 0 || rows <= 0) {
            return baseUV;
        }

        // 计算当前帧在网格中的位置
        const col = frameIndex % cols;
        const row = Math.floor(frameIndex / cols) % rows;

        // 计算单个格子的UV尺寸
        const tileWidth = 1.0 / cols;
        const tileHeight = 1.0 / rows;

        // 计算当前帧的UV范围
        const uMin = col * tileWidth;
        const uMax = (col + 1) * tileWidth;
        const vMin = row * tileHeight;
        const vMax = (row + 1) * tileHeight;

        // 返回四个顶点的UV坐标
        // 注意：Cocos的V坐标是从上到下的，可能需要翻转
        return [
            uMin, vMax,  // bl (左下)
            uMax, vMax,  // br (右下)
            uMin, vMin,  // tl (左上)
            uMax, vMin   // tr (右上)
        ];
    },

    /**
     * !#en Animate the particle (this module updates UVs, not particle properties)
     * !#zh 更新粒子（此模块更新UV，不是粒子属性）
     * @param {Object} particle - 粒子对象
     * @param {Number} dt - 时间增量
     */
    animate(particle, dt) {
        // 此模块主要在 updateUVs 中使用
        // 这里可以预先计算并缓存当前帧索引
        if (this.enable && particle) {
            particle._currentFrame = this.getCurrentFrame(particle);
        }
    }
});

// 导出并注册到全局命名空间（微信小游戏序列化需要）
cc.particle = cc.particle || {};
cc.particle.TextureAnimationModule = TextureAnimationModule;
module.exports = TextureAnimationModule;

