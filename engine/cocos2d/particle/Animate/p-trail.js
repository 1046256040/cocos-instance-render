/**
 * 粒子拖尾模块
 * 为每个粒子生成拖尾效果
 */

const AnimatorBase = require('./p_animator-base');

const TrailMode = cc.Enum({
    Particles: 0,  // 每个粒子独立拖尾
    Ribbon: 1      // 所有粒子连成一条带状
});

const TextureMode = cc.Enum({
    Stretch: 0,    // 纹理拉伸覆盖整个拖尾
    Tile: 1,       // 纹理平铺
    DistributePerSegment: 2, // 每段分配纹理
    RepeatPerSegment: 3      // 每段重复纹理
});

// 引入 GradientRange 和 CurveRange 用于颜色和宽度控制
const GradientRangeModule = require('../../core/3d/particle/animator/gradient-range');
const GradientRange = GradientRangeModule.default || GradientRangeModule;
const CurveRangeModule = require('../../core/3d/particle/animator/curve-range');
const CurveRange = CurveRangeModule.default || CurveRangeModule;

const TrailModule = cc.Class({
    name: 'cc.particle.TrailModule',
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
            tooltip: CC_DEV && '是否启用拖尾模块',
            notify: function () {
                // 清理所有拖尾数据
                this.clear();
                // 编辑器模式下重绘
                if (CC_EDITOR) {
                    cc.engine?.repaintInEditMode();
                }
            }
        },

        /**
         * !#en Trail mode
         * !#zh 拖尾模式
         * @property {TrailMode} mode
         */
        mode: {
            default: TrailMode.Particles,
            type: TrailMode,
            serializable: true,
            tooltip: CC_DEV && '拖尾模式（Particles: 每个粒子独立拖尾，Ribbon: 所有粒子连成带状）',
            visible: function () {
                return this.enable;
            }
        },

        /**
         * !#en Render above particles
         * !#zh 在粒子上方渲染
         * @property {Boolean} renderAboveParticles
         */
        renderAboveParticles: {
            default: false,
            serializable: true,
            tooltip: CC_DEV && '是否在粒子上方渲染（false: 在粒子下方，true: 在粒子上方）',
            visible: function () {
                return this.enable;
            }
        },

        /**
         * !#en Trail material
         * !#zh 拖尾材质
         * @property {Material} material
         */
        material: {
            default: null,
            type: cc.Material,
            serializable: true,
            tooltip: CC_DEV && '拖尾使用的材质（留空则使用粒子系统的材质）',
            visible: function () {
                return this.enable;
            }
        },

        /**
         * !#en Source blend factor for trail material (only works when a custom material is set).
         * !#zh 拖尾独立材质的源混合因子（仅在设置了自定义材质时生效）。
         * @property {cc.macro.BlendFactor} srcBlendFactor
         */
        srcBlendFactor: {
            default: cc.macro.BlendFactor.SRC_ALPHA,
            type: cc.macro.BlendFactor,
            serializable: true,
            tooltip: CC_DEV && '拖尾独立材质的源混合因子（需要设置 material 才生效）',
            visible: function () {
                return this.enable && !!this.material;
            }
        },

        /**
         * !#en Destination blend factor for trail material (only works when a custom material is set).
         * !#zh 拖尾独立材质的目标混合因子（仅在设置了自定义材质时生效）。
         * @property {cc.macro.BlendFactor} dstBlendFactor
         */
        dstBlendFactor: {
            default: cc.macro.BlendFactor.ONE_MINUS_SRC_ALPHA,
            type: cc.macro.BlendFactor,
            serializable: true,
            tooltip: CC_DEV && '拖尾独立材质的目标混合因子（需要设置 material 才生效）',
            visible: function () {
                return this.enable && !!this.material;
            }
        },

        /**
         * !#en Minimum vertex distance
         * !#zh 最小顶点距离
         * @property {Number} minVertexDistance
         */
        minVertexDistance: {
            default: 1,
            serializable: true,
            tooltip: CC_DEV && '生成拖尾顶点的最小距离（粒子移动超过这个距离才生成新顶点）',
            visible: function () {
                return this.enable;
            }
        },

        /**
         * !#en Lifetime of trail
         * !#zh 拖尾生命周期
         * @property {Number} lifetime
         */
        lifetime: {
            default: 1.0,
            serializable: true,
            tooltip: CC_DEV && '拖尾的生命周期（秒）',
            visible: function () {
                return this.enable;
            }
        },

        /**
         * !#en Texture mode
         * !#zh 纹理模式
         * @property {TextureMode} textureMode
         */
        textureMode: {
            default: TextureMode.Stretch,
            type: TextureMode,
            serializable: true,
            tooltip: CC_DEV && '纹理映射模式',
            visible: function () {
                return this.enable;
            }
        },

        /**
         * !#en Width over trail
         * !#zh 拖尾宽度
         * @property {Number} widthRatio
         */
        widthRatio: {
            default: 1.0,
            range: [0, 2],
            serializable: true,
            tooltip: CC_DEV && '拖尾宽度（相对于粒子大小的比例）',
            visible: function () {
                return this.enable;
            }
        },

        /**
         * !#en Inherit particle size
         * !#zh 继承粒子大小
         * @property {Boolean} inheritParticleSize
         */
        inheritParticleSize: {
            default: true,
            serializable: true,
            tooltip: CC_DEV && '是否继承粒子的大小变化曲线（跟随粒子系统的 SizeOvertimeModule）',
            notify: CC_EDITOR && function () {
                cc.engine?.repaintInEditMode();
            },
            visible: function () {
                return this.enable;
            }
        },

        /**
         * !#en Size over lifetime
         * !#zh 大小随生命周期变化
         * @property {CurveRange} sizeOverLifetime
         */
        sizeOverLifetime: {
            default: function () {
                const range = new CurveRange();
                range.mode = CurveRange.Mode.Constant;
                range.constant = 1.0;
                return range;
            },
            type: CurveRange,
            serializable: true,
            tooltip: CC_DEV && '拖尾大小随生命周期的变化曲线',
            visible: function () {
                return this.enable && !this.inheritParticleSize;
            }
        },

        /**
         * !#en Inherit particle color
         * !#zh 继承粒子颜色
         * @property {Boolean} inheritParticleColor
         */
        inheritParticleColor: {
            default: true,
            serializable: true,
            tooltip: CC_DEV && '是否继承粒子的颜色变化（跟随粒子系统的 ColorOvertimeModule）',
            notify: CC_EDITOR && function () {
                cc.engine?.repaintInEditMode();
            },
            visible: function () {
                return this.enable;
            }
        },

        /**
         * !#en Color over lifetime
         * !#zh 颜色随生命周期变化
         * @property {GradientRange} colorOverLifetime
         */
        colorOverLifetime: {
            default: function () {
                const range = new GradientRange();
                range.mode = GradientRange.Mode.Color;
                return range;
            },
            type: GradientRange,
            serializable: true,
            tooltip: CC_DEV && '拖尾点的颜色随其生命周期的变化曲线',
            visible: function () {
                return this.enable && !this.inheritParticleColor;
            }
        },

        /**
         * !#en Color over trail
         * !#zh 颜色沿拖尾渐变
         * @property {GradientRange} colorOverTrail
         */
        colorOverTrail: {
            default: function () {
                const range = new GradientRange();
                range.mode = GradientRange.Mode.Color;
                return range;
            },
            type: GradientRange,
            serializable: true,
            tooltip: CC_DEV && '拖尾从头到尾的颜色渐变曲线',
            visible: function () {
                return this.enable;
            }
        },







        /**
         * !#en Die with particles
         * !#zh 跟随粒子死亡
         * @property {Boolean} dieWithParticles
         */
        dieWithParticles: {
            default: true,
            serializable: true,
            tooltip: CC_DEV && '当粒子死亡时，拖尾是否立即消失',
            visible: function () {
                return this.enable;
            }
        }
    },

    ctor() {
        // 存储每个粒子的拖尾数据
        this._trailData = new Map(); // particleId -> TrailData
        this._trailAssembler = null;  // Trail 渲染器
        // 点对象池，用于复用
        this._pointPool = [];

        // 初始化 GradientRange
        if (!this.colorOverLifetime) {
            this.colorOverLifetime = new GradientRange();
            this.colorOverLifetime.mode = GradientRange.Mode.Color;
        }
        if (!this.colorOverTrail) {
            this.colorOverTrail = new GradientRange();
            this.colorOverTrail.mode = GradientRange.Mode.Color;
        }

        // 初始化 CurveRange
        if (!this.sizeOverLifetime) {
            this.sizeOverLifetime = new CurveRange();
            this.sizeOverLifetime.mode = CurveRange.Mode.Constant;
            this.sizeOverLifetime.constant = 1.0;
        }

        // 复用的 Mesh 数据缓存
        this._meshVertices = new Float32Array(0);
        this._meshUVs = new Float32Array(0);
        this._meshUV1s = new Float32Array(0);
        this._meshColors = new Float32Array(0);
        this._meshIndices = new Uint16Array(0);
        this._meshVertexCount = 0;
        this._meshIndexCount = 0;
        this._meshDirty = true;
        this._meshData = {
            vertices: this._meshVertices,
            uvs: this._meshUVs,
            uv1s: this._meshUV1s,
            colors: this._meshColors,
            indices: this._meshIndices,
            vertexCount: 0,
            indexCount: 0
        };

        // 临时复用缓存
        this._normalBufferX = new Float32Array(0);
        this._normalBufferY = new Float32Array(0);
        this._segmentNormalX = new Float32Array(0);
        this._segmentNormalY = new Float32Array(0);
        this._lengthCache = new Float32Array(0);
        this._tempColor = { r: 255, g: 255, b: 255, a: 255 };

        // Debug：避免控制台刷屏（只打印一次）
        this._debugIndexOORLogged = false;
        this._debugOffsetMismatchLogged = false;
        this._debugNaNLogged = false;
    },

    /**
     * !#en Get or create trail assembler
     * !#zh 获取或创建拖尾渲染器
     */
    getAssembler() {
        if (!this._trailAssembler) {
            const TrailAssembler = require('../trail-assembler');
            this._trailAssembler = new TrailAssembler(null);
        }
        return this._trailAssembler;
    },

    /**
     * !#en Get a point from pool or create new one
     * !#zh 从对象池获取点或创建新点
     * @private
     */
    _getPoint(pos, color, size) {
        let point;
        if (this._pointPool.length > 0) {
            // 从对象池复用
            point = this._pointPool.pop();
            point.pos.x = pos.x;
            point.pos.y = pos.y;
            point.time = 0;
            point.color.r = color.r;
            point.color.g = color.g;
            point.color.b = color.b;
            point.color.a = color.a;
            point.size = size;
        } else {
            // 创建新点
            point = {
                pos: cc.v2(pos.x, pos.y),
                time: 0,
                color: cc.color(color.r, color.g, color.b, color.a),
                size: size
            };
        }
        return point;
    },

    /**
     * !#en Return point to pool
     * !#zh 将点返回对象池
     * @private
     */
    _recyclePoint(point) {
        // 安全检查：_pointPool 可能在 ctor 之前被访问
        if (!this._pointPool) return;
        this._pointPool.push(point);
    },

    _markMeshDirty() {
        this._meshDirty = true;
    },

    _getActivePointCount(trailData) {
        if (!trailData) return 0;
        return trailData.points.length - (trailData.startIndex || 0);
    },

    _ensureFloatArray(field, requiredLength, copyLength) {
        let buffer = this[field];
        if (buffer.length >= requiredLength) {
            return buffer;
        }
        let newCapacity = buffer.length ? buffer.length : 1;
        while (newCapacity < requiredLength) {
            newCapacity *= 2;
        }
        let newBuffer = new Float32Array(newCapacity);
        if (buffer.length && copyLength) {
            newBuffer.set(buffer.subarray(0, copyLength));
        }
        this[field] = newBuffer;
        return newBuffer;
    },

    _ensureUint16Array(field, requiredLength, copyLength) {
        let buffer = this[field];
        if (buffer.length >= requiredLength) {
            return buffer;
        }
        let newCapacity = buffer.length ? buffer.length : 1;
        while (newCapacity < requiredLength) {
            newCapacity *= 2;
        }
        let newBuffer = new Uint16Array(newCapacity);
        if (buffer.length && copyLength) {
            newBuffer.set(buffer.subarray(0, copyLength));
        }
        this[field] = newBuffer;
        return newBuffer;
    },

    _ensureMeshCapacity(vertexCount, indexCount) {
        const vertexFloatCount = vertexCount * 2;
        const uvFloatCount = vertexCount * 2;
        const uv1FloatCount = vertexCount * 4;
        const colorFloatCount = vertexCount * 4;

        this._ensureFloatArray('_meshVertices', vertexFloatCount, this._meshVertexCount * 2);
        this._ensureFloatArray('_meshUVs', uvFloatCount, this._meshVertexCount * 2);
        this._ensureFloatArray('_meshUV1s', uv1FloatCount, this._meshVertexCount * 4);
        this._ensureFloatArray('_meshColors', colorFloatCount, this._meshVertexCount * 4);
        this._ensureUint16Array('_meshIndices', indexCount, this._meshIndexCount);

        // 更新 meshData 引用
        this._meshData.vertices = this._meshVertices;
        this._meshData.uvs = this._meshUVs;
        this._meshData.uv1s = this._meshUV1s;
        this._meshData.colors = this._meshColors;
        this._meshData.indices = this._meshIndices;
    },

    _ensureTempCapacity(count) {
        this._ensureFloatArray('_normalBufferX', count);
        this._ensureFloatArray('_normalBufferY', count);
        const segmentCount = Math.max(count - 1, 1);
        this._ensureFloatArray('_segmentNormalX', segmentCount);
        this._ensureFloatArray('_segmentNormalY', segmentCount);
        this._ensureFloatArray('_lengthCache', count);
    },

    _compactTrail(trailData) {
        if (!trailData) return;
        let start = trailData.startIndex || 0;
        if (start === 0) return;
        const points = trailData.points;
        const activeCount = points.length - start;
        if (activeCount <= 0) {
            trailData.points.length = 0;
            trailData.startIndex = 0;
            return;
        }
        if (start > 32 && start > activeCount) {
            trailData.points = points.slice(start);
            trailData.startIndex = 0;
        }
    },

    /**
     * !#en Initialize trail data for a particle
     * !#zh 为粒子初始化拖尾数据
     * @param {Number} particleId - 粒子ID
     * @param {Vec2} position - 初始位置
     * @param {Color} color - 初始颜色
     * @param {Number} size - 初始大小
     * @param {Number} scaleX - 节点X轴缩放
     * @param {Number} scaleY - 节点Y轴缩放
     */
    initTrail(particleId, position, color, size, scaleX, scaleY) {
        if (!this.enable) return;

        // 计算 Trail 实际宽度（只受 scaleX 影响）
        let maxScale = Math.max(scaleX || 1, scaleY || 1);
        let trailWidth = (size / maxScale) * (scaleX || 1);

        const trailData = {
            id: particleId,
            points: [],      // 拖尾点数组 {pos: Vec2, time: Number, color: Color, size: Number}
            startIndex: 0,
            isDead: false,
            initialSize: trailWidth,  // 保存 Trail 的实际宽度（只受 scaleX 影响）
            currentParticleColor: cc.color(color.r, color.g, color.b, color.a),  // 粒子当前颜色
            currentParticleSize: trailWidth,  // Trail 当前宽度
            particleLifeProgress: 0,  // 粒子生命周期进度 (0-1)
            scaleX: scaleX || 1,  // 保存 scaleX
            scaleY: scaleY || 1   // 保存 scaleY
        };

        // 从对象池获取初始点
        const point = this._getPoint(position, color, trailWidth);
        trailData.points.push(point);

        this._trailData.set(particleId, trailData);
        this._markMeshDirty();
    },

    /**
     * !#en Update trail for a particle
     * !#zh 更新粒子的拖尾
     * @param {Number} particleId - 粒子ID
     * @param {Vec2} position - 当前位置
     * @param {Color} color - 当前颜色
     * @param {Number} size - 当前大小
     * @param {Number} particleLifeProgress - 粒子生命周期进度 (0-1)
     * @param {Number} scaleX - 节点X轴缩放
     * @param {Number} scaleY - 节点Y轴缩放
     * @param {Number} dt - 时间增量
     */
    updateTrail(particleId, position, color, size, particleLifeProgress, scaleX, scaleY, dt) {
        if (!this.enable) return;

        const trailData = this._trailData.get(particleId);
        if (!trailData) {
            return;
        }

        // 计算 Trail 实际宽度（只受 scaleX 影响）
        let maxScale = Math.max(scaleX || 1, scaleY || 1);
        let trailWidth = (size / maxScale) * (scaleX || 1);

        // 更新粒子当前状态
        trailData.currentParticleColor.r = color.r;
        trailData.currentParticleColor.g = color.g;
        trailData.currentParticleColor.b = color.b;
        trailData.currentParticleColor.a = color.a;
        trailData.currentParticleSize = trailWidth;  // 使用 Trail 宽度
        trailData.particleLifeProgress = particleLifeProgress;  // 保存粒子生命周期进度

        let points = trailData.points;
        let startIndex = trailData.startIndex || 0;
        const count = points.length;

        // 更新时间
        for (let i = startIndex; i < count; i++) {
            points[i].time += dt;
        }

        // 移除超过生命周期的点
        const lifetime = this.lifetime;
        while (startIndex < points.length && points[startIndex].time > lifetime) {
            this._recyclePoint(points[startIndex]);
            startIndex++;
        }
        trailData.startIndex = startIndex;
        this._compactTrail(trailData);
        points = trailData.points;
        startIndex = trailData.startIndex || 0;

        let activeCount = points.length - startIndex;
        if (activeCount <= 0) {
            points.length = 0;
            trailData.startIndex = 0;
            const newPoint = this._getPoint(position, color, trailWidth);
            points.push(newPoint);
            activeCount = 1;
        }

        // 检查与最后一个点的距离
        const lastPoint = points[points.length - 1];
        const dx = position.x - lastPoint.pos.x;
        const dy = position.y - lastPoint.pos.y;
        const minDist = this.minVertexDistance;
        if ((dx * dx + dy * dy) >= (minDist * minDist)) {
            const point = this._getPoint(position, color, trailWidth);
            points.push(point);
        }

        this._markMeshDirty();
    },

    /**
     * !#en Remove trail for a particle
     * !#zh 移除粒子的拖尾
     * @param {Number} particleId - 粒子ID
     */
    removeTrail(particleId) {
        if (!this.enable) return;

        const trailData = this._trailData.get(particleId);
        if (!trailData) {
            return;
        }

        if (this.dieWithParticles) {
            // 立即删除，回收所有点到对象池
            const start = trailData.startIndex || 0;
            for (let i = start; i < trailData.points.length; i++) {
                this._recyclePoint(trailData.points[i]);
            }
            trailData.points.length = 0;
            trailData.startIndex = 0;
            this._trailData.delete(particleId);
        } else {
            // 标记为死亡，让拖尾自然消失
            trailData.isDead = true;
        }
        this._markMeshDirty();
    },

    /**
     * !#en Build mesh for all trails
     * !#zh 为所有拖尾构建网格
     * @return {Object} mesh data {vertices, indices, uvs, colors}
     */
    buildMesh() {
        if (!this.enable) return null;

        if (!this._meshDirty) {
            return this._meshData;
        }

        let totalVertexCount = 0;
        let totalIndexCount = 0;
        let maxPointCount = 0;

        this._trailData.forEach((trailData) => {
            const activeCount = this._getActivePointCount(trailData);
            if (activeCount >= 2) {
                totalVertexCount += activeCount * 2;
                totalIndexCount += (activeCount - 1) * 6;
                if (activeCount > maxPointCount) {
                    maxPointCount = activeCount;
                }
            }
        });

        if (totalVertexCount === 0) {
            this._meshVertexCount = 0;
            this._meshIndexCount = 0;
            this._meshData.vertexCount = 0;
            this._meshData.indexCount = 0;
            this._meshDirty = false;
            return this._meshData;
        }

        this._ensureMeshCapacity(totalVertexCount, totalIndexCount);
        if (maxPointCount > 0) {
            this._ensureTempCapacity(maxPointCount);
        }

        const vertices = this._meshVertices;
        const uvs = this._meshUVs;
        const uv1s = this._meshUV1s;
        const colors = this._meshColors;
        const indices = this._meshIndices;
        const normalsX = this._normalBufferX;
        const normalsY = this._normalBufferY;
        const segmentNormalX = this._segmentNormalX;
        const segmentNormalY = this._segmentNormalY;
        const lengthCache = this._lengthCache;

        let vertexOffset = 0;
        let vertexFloatOffset = 0;
        let uvFloatOffset = 0;
        let uv1FloatOffset = 0;
        let colorFloatOffset = 0;
        let indexOffset = 0;
        // 调试：检测索引是否越界（越界会导致 GPU 读取到旧 VB 数据，表现为“乱连/飞线”）
        let maxIndex = -1;

        const lifetime = this.lifetime > 0 ? this.lifetime : 0.0001;
        const inheritSize = this.inheritParticleSize;
        const sizeOverLifetime = this.sizeOverLifetime;
        const inheritColor = this.inheritParticleColor;
        const colorOverLifetime = this.colorOverLifetime;
        const colorOverTrail = this.colorOverTrail;
        const textureMode = this.textureMode;

        this._trailData.forEach((trailData, particleId) => {
            const start = trailData.startIndex || 0;
            const points = trailData.points;
            const pointCount = points.length - start;
            if (pointCount < 2) {
                if (trailData.isDead && pointCount <= 0) {
                    this._trailData.delete(particleId);
                }
                return;
            }

            // 预计算段法线和长度
            let totalLength = 0;
            lengthCache[0] = 0;
            for (let i = 0; i < pointCount - 1; i++) {
                const p0 = points[start + i].pos;
                const p1 = points[start + i + 1].pos;
                const dx = p1.x - p0.x;
                const dy = p1.y - p0.y;
                const lenSq = dx * dx + dy * dy;
                const len = Math.sqrt(lenSq);
                let nx = 0;
                let ny = 1;
                if (len > 1e-6) {
                    const invLen = 1.0 / len;
                    nx = -dy * invLen;
                    ny = dx * invLen;
                }
                segmentNormalX[i] = nx;
                segmentNormalY[i] = ny;
                totalLength += len;
                lengthCache[i + 1] = totalLength;
            }

            // 预计算点法线
            for (let i = 0; i < pointCount; i++) {
                if (i === 0) {
                    normalsX[i] = segmentNormalX[0];
                    normalsY[i] = segmentNormalY[0];
                } else if (i === pointCount - 1) {
                    const idx = pointCount - 2;
                    normalsX[i] = segmentNormalX[idx];
                    normalsY[i] = segmentNormalY[idx];
                } else {
                    const nxPrev = segmentNormalX[i - 1];
                    const nyPrev = segmentNormalY[i - 1];
                    const nxNext = segmentNormalX[i];
                    const nyNext = segmentNormalY[i];
                    let nx = nxPrev + nxNext;
                    let ny = nyPrev + nyNext;
                    const magSq = nx * nx + ny * ny;
                    if (magSq > 1e-6) {
                        const inv = 1.0 / Math.sqrt(magSq);
                        nx *= inv;
                        ny *= inv;
                    } else {
                        nx = nxPrev;
                        ny = nyPrev;
                    }
                    normalsX[i] = nx;
                    normalsY[i] = ny;
                }
            }

            const initialSize = trailData.initialSize || 0.0001;
            const baseWidth = initialSize * this.widthRatio * 0.5;

            let baseR = 255, baseG = 255, baseB = 255, baseA = 255;
            if (inheritColor) {
                const c = trailData.currentParticleColor;
                baseR = c.r; baseG = c.g; baseB = c.b; baseA = c.a;
            } else if (colorOverLifetime) {
                const lifetimeColor = colorOverLifetime.evaluate(trailData.particleLifeProgress || 0, null);
                if (lifetimeColor) {
                    baseR = lifetimeColor.r;
                    baseG = lifetimeColor.g;
                    baseB = lifetimeColor.b;
                    baseA = lifetimeColor.a;
                }
            }

            const trailVertexBase = vertexOffset;
            for (let i = 0; i < pointCount; i++) {
                const point = points[start + i];
                const nx = normalsX[i];
                const ny = normalsY[i];

                let sizeScale = 1.0;
                if (inheritSize) {
                    sizeScale = trailData.currentParticleSize / initialSize;
                } else if (sizeOverLifetime) {
                    const normalizedTime = 1.0 - Math.min(point.time / lifetime, 1.0);
                    sizeScale = sizeOverLifetime.evaluate(normalizedTime);
                }
                const finalWidth = baseWidth * sizeScale;

                const pos = point.pos;
                vertices[vertexFloatOffset + 0] = pos.x + nx * finalWidth;
                vertices[vertexFloatOffset + 1] = pos.y + ny * finalWidth;
                vertices[vertexFloatOffset + 2] = pos.x - nx * finalWidth;
                vertices[vertexFloatOffset + 3] = pos.y - ny * finalWidth;
                vertexFloatOffset += 4;

                let u = 0;
                if (textureMode === TextureMode.Stretch) {
                    // Stretch：沿“实际弧长”把 0..1 拉伸到整条拖尾上（而不是按点序号）。
                    // 否则当拖尾在运行中新增点时，旧点的 u 会因 pointCount 变化而整体重算，表现为纹理往后滑动。
                    // 这里采用“头=0，尾=1”的方向（头 = 最新点/粒子当前位置；尾 = 最老点）。
                    // 注意：points 的顺序是“尾 -> 头”，lengthCache[i] 是从尾开始的弧长累计，所以需要 1 - t 反向。
                    const t = totalLength > 1e-6 ? (lengthCache[i] / totalLength) : (pointCount > 1 ? (i / (pointCount - 1)) : 0);
                    u = 1.0 - t;
                } else if (textureMode === TextureMode.Tile) {
                    u = lengthCache[i] / 100;
                }
                uvs[uvFloatOffset + 0] = u;
                uvs[uvFloatOffset + 1] = 0;
                uvs[uvFloatOffset + 2] = u;
                uvs[uvFloatOffset + 3] = 1;
                uvFloatOffset += 4;

                // UV1 是 vec4，且每个 point 会生成 2 个顶点，所以这里必须为两个顶点都写入 UV1。
                // 如果只写一份，另一个顶点会读到上一帧/上一轮播放残留的 uv1，表现为后半段“乱连/抖动”。
                const uv1Value = pointCount > 1 ? i / (pointCount - 1) : 0;
                // 顶点 A（+normal）
                uv1s[uv1FloatOffset + 0] = uv1Value;
                uv1s[uv1FloatOffset + 1] = 0;
                uv1s[uv1FloatOffset + 2] = 0;
                uv1s[uv1FloatOffset + 3] = 0;
                // 顶点 B（-normal）
                uv1s[uv1FloatOffset + 4] = uv1Value;
                uv1s[uv1FloatOffset + 5] = 0;
                uv1s[uv1FloatOffset + 6] = 0;
                uv1s[uv1FloatOffset + 7] = 0;
                uv1FloatOffset += 8;

                let finalR = baseR;
                let finalG = baseG;
                let finalB = baseB;
                let finalA = baseA;
                if (colorOverTrail) {
                    const trailPos = i / (pointCount - 1);
                    const trailColor = colorOverTrail.evaluate(trailPos, null);
                    if (trailColor) {
                        finalR = finalR * trailColor.r / 255;
                        finalG = finalG * trailColor.g / 255;
                        finalB = finalB * trailColor.b / 255;
                        finalA = finalA * trailColor.a / 255;
                    }
                }
                colors[colorFloatOffset + 0] = finalR;
                colors[colorFloatOffset + 1] = finalG;
                colors[colorFloatOffset + 2] = finalB;
                colors[colorFloatOffset + 3] = finalA;
                colors[colorFloatOffset + 4] = finalR;
                colors[colorFloatOffset + 5] = finalG;
                colors[colorFloatOffset + 6] = finalB;
                colors[colorFloatOffset + 7] = finalA;
                colorFloatOffset += 8;
            }

            for (let i = 0; i < pointCount - 1; i++) {
                const idx0 = trailVertexBase + i * 2;
                const i0 = idx0;
                const i1 = idx0 + 1;
                const i2 = idx0 + 2;
                const i3 = idx0 + 3;
                indices[indexOffset++] = i0;
                indices[indexOffset++] = i1;
                indices[indexOffset++] = i2;
                indices[indexOffset++] = i1;
                indices[indexOffset++] = i3;
                indices[indexOffset++] = i2;
                if (i3 > maxIndex) maxIndex = i3;
            }

            vertexOffset += pointCount * 2;

            if (trailData.isDead) {
                const remaining = this._getActivePointCount(trailData);
                if (remaining <= 1) {
                    // 注意：points[0..startIndex-1] 可能已在 updateTrail 的“过期点回收”流程里被回收过；
                    // 这里再次回收会导致同一个 point 多次进入 pool，进而在下一轮被分配给多个 trail，引发“互相连线/乱连”。
                    const s = trailData.startIndex || 0;
                    for (let i = s; i < points.length; i++) {
                        this._recyclePoint(points[i]);
                    }
                    this._trailData.delete(particleId);
                }
            }
        });

        this._meshVertexCount = vertexOffset;
        this._meshIndexCount = indexOffset;
        this._meshData.vertexCount = this._meshVertexCount;
        this._meshData.indexCount = this._meshIndexCount;
        this._meshDirty = false;

        return this._meshData;
    },

    /**
     * !#en Calculate total length of trail
     * !#zh 计算拖尾的总长度
     * @private
     */
    _calculateTotalLength(points) {
        let length = 0;
        for (let i = 0; i < points.length - 1; i++) {
            length += points[i + 1].pos.sub(points[i].pos).mag();
        }
        return length;
    },

    /**
     * !#en Calculate length to a specific point
     * !#zh 计算到指定点的长度
     * @private
     */
    _calculateLengthToPoint(points, index) {
        let length = 0;
        for (let i = 0; i < index; i++) {
            length += points[i + 1].pos.sub(points[i].pos).mag();
        }
        return length;
    },

    /**
     * !#en Clear all trails
     * !#zh 清除所有拖尾
     */
    clear() {
        // 安全检查：_trailData 可能在 ctor 之前被访问（属性 notify 回调）
        if (!this._trailData) return;
        // 回收所有点到对象池
        this._trailData.forEach((trailData) => {
            // 注意：points[0..startIndex-1] 可能已在 updateTrail 的“过期点回收”里被回收过；
            // clear 时再次回收会把同一个对象重复放入 pool，导致后续不同 trail 共享同一个 point 实例。
            const start = trailData.startIndex || 0;
            for (let i = start; i < trailData.points.length; i++) {
                this._recyclePoint(trailData.points[i]);
            }
            trailData.points.length = 0;
            trailData.startIndex = 0;
        });
        this._trailData.clear();
        this._meshVertexCount = 0;
        this._meshIndexCount = 0;
        this._meshData.vertexCount = 0;
        this._meshData.indexCount = 0;
        this._meshDirty = true;
        // 关键：clear 发生在播放中时，历史 VB/IB 复用可能导致下一轮出现“乱连”。
        // 这里直接销毁并置空 Assembler/Buffer，强制下一次播放重建，避免残留状态影响新一轮几何。
        if (this._trailAssembler) {
            if (this._trailAssembler._ia) {
            this._trailAssembler._ia._count = 0;
            }
            if (this._trailAssembler._buffer && this._trailAssembler._buffer.destroy) {
                this._trailAssembler._buffer.destroy();
            }
            this._trailAssembler._buffer = null;
            this._trailAssembler._ia = null;
            this._trailAssembler = null;
        }
    },

    /**
     * !#en Get statistics about the trail module
     * !#zh 获取拖尾模块的统计信息
     * @return {Object} statistics {activeTrails, totalPoints, pooledPoints}
     */
    getStats() {
        let totalPoints = 0;
        this._trailData.forEach((trailData) => {
            totalPoints += this._getActivePointCount(trailData);
        });

        return {
            activeTrails: this._trailData.size,      // 活跃的拖尾数量
            totalPoints: totalPoints,                 // 所有拖尾的点总数
            pooledPoints: this._pointPool.length     // 对象池中的点数量
        };
    }
});

// 导出并注册到全局命名空间
cc.particle = cc.particle || {};
cc.particle.TrailModule = TrailModule;
cc.particle.TrailMode = TrailMode;
cc.particle.TextureMode = TextureMode;

module.exports = TrailModule;
module.exports.TrailMode = TrailMode;
module.exports.TextureMode = TextureMode;

