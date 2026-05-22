/****************************************************************************
 Copyright (c) 2018 Xiamen Yaji Software Co., Ltd.

 https://www.cocos.com/

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated engine source code (the "Software"), a limited,
  worldwide, royalty-free, non-assignable, revocable and non-exclusive license
  to use Cocos Creator solely to develop games on your target platforms. You shall
  not use Cocos Creator software for developing other software or tools that's
  used for developing games. You are not granted to publish, distribute,
  sublicense, and/or sell copies of Cocos Creator.

 The software or tools in this License Agreement are licensed, not sold.
 Xiamen Yaji Software Co., Ltd. reserves all rights not expressly granted to you.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/

const js = require('../../core/platform/js');
const misc = require('../../core/utils/misc');
const gfx = require('../../renderer/gfx');

const ZERO_VEC2 = cc.v2(0, 0);
let _pos = cc.v2();
let _tpa = cc.v2();
let _tpb = cc.v2();
let _tpc = cc.v2();

function colorCompToByte (value) {
    value = value <= 1 ? value * 255 : value;
    if (value < 0) return 0;
    if (value > 255) return 255;
    return value | 0;
}

function packColor (r, g, b, a) {
    return ((a << 24) >>> 0) + (b << 16) + (g << 8) + r;
}

function multiplyPackedColor (particleColor, meshColor) {
    const pr = particleColor & 0xff;
    const pg = (particleColor >>> 8) & 0xff;
    const pb = (particleColor >>> 16) & 0xff;
    const pa = (particleColor >>> 24) & 0xff;

    const mr = meshColor & 0xff;
    const mg = (meshColor >>> 8) & 0xff;
    const mb = (meshColor >>> 16) & 0xff;
    const ma = (meshColor >>> 24) & 0xff;

    const r = (pr * mr / 255) | 0;
    const g = (pg * mg / 255) | 0;
    const b = (pb * mb / 255) | 0;
    const a = (pa * ma / 255) | 0;

    return packColor(r, g, b, a);
}

// 全局粒子ID计数器
let _particleIdCounter = 0;

let Particle = function () {
    this.id = _particleIdCounter++; // 唯一ID
    this.pos = cc.v2(0, 0);
    this.startPos = cc.v2(0, 0);
    this.color = cc.color(0, 0, 0, 255);
    this.deltaColor = { r: 0, g: 0, b: 0, a: 255 };
    this.preciseColor = { r: 0, g: 0, b: 0, a: 255 };
    this.startColor = cc.color(0, 0, 0, 255);
    // 尺寸相关
    this.size = 0;
    this.deltaSize = 0;
    this.baseWidth = 0;   // 2D 起始宽度
    this.baseHeight = 0;  // 2D 起始高度
    this.startRotation = 0;
    this.rotation = 0;
    this.deltaRotation = 0;
    this.timeToLive = 0;
    this.drawPos = cc.v2(0, 0);
    this.aspectRatio = 1;
    // Mode A
    this.dir = cc.v2(0, 0);
    this.radialAccel = 0;
    this.tangentialAccel = 0;
    // Mode B
    this.angle = 0;
    this.degreesPerSecond = 0;
    this.radius = 0;
    this.deltaRadius = 0;
    this.vstream = cc.v4(0, 0, 0, 0);
    this.totalLifeTime = 0;
    this._frameRandom = 0;
}

let pool = new js.Pool(function (par) {
    par.pos.set(ZERO_VEC2);
    par.startPos.set(ZERO_VEC2);
    par.startColor.set(0, 0, 0, 255);
    par.color._val = 0xFF000000;
    par.deltaColor.r = par.deltaColor.g = par.deltaColor.b = 0;
    par.deltaColor.a = 255;
    par.size = 0;
    par.deltaSize = 0;
    par.baseWidth = 0;
    par.baseHeight = 0;
    par.startRotation = 0;
    par.rotation = 0;
    par.deltaRotation = 0;
    par.timeToLive = 0;
    par.drawPos.set(ZERO_VEC2);
    par.aspectRatio = 1;
    // Mode A
    par.dir.set(ZERO_VEC2);
    par.radialAccel = 0;
    par.tangentialAccel = 0;
    // Mode B
    par.angle = 0;
    par.degreesPerSecond = 0;
    par.radius = 0;
    par.deltaRadius = 0;
    par.vstream = cc.v4(0, 0, 0, 0);
    // 这些随机缓存需要在“下一次复用粒子对象”时重新生成
    // 用 undefined 触发各模块的 lazy init（见 p-texture-animation.js / p-size-overtime.js）
    par._frameRandom = undefined;
    par._currentFrame = undefined;
    par._startFrameRandom = undefined;
    par._startFrameOffset = undefined;
    par._rotationOTRandom = undefined;
    par._rotationOTDelta = undefined;
}, 1024);
pool.get = function () {
    return this._get() || new Particle();
}

let CustomSimulator = function (system) {
    this.sys = system;
    this.particles = [];
    this.active = false;
    this.readyToPlay = true;
    this.finished = false;
    this.elapsed = 0;
    this.emitCounter = 0;
    this._uvFilled = 0;
    this._worldRotation = 0;
    this._lastFrameAnimEnabled = false; // 跟踪帧动画模块的启用状态
    this._lastCustomVStreamEnabled = false;

    // Mesh 渲染相关缓存
    this._meshCache = null;          // { mesh }
    this._meshVertexCount = 0;
    this._meshIndexCount = 0;
    this._meshPositions = null;      // [cc.Vec2, ...]
    this._meshUVs = null;            // [cc.Vec2, ...]
    this._meshColors = null;         // packed color per mesh vertex
    this._meshIndices = null;        // Uint16Array
}

CustomSimulator.prototype.stop = function () {
    this.active = false;
    this.readyToPlay = false;
    this.elapsed = this.sys.duration;
    this.emitCounter = 0;
}

CustomSimulator.prototype.reset = function () {
    this.active = true;
    this.readyToPlay = true;
    this.elapsed = 0;
    this.emitCounter = 0;
    this.finished = false;
    this._lastFrameAnimEnabled = false; // 重置帧动画状态
    let particles = this.particles;
    for (let id = 0; id < particles.length; ++id)
        pool.put(particles[id]);
    particles.length = 0;
    let assembler = this.sys._assembler;
    if (assembler && assembler._ia)
        assembler._ia._count = 0;
}

// 初始化 / 刷新 Mesh 几何缓存
CustomSimulator.prototype._ensureMeshData = function () {
    const psys = this.sys;
    const RenderType = cc.CustomParticleSystem.RenderType;

    if (!psys || psys.renderType !== RenderType.MESH) {
        return false;
    }

    const mesh = psys.mesh;
    if (!mesh) {
        return false;
    }

    // 相同 mesh 且已缓存，直接复用
    if (this._meshCache && this._meshCache.mesh === mesh &&
        this._meshVertexCount > 0 && this._meshIndexCount > 0) {
        return true;
    }

    if (!mesh.loaded) {
        cc.assetManager.postLoadNative(mesh);
        if (!mesh.loaded) {
            return false;
        }
    }

    const subDatas = mesh.subDatas;
    if (!subDatas || !subDatas.length) {
        return false;
    }

    const positions = [];
    const uvs = [];
    const colors = [];
    const indexList = [];

    for (let subDataIndex = 0; subDataIndex < subDatas.length; subDataIndex++) {
        const subData = subDatas[subDataIndex];
        if (!subData || !subData.vfm) {
            continue;
        }

        const vfm = subData.vfm;
        const posEl = vfm.element(gfx.ATTR_POSITION);
        const uvEl = vfm.element(gfx.ATTR_UV0);
        if (!posEl) {
            continue;
        }

        const vertexOffset = positions.length;
        const vertexCount = subData.vData.byteLength / vfm._bytes;
        if (!vertexCount || vertexCount <= 0) {
            continue;
        }

        const positionsRaw = mesh._getAttrMeshData(subDataIndex, gfx.ATTR_POSITION) || [];
        const uvsRaw = uvEl ? (mesh._getAttrMeshData(subDataIndex, gfx.ATTR_UV0) || []) : [];
        const colorsRaw = mesh._getAttrMeshData(subDataIndex, gfx.ATTR_COLOR0);

        for (let i = 0; i < vertexCount; i++) {
            const px = positionsRaw[i * 3 + 0] || 0;
            const py = positionsRaw[i * 3 + 1] || 0;
            positions.push(cc.v2(px, py));

            if (uvEl && uvsRaw.length >= (i + 1) * 2) {
                const ux = uvsRaw[i * 2 + 0];
                const uy = uvsRaw[i * 2 + 1];
                uvs.push(cc.v2(ux, uy));
            } else {
                uvs.push(cc.v2(0, 0));
            }

            if (colorsRaw.length >= (i + 1) * 4) {
                const ci = i * 4;
                colors.push(packColor(
                    colorCompToByte(colorsRaw[ci]),
                    colorCompToByte(colorsRaw[ci + 1]),
                    colorCompToByte(colorsRaw[ci + 2]),
                    colorCompToByte(colorsRaw[ci + 3])
                ));
            } else {
                colors.push(cc.Color.WHITE._val);
            }
        }

        if (subData.iData && subData.iData.byteLength > 0) {
            const dv = new DataView(subData.iData.buffer, subData.iData.byteOffset, subData.iData.byteLength);
            const indexCount = subData.iData.byteLength / 2;
            for (let i = 0; i < indexCount; i++) {
                indexList.push(vertexOffset + dv.getUint16(i * 2, true));
            }
        } else {
            const triCount = Math.floor(vertexCount / 3);
            for (let i = 0; i < triCount * 3; i++) {
                indexList.push(vertexOffset + i);
            }
        }
    }

    if (positions.length === 0 || indexList.length === 0) {
        return false;
    }

    const indices = new Uint16Array(indexList);

    this._meshVertexCount = positions.length;
    this._meshIndexCount = indices.length;
    this._meshPositions = positions;
    this._meshUVs = uvs;
    this._meshColors = colors;
    this._meshIndices = indices;
    this._meshCache = { mesh: mesh };

    return true;
};

CustomSimulator.prototype.emitParticle = function (pos) {
    let psys = this.sys;
    let clampf = misc.clampf;
    let particle = pool.get();
    this.particles.push(particle);

    // Init particle
    // timeToLive
    // no negative life. prevent division by 0
    particle.timeToLive = psys.life + psys.lifeVar * (Math.random() - 0.5) * 2;
    let timeToLive = particle.timeToLive = Math.max(0, particle.timeToLive);

    // 记录初始生命时间，供动画模块使用
    particle.totalLifeTime = timeToLive;

    // position
    // 如果启用了 ParticleShapeModule，使用形状模块生成位置
    if (psys._shapeModule && typeof psys._shapeModule.enable !== 'undefined' && psys._shapeModule.enable) {
        psys._shapeModule.getSpawnPosition(particle.pos);
    } else {
        particle.pos.x = psys.sourcePos.x + psys.posVar.x * (Math.random() - 0.5) * 2;
        particle.pos.y = psys.sourcePos.y + psys.posVar.y * (Math.random() - 0.5) * 2;
    }

    // Color
    let startColor = psys._startColor, startColorVar = psys._startColorVar;
    particle.color.r = clampf(startColor.r + startColorVar.r * (Math.random() - 0.5) * 2, 0, 255);
    particle.color.g = clampf(startColor.g + startColorVar.g * (Math.random() - 0.5) * 2, 0, 255);
    particle.color.b = clampf(startColor.b + startColorVar.b * (Math.random() - 0.5) * 2, 0, 255);
    particle.color.a = clampf(startColor.a + startColorVar.a * (Math.random() - 0.5) * 2, 0, 255);

    let color = particle.color;
    let preciseColor = particle.preciseColor;
    preciseColor.r = color.r;
    preciseColor.g = color.g;
    preciseColor.b = color.b;
    preciseColor.a = color.a;

    // 新版颜色由 ColorOvertimeModule 控制，默认保持初始随机颜色
    particle.deltaColor.r = particle.deltaColor.g = particle.deltaColor.b = particle.deltaColor.a = 0;
    particle.startColor.r = color.r;
    particle.startColor.g = color.g;
    particle.startColor.b = color.b;
    particle.startColor.a = color.a;

    // size - 通过 CurveRange 按发射器生命周期采样
    let emitterLifeRatio = 0;
    if (psys.duration > 0) {
        emitterLifeRatio = misc.clampf(this.elapsed / psys.duration, 0, 1);
    } else if (psys.duration === -1) {
        emitterLifeRatio = (this.elapsed % 1);
    } else {
        emitterLifeRatio = misc.clampf(this.elapsed, 0, 1);
    }
    let startS = 0;

    // 记录节点 scale，稍后在缓冲区写入阶段再叠加
    let nodeScaleX = Math.abs(psys.node.scaleX);
    let nodeScaleY = Math.abs(psys.node.scaleY);

    // 根据是否启用 2D 起始大小，初始化宽高 / 尺寸
    if (psys.use2DStartSize) {
        const startSX = Math.max(0, psys.startSizeX.evaluate(emitterLifeRatio, Math.random()));
        const startSY = Math.max(0, psys.startSizeY.evaluate(emitterLifeRatio, Math.random()));
        particle.baseWidth = startSX;
        particle.baseHeight = startSY;

        const RenderType = cc.CustomParticleSystem.RenderType;
        if (psys.renderType === RenderType.MESH) {
            // Mesh 模式下，用 2D 起始宽高的较大值作为统一缩放因子，保证不会为 0
            const scalar = Math.max(startSX, startSY);
            particle.startSizeForCurve = scalar;
            particle.size = scalar;
        } else {
            // Quad 模式仍保持原有逻辑：size 作为统一缩放因子，初始为 1，供 SizeOvertimeModule 使用
            particle.startSizeForCurve = 1;
            particle.size = 1;
        }
    } else {
        startS = Math.max(0, psys.startSize.evaluate(emitterLifeRatio, Math.random()));
        particle.size = startS;
        particle.startSizeForCurve = startS;
        particle.baseWidth = 0;
        particle.baseHeight = 0;
    }

    particle.deltaSize = 0;

    // rotation
    var startA = psys.startSpin.evaluate(emitterLifeRatio, Math.random());
    particle.rotation = startA;
    particle.startRotation = startA;
    particle.deltaRotation = 0;

    // position
    particle.startPos.x = pos.x;
    particle.startPos.y = pos.y;

    // aspect ratio - 基于粒子系统配置，节点 scale 的差异在旋转之后再应用
    //let baseAspectRatio = psys._aspectRatio || 1;
    particle.aspectRatio = 1;

    // 保存节点 scale，供拖尾和顶点写入时使用
    particle.scaleX = nodeScaleX;
    particle.scaleY = nodeScaleY;

    // direction
    // 如果启用了 ParticleShapeModule 的 Cone 模式，使用 ParticleShapeModule 的角度偏移
    // ShapeType.Cone = 2
    let angleOffset = 0;
    if (psys._shapeModule && typeof psys._shapeModule.enable !== 'undefined' &&
        psys._shapeModule.enable && psys._shapeModule.shapeType === 2) {
        // 使用 Cone 模式的角度偏移（已经是弧度）
        angleOffset = misc.degreesToRadians(psys._shapeModule.getAngleOffset());
    }
    let baseAngle = psys.angle.evaluate(emitterLifeRatio, Math.random());
    let a = misc.degreesToRadians(baseAngle + this._worldRotation) + angleOffset;

    // Mode Gravity: A
    if (psys.emitterMode === cc.CustomParticleSystem.EmitterMode.GRAVITY) {
        let s = psys.speed.evaluate(emitterLifeRatio, Math.random());

        // 如果启用了 ParticleShapeModule 的 Ring 模式，使用径向扩散方向
        // ShapeType.Ring = 0
        if (psys._shapeModule && typeof psys._shapeModule.enable !== 'undefined' &&
            psys._shapeModule.enable && psys._shapeModule.shapeType === 0) {
            // 使用粒子位置作为方向（从圆心指向出生点）
            let distance = Math.sqrt(particle.pos.x * particle.pos.x + particle.pos.y * particle.pos.y);
            if (distance > 0) {
                particle.dir.x = particle.pos.x / distance;
                particle.dir.y = particle.pos.y / distance;
                particle.dir.mulSelf(s);
            } else {
                // 如果距离为0（在圆心），使用默认角度
                particle.dir.x = Math.cos(a);
                particle.dir.y = Math.sin(a);
                particle.dir.mulSelf(s);
            }
        } else {
            // 默认方向
            particle.dir.x = Math.cos(a);
            particle.dir.y = Math.sin(a);
            particle.dir.mulSelf(s);
        }

        // radial accel
        particle.radialAccel = psys.radialAccel.evaluate(emitterLifeRatio, Math.random());
        // tangential accel
        particle.tangentialAccel = psys.tangentialAccel.evaluate(emitterLifeRatio, Math.random());
        // rotation is dir
        if (psys.rotationIsDir) {
            particle.rotation = -misc.radiansToDegrees(Math.atan2(particle.dir.y, particle.dir.x));
        }
    }
    // Mode Radius: B
    else {
        // Set the default diameter of the particle from the source position
        var startRadius = psys.startRadius + psys.startRadiusVar * (Math.random() - 0.5) * 2;
        var endRadius = psys.endRadius + psys.endRadiusVar * (Math.random() - 0.5) * 2;
        particle.radius = startRadius;
        particle.deltaRadius = (psys.endRadius === cc.CustomParticleSystem.START_RADIUS_EQUAL_TO_END_RADIUS) ? 0 : (endRadius - startRadius) / timeToLive;
        particle.angle = a;
        particle.degreesPerSecond = misc.degreesToRadians(psys.rotatePerS + psys.rotatePerSVar * (Math.random() - 0.5) * 2);
    }

    // 初始化拖尾（如果启用）
    if (psys._trailModule && psys._trailModule.enable) {
        // 重要：Trail 的坐标空间必须和 updateTrail 传入的一致，否则第一段会被拉出“乱连”的长三角形。
        // updateTrail 使用的是 newPos = particle.pos (+ startPos when not GROUPED)。
        const PositionType = cc.CustomParticleSystem.PositionType;
        let initPos = cc.v2(particle.pos.x, particle.pos.y);
        if (psys.positionType !== PositionType.GROUPED) {
            initPos.x += pos.x;
            initPos.y += pos.y;
        }
        psys._trailModule.initTrail(particle.id, initPos, particle.color, particle.size, particle.scaleX, particle.scaleY);
    }
};

// In the Free mode to get emit real rotation in the world coordinate.
function getWorldRotation(node) {
    let rotation = 0;
    let tempNode = node;
    while (tempNode) {
        rotation += tempNode.angle;
        tempNode = tempNode.parent;
    }
    return rotation;
}

CustomSimulator.prototype.updateUVs = function (force) {
    let assembler = this.sys._assembler;
    if (!assembler) return;

    let buffer = assembler.getBuffer();
    if (buffer && this.sys._renderSpriteFrame) {
        const fv = assembler._vfmt._bytes / 4;   // 每顶点 float 数

        const RenderType = cc.CustomParticleSystem.RenderType;
        const useMeshMode = this.sys.renderType === RenderType.MESH && this._meshVertexCount > 0;
        const vertsPerParticle = useMeshMode ? this._meshVertexCount : 4;
        const FLOAT_PER_PARTICLE = vertsPerParticle * fv;       // 每粒子顶点数量 * fv
        let vbuf = buffer._vData;
        let baseUV = this.sys._renderSpriteFrame.uv; // [bl.u, bl.v, br.u, br.v, tl.u, tl.v, tr.u, tr.v]
        let start = force ? 0 : this._uvFilled;
        let particleCount = this.particles.length;

        // 顶点内属性偏移（假定顺序为 pos2, uv0_2, uv1_(2或4), colorU32）
        const uv0Off = 2;     // uv0 起始偏移
        const uv1Off = 4;     // uv1 起始偏移（紧随 uv0）
        const hasUV1 = fv >= 7;  // 至少有 uv1.xy
        const hasUV1Vec4 = fv >= 9;  // uv1 为 vec4

        // 检查是否启用了帧动画模块（Mesh 模式不在此处修改 uv0）
        const textureAnimModule = this.sys._textureAnimationModule;
        const useFrameAnimation = !useMeshMode && textureAnimModule && textureAnimModule.enable;
        const customVStreamModule = this.sys._customVStreamModule;
        const useCustomVStream = customVStreamModule && customVStreamModule.enable;

        for (let i = start; i < particleCount; i++) {
            const base = i * FLOAT_PER_PARTICLE;

            const particle = this.particles[i];

            if (useCustomVStream) {
                customVStreamModule.animate(particle, null);
            }

            // 自定义数据（uv1.x/y/z/w <- index 0/1/2/3）
            const c0 = useCustomVStream ? particle.vstream.x : 0;
            const c1 = useCustomVStream ? particle.vstream.y : 0;
            const c2 = useCustomVStream ? particle.vstream.z : 0;
            const c3 = useCustomVStream ? particle.vstream.w : 0;

            if (!useMeshMode) {
                // Quad：根据帧动画写入 uv0 + uv1
                let uv = baseUV;
                if (useFrameAnimation) {
                    const frameIndex = textureAnimModule.getCurrentFrame(particle);
                    uv = textureAnimModule.getFrameUV(frameIndex, baseUV);
                }

                // 顶点 0: bl
                const o0 = base + 0 * fv;
                vbuf[o0 + uv0Off + 0] = uv[0];
                vbuf[o0 + uv0Off + 1] = uv[1];
                if (hasUV1) {
                    vbuf[o0 + uv1Off + 0] = c0;
                    vbuf[o0 + uv1Off + 1] = c1;
                    if (hasUV1Vec4) { vbuf[o0 + uv1Off + 2] = c2; vbuf[o0 + uv1Off + 3] = c3; }
                }

                // 顶点 1: br
                const o1 = base + 1 * fv;
                vbuf[o1 + uv0Off + 0] = uv[2];
                vbuf[o1 + uv0Off + 1] = uv[3];
                if (hasUV1) {
                    vbuf[o1 + uv1Off + 0] = c0;
                    vbuf[o1 + uv1Off + 1] = c1;
                    if (hasUV1Vec4) { vbuf[o1 + uv1Off + 2] = c2; vbuf[o1 + uv1Off + 3] = c3; }
                }

                // 顶点 2: tl
                const o2 = base + 2 * fv;
                vbuf[o2 + uv0Off + 0] = uv[4];
                vbuf[o2 + uv0Off + 1] = uv[5];
                if (hasUV1) {
                    vbuf[o2 + uv1Off + 0] = c0;
                    vbuf[o2 + uv1Off + 1] = c1;
                    if (hasUV1Vec4) { vbuf[o2 + uv1Off + 2] = c2; vbuf[o2 + uv1Off + 3] = c3; }
                }

                // 顶点 3: tr
                const o3 = base + 3 * fv;
                vbuf[o3 + uv0Off + 0] = uv[6];
                vbuf[o3 + uv0Off + 1] = uv[7];
                if (hasUV1) {
                    vbuf[o3 + uv1Off + 0] = c0;
                    vbuf[o3 + uv1Off + 1] = c1;
                    if (hasUV1Vec4) { vbuf[o3 + uv1Off + 2] = c2; vbuf[o3 + uv1Off + 3] = c3; }
                }
            } else {
                // Mesh：uv0 使用网格内置值，不在此处修改，仅写入 uv1 自定义数据
                for (let v = 0; v < vertsPerParticle; v++) {
                    const o = base + v * fv;
                    if (hasUV1) {
                        vbuf[o + uv1Off + 0] = c0;
                        vbuf[o + uv1Off + 1] = c1;
                        if (hasUV1Vec4) { vbuf[o + uv1Off + 2] = c2; vbuf[o + uv1Off + 3] = c3; }
                    }
                }
            }
        }
        this._uvFilled = particleCount;
    }
}

CustomSimulator.prototype.updateParticleBuffer = function (particle, pos, buffer, offset) {
    const fv = this.sys._assembler._vfmt._bytes / 4; // 每顶点 float 数
    const colorIndex = fv - 1; // color 所在槽位（最后一个 32 位槽）
    let vbuf = buffer._vData;
    let uintbuf = buffer._uintVData;

    let x = pos.x, y = pos.y;

    const RenderType = cc.CustomParticleSystem.RenderType;
    const useMeshMode = this.sys.renderType === RenderType.MESH && this._meshVertexCount > 0;

    if (useMeshMode) {
        // Mesh 模式：使用缓存的局部顶点 + 粒子大小 / 旋转 计算世界坐标
        const vertsPerParticle = this._meshVertexCount;
        const uv0Off = 2; // pos2 后面紧接 uv0

        const sizeScale = (particle.size !== undefined && particle.size !== null) ? particle.size : 1;
        const nodeScaleX = particle.scaleX || 1;
        const nodeScaleY = particle.scaleY || 1;
        const rad = -misc.degreesToRadians(particle.rotation || 0);
        const cr = Math.cos(rad);
        const sr = Math.sin(rad);

        for (let i = 0; i < vertsPerParticle; i++) {
            const lp = this._meshPositions[i];
            const lu = this._meshUVs[i];

            // 先按粒子自身大小与节点缩放缩放局部坐标
            let lx = lp.x * sizeScale * nodeScaleX;
            let ly = lp.y * sizeScale * nodeScaleY;

            // 先按粒子自身旋转
            const rx = lx * cr - ly * sr;
            const ry = lx * sr + ly * cr;

            const base = offset + i * fv;
            vbuf[base + 0] = rx + x;
            vbuf[base + 1] = ry + y;

            // uv0 使用 mesh 原始 uv
            vbuf[base + uv0Off + 0] = lu.x;
            vbuf[base + uv0Off + 1] = lu.y;

            // color
            uintbuf[base + colorIndex] = multiplyPackedColor(particle.color._val, this._meshColors[i]);
        }
        return;
    }

    // Quad 模式保持原有逻辑
    let width = 0;
    let height = 0;

    // 如果启用了 2D 起始大小，则使用独立的宽高，并由 size 作为统一缩放因子
    if (this.sys.use2DStartSize && (particle.baseWidth !== 0 || particle.baseHeight !== 0)) {
        const scale = (particle.size !== undefined && particle.size !== null) ? particle.size : 1;
        width = particle.baseWidth * scale;
        height = particle.baseHeight * scale;
    } else {
        // 兼容旧逻辑：使用单一 size 和贴图宽高比
        width = particle.size;
        height = width;
        let aspectRatio = particle.aspectRatio;
        aspectRatio > 1 ? (height = width / aspectRatio) : (width = height * aspectRatio);
    }

    let halfWidth = width / 2;
    let halfHeight = height / 2;

    // 节点 scale 在旋转结束后再应用，保证缩放轴与节点保持一致
    let nodeScaleX = particle.scaleX || 1;
    let nodeScaleY = particle.scaleY || 1;
    let needNodeScale = nodeScaleX !== 1 || nodeScaleY !== 1;

    function applyNodeScale(baseOffset) {
        if (!needNodeScale) return;
        let localX = vbuf[baseOffset + 0] - x;
        let localY = vbuf[baseOffset + 1] - y;
        vbuf[baseOffset + 0] = localX * nodeScaleX + x;
        vbuf[baseOffset + 1] = localY * nodeScaleY + y;
    }

    // 四个顶点的 base 偏移
    const o0 = offset + 0 * fv; // bl
    const o1 = offset + 1 * fv; // br
    const o2 = offset + 2 * fv; // tl
    const o3 = offset + 3 * fv; // tr

    if (particle.rotation) {
        let x1 = -halfWidth, y1 = -halfHeight;
        let x2 = halfWidth, y2 = halfHeight;
        let rad = -misc.degreesToRadians(particle.rotation);
        let cr = Math.cos(rad), sr = Math.sin(rad);

        // bl
        vbuf[o0 + 0] = x1 * cr - y1 * sr + x;
        vbuf[o0 + 1] = x1 * sr + y1 * cr + y;
        // br
        vbuf[o1 + 0] = x2 * cr - y1 * sr + x;
        vbuf[o1 + 1] = x2 * sr + y1 * cr + y;
        // tl
        vbuf[o2 + 0] = x1 * cr - y2 * sr + x;
        vbuf[o2 + 1] = x1 * sr + y2 * cr + y;
        // tr
        vbuf[o3 + 0] = x2 * cr - y2 * sr + x;
        vbuf[o3 + 1] = x2 * sr + y2 * cr + y;
    } else {
        // bl
        vbuf[o0 + 0] = x - halfWidth;
        vbuf[o0 + 1] = y - halfHeight;
        // br
        vbuf[o1 + 0] = x + halfWidth;
        vbuf[o1 + 1] = y - halfHeight;
        // tl
        vbuf[o2 + 0] = x - halfWidth;
        vbuf[o2 + 1] = y + halfHeight;
        // tr
        vbuf[o3 + 0] = x + halfWidth;
        vbuf[o3 + 1] = y + halfHeight;
    }

    applyNodeScale(o0);
    applyNodeScale(o1);
    applyNodeScale(o2);
    applyNodeScale(o3);

    // color（注意用通用下标）
    uintbuf[o0 + colorIndex] = particle.color._val;
    uintbuf[o1 + colorIndex] = particle.color._val;
    uintbuf[o2 + colorIndex] = particle.color._val;
    uintbuf[o3 + colorIndex] = particle.color._val;
};

/**
 * 对“本帧新出生”的粒子做一次 t=0 的动画模块采样。
 * 由于本模拟器把发射放在主循环（生命/交换）之后，新粒子不会在同一帧进入主循环，
 * 若不做 t=0 采样，会出现第一帧使用初始值（例如 alpha=1），第二帧才开始渐显/变化的闪烁。
 */
CustomSimulator.prototype._applyBirthModules = function (particle) {
    const psys = this.sys;
    if (psys._colorOvertimeModule && psys._colorOvertimeModule.enable) {
        psys._colorOvertimeModule.animate(particle, 0);
    }
    if (psys._sizeOvertimeModule && psys._sizeOvertimeModule.enable) {
        psys._sizeOvertimeModule.animate(particle, 0);
    }
    if (psys._rotationOvertimeModule && psys._rotationOvertimeModule.enable) {
        psys._rotationOvertimeModule.animate(particle, 0);
    }
    if (psys._limitVelocityOvertimeModule && psys._limitVelocityOvertimeModule.enable) {
        psys._limitVelocityOvertimeModule.animate(particle, 0);
    }
};

CustomSimulator.prototype.step = function (dt, opts) {
    opts = opts || null;
    const noRender = !!(opts && opts.noRender);
    const suppressStop = !!(opts && opts.suppressStop);
    dt = dt > cc.director._maxParticleDeltaTime ? cc.director._maxParticleDeltaTime : dt;
    let psys = this.sys;
    let node = psys.node;
    let particles = this.particles;
    const PositionType = cc.CustomParticleSystem.PositionType;

    // 渲染相关数据（预热 noRender 时不需要）
    let fv = 0;
    let useMeshMode = false;
    let vertsPerParticle = 4;
    let indicesPerParticle = 6;
    let FLOAT_PER_PARTICLE = 0;
    let buffer = null;
    let particleCount = particles.length;
    if (!noRender) {
        fv = this.sys._assembler._vfmt._bytes / 4;
        const RenderType = cc.CustomParticleSystem.RenderType;
        useMeshMode = this.sys.renderType === RenderType.MESH && this._ensureMeshData();
        vertsPerParticle = useMeshMode ? this._meshVertexCount : 4;
        indicesPerParticle = useMeshMode ? this._meshIndexCount : 6;
        FLOAT_PER_PARTICLE = vertsPerParticle * fv;
    }

    // Calculate pos
    node._updateWorldMatrix();
    if (psys.positionType === PositionType.FREE) {
        this._worldRotation = getWorldRotation(node);
        let m = node._worldMatrix.m;
        _pos.x = m[12];
        _pos.y = m[13];
    } else if (psys.positionType === PositionType.RELATIVE) {
        this._worldRotation = node.angle;
        _pos.x = node.x;
        _pos.y = node.y;
    } else {
        this._worldRotation = 0;
    }

    if (!noRender) {
        // Request buffer for particles
        buffer = psys._assembler.getBuffer();
        // 注意：发射会在“死亡回收”之后执行，为了保证同帧补位不闪烁（max=1/life=1/rate=1），
        // 这里直接按最大粒子数申请缓冲，最终用 _ia._count 控制实际绘制数量
        buffer.reset();
        buffer.request(psys.totalParticles * vertsPerParticle, psys.totalParticles * indicesPerParticle);
    }

    // Used to reduce memory allocation / creation within the loop
    let particleIdx = 0;
    while (particleIdx < particles.length) {
        // Reset temporary vectors
        _tpa.x = _tpa.y = _tpb.x = _tpb.y = _tpc.x = _tpc.y = 0;

        let particle = particles[particleIdx];

        // life
        particle.timeToLive -= dt;
        if (particle.timeToLive > 0) {
            // Mode A: gravity, direction, tangential accel & radial accel
            if (psys.emitterMode === cc.CustomParticleSystem.EmitterMode.GRAVITY) {
                let tmp = _tpc, radial = _tpa, tangential = _tpb;

                // radial acceleration
                if (particle.pos.x || particle.pos.y) {
                    radial.set(particle.pos);
                    radial.normalizeSelf();
                }
                tangential.set(radial);
                radial.mulSelf(particle.radialAccel);

                // tangential acceleration
                let newy = tangential.x;
                tangential.x = -tangential.y;
                tangential.y = newy;

                tangential.mulSelf(particle.tangentialAccel);

                tmp.set(radial);
                tmp.addSelf(tangential);
                tmp.addSelf(psys.gravity);
                tmp.mulSelf(dt);
                particle.dir.addSelf(tmp);

                tmp.set(particle.dir);
                tmp.mulSelf(dt);
                particle.pos.addSelf(tmp);
            }
            // Mode B: radius movement
            else {
                // Update the angle and radius of the particle.
                particle.angle += particle.degreesPerSecond * dt;
                particle.radius += particle.deltaRadius * dt;

                particle.pos.x = -Math.cos(particle.angle) * particle.radius;
                particle.pos.y = -Math.sin(particle.angle) * particle.radius;
            }

            // color：始终采用新版模块
            if (psys._colorOvertimeModule && psys._colorOvertimeModule.enable) {
                psys._colorOvertimeModule.animate(particle, dt);
            }

            // size：若未启用模块则保持初始大小
            if (psys._sizeOvertimeModule && psys._sizeOvertimeModule.enable) {
                psys._sizeOvertimeModule.animate(particle, dt);
            }

            // angle：若未启用模块则保持初始旋转
            if (psys._rotationOvertimeModule && psys._rotationOvertimeModule.enable) {
                psys._rotationOvertimeModule.animate(particle, dt);
            }

            // limit velocity
            // 如果启用了 limitVelocityOvertimeModule，限制速度
            if (psys._limitVelocityOvertimeModule && psys._limitVelocityOvertimeModule.enable) {
                psys._limitVelocityOvertimeModule.animate(particle, dt);
            }

            // update values in quad buffer
            let newPos = _tpa;
            newPos.set(particle.pos);
            if (psys.positionType !== PositionType.GROUPED) {
                newPos.addSelf(particle.startPos);
            }

            if (!noRender) {
                let offset = FLOAT_PER_PARTICLE * particleIdx;
                this.updateParticleBuffer(particle, newPos, buffer, offset);
            }

            // 更新拖尾（如果启用）
            if (psys._trailModule && psys._trailModule.enable) {
                // 计算粒子的生命周期进度 (0-1)
                let particleLifeProgress = 0;
                if (particle.totalLifeTime && particle.totalLifeTime > 0) {
                    particleLifeProgress = 1.0 - (particle.timeToLive / particle.totalLifeTime);
                }
                psys._trailModule.updateTrail(particle.id, newPos, particle.color, particle.size, particleLifeProgress, particle.scaleX, particle.scaleY, dt);
            }

            // update particle counter
            ++particleIdx;
        } else {
            // life < 0
            let deadParticle = particles[particleIdx];

            // 移除拖尾（如果启用）
            if (psys._trailModule && psys._trailModule.enable) {
                psys._trailModule.removeTrail(deadParticle.id);
            }

            if (particleIdx !== particles.length - 1) {
                particles[particleIdx] = particles[particles.length - 1];
            }
            pool.put(deadParticle);
            particles.length--;
        }
    }

    // ---- 发射放在“死亡回收/交换”之后：避免满粒子时同帧死亡导致空一帧（闪烁） ----
    // 记录更新后存活数，用于后面只补写“新发射粒子”的顶点数据
    const aliveCountAfterUpdate = particles.length;
    if (this.active && psys.emissionRate > 0) {
        var rate = 1.0 / psys.emissionRate;
        // issue #1201: prevent bursts of particles due to too high emitCounter
        // 不能在“粒子数已满”时停止累计，否则会出现补位空窗；
        // 同时不应把计时强行钳到一个 rate，否则在低帧率/卡顿时同帧死亡多个粒子会补不满，表现为“数量/透明度/位置”闪烁。
        this.emitCounter += dt;
        // 上限：最多积累到“填满整个池子”所需的时间，避免 emitCounter 无上限增长
        const maxCounter = rate * psys.totalParticles;
        if (this.emitCounter > maxCounter) this.emitCounter = maxCounter;

        while ((particles.length < psys.totalParticles) && (this.emitCounter >= rate)) {
            this.emitParticle(_pos);
            this.emitCounter -= rate;
        }

        this.elapsed += dt;
        if (!suppressStop && psys.duration !== -1 && psys.duration < this.elapsed) {
            psys.stopSystem();
        }
    }

    // 为“本帧新发射”的粒子补写一次顶点数据（不做 dt 推进），保证同帧就能渲染出来
    if (particles.length > aliveCountAfterUpdate) {
        for (let i = aliveCountAfterUpdate; i < particles.length; i++) {
            const p = particles[i];
            this._applyBirthModules(p);

            let newPos = _tpa;
            newPos.set(p.pos);
            if (psys.positionType !== PositionType.GROUPED) {
                newPos.addSelf(p.startPos);
            }
            if (!noRender) {
                let offset = FLOAT_PER_PARTICLE * i;
                this.updateParticleBuffer(p, newPos, buffer, offset);
            }
        }
    }

    if (noRender) {
        return;
    }

    // ---- UV 更新放在“生死/交换”之后，避免死亡时 swap 导致同一帧槽位复用但 UV 仍是旧粒子的值 ----
    // 同时修复：粒子数量减少后 _uvFilled 可能大于当前长度，导致下一次复用槽位时误判“无需补 UV”
    if (this._uvFilled > particles.length) {
        this._uvFilled = particles.length;
    }

    // Fill up uvs（在最终 particles 顺序确定后再写）
    const frameAnimEnabled = this.sys._textureAnimationModule && this.sys._textureAnimationModule.enable;
    const isCloseFrameAnimThisFrame = !frameAnimEnabled && this._lastFrameAnimEnabled;
    this._lastFrameAnimEnabled = frameAnimEnabled;

    const customVStreamEnabled = this.sys._customVStreamModule && this.sys._customVStreamModule.enable;
    const isCloseCustomVStreamThisFrame = !customVStreamEnabled && this._lastCustomVStreamEnabled;
    this._lastCustomVStreamEnabled = customVStreamEnabled;

    // 此时 particleCount 需要以“最终存活数”为准
    particleCount = particles.length;
    if (particleCount > this._uvFilled) {
        this.updateUVs();
    }
    else if (customVStreamEnabled || frameAnimEnabled || isCloseFrameAnimThisFrame || isCloseCustomVStreamThisFrame) {
        // 自定义顶点流或帧动画启用时，每帧都需要更新UV
        this.updateUVs(true);
    }

    // Mesh 模式下每帧更新索引缓冲（以最终粒子数为准）
    if (useMeshMode && particleCount > 0 && this._meshIndices && this._meshIndexCount > 0) {
        const iData = buffer._iData;
        const src = this._meshIndices;
        const per = this._meshIndexCount;
        const vpp = this._meshVertexCount;
        let w = 0;
        for (let i = 0; i < particleCount; i++) {
            const baseVertex = i * vpp;
            for (let j = 0; j < per; j++) {
                iData[w++] = baseVertex + src[j];
            }
        }
    }

    psys._assembler._ia._count = particles.length * indicesPerParticle;
    if (particles.length > 0) {
        buffer.uploadData();
    }
    else if (!this.active && !this.readyToPlay) {
        this.finished = true;
        psys._finishedSimulation();
    }

    // Trail 渲染由粒子系统的 lateUpdate 处理
}

module.exports = CustomSimulator;
