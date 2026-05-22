/**
 * Trail Assembler
 * 用于渲染粒子拖尾的自定义 Assembler
 */

import Assembler from '../core/renderer/assembler';
const renderer = require('../core/renderer/');
const MeshBuffer = require('../core/renderer/webgl/mesh-buffer');
const vfmtPosUvUv1Color = require('../core/renderer/webgl/vertex-format').vfmtPosUvUv1Color;
import InputAssembler from '../renderer/core/input-assembler';
const MaterialVariant = require('../core/assets/material/material-variant');

const MAX_UINT16_VERTEX = 65535;

/**
 * Trail Buffer
 * 动态管理 Trail 顶点和索引数据
 */
class TrailBuffer extends MeshBuffer {
    constructor(handler, vertexFormat) {
        super(handler, vertexFormat);

        // 设置初始缓冲区大小
        this._maxVertices = 16384;     // 最大顶点数（增大以支持更多拖尾）
        this._maxIndices = 24576;      // 最大索引数 (maxVertices * 1.5)
        this._currentVertexCount = 0;
        this._currentIndexCount = 0;

        // 重新初始化缓冲区大小（避免 Invalid typed array length 错误）
        // _initVDataCount 是 Float32Array 的长度（float 的数量）
        // vertexFormat._bytes 是每个顶点的字节数，除以 4 得到 float 数量
        const floatsPerVertex = this._vertexFormat._bytes / 4;
        this._initVDataCount = this._maxVertices * floatsPerVertex;
        this._initIDataCount = this._maxIndices;
        this._reallocBuffer();
    }

    _expandIfNeeded(vertexCount, indexCount) {
        const requiredVertices = this._currentVertexCount + vertexCount;
        const requiredIndices = this._currentIndexCount + indexCount;

        if (requiredVertices > MAX_UINT16_VERTEX) {
            return false;
        }

        let expanded = false;
        while (requiredVertices > this._maxVertices && this._maxVertices < MAX_UINT16_VERTEX) {
            this._maxVertices *= 2;
            if (this._maxVertices > MAX_UINT16_VERTEX) {
                this._maxVertices = MAX_UINT16_VERTEX;
            }
            expanded = true;
        }

        while (requiredIndices > this._maxIndices) {
            this._maxIndices *= 2;
            expanded = true;
        }

        if (expanded) {
            const floatsPerVertex = this._vertexFormat._bytes / 4;
            this._initVDataCount = this._maxVertices * floatsPerVertex;
            this._initIDataCount = this._maxIndices;
            this._reallocBuffer();
        }

        return requiredVertices <= this._maxVertices && requiredIndices <= this._maxIndices;
    }

    /**
     * 重置 Buffer 状态
     */
    reset() {
        super.reset();
        this._currentVertexCount = 0;
        this._currentIndexCount = 0;
        this._dirty = true;
    }

    /**
     * 请求 Buffer 空间
     * @param {Number} vertexCount - 顶点数
     * @param {Number} indexCount - 索引数
     */
    request(vertexCount, indexCount) {
        if (!this._expandIfNeeded(vertexCount, indexCount)) {
            return false;
        }
        return true;
    }

    /**
     * 上传数据到 GPU
     */
    uploadData() {
        if (this.byteOffset === 0 || !this._dirty) {
            return;
        }

        // 上传顶点数据
        let vertexsData = new Float32Array(this._vData.buffer, 0, this.byteOffset >> 2);
        this._vb.update(0, vertexsData);

        // 上传索引数据
        if (this._currentIndexCount > 0) {
            let indicesData = new Uint16Array(this._iData.buffer, 0, this._currentIndexCount);
            this._ib.update(0, indicesData);
        }

        this._dirty = false;
    }
}

/**
 * Trail Assembler
 */
class TrailAssembler extends Assembler {
    constructor(comp) {
        super(comp);

        this._buffer = null;
        this._ia = null;
        this._vfmt = vfmtPosUvUv1Color;  // 包含 UV1 的顶点格式
    }

    /**
     * 获取 Buffer
     */
    getBuffer() {
        if (!this._buffer) {
            this._buffer = new TrailBuffer(renderer._handle, this._vfmt);

            this._ia = new InputAssembler();
            this._ia._vertexBuffer = this._buffer._vb;
            this._ia._indexBuffer = this._buffer._ib;
            this._ia._start = 0;
            this._ia._count = 0;
        }
        return this._buffer;
    }

    /**
     * 填充 Trail 数据到 Buffer
     * @param {Object} trailModule - Trail 模块
     */
    fillTrailBuffers(trailModule) {
        if (!this._ia) {
            this.getBuffer();
        }

        let buffer = this._buffer;
        buffer.reset();

        // 获取 mesh 数据
        let meshData = trailModule.buildMesh();
        if (!meshData || meshData.vertexCount === 0) {
            this._ia._count = 0;
            return;
        }

        const vertices = meshData.vertices;
        const indices = meshData.indices;
        const uvs = meshData.uvs;
        const uv1s = meshData.uv1s;
        const colors = meshData.colors;
        const vertexCount = meshData.vertexCount;
        const indexCount = meshData.indexCount;

        // 检查空间
        if (!buffer.request(vertexCount, indexCount)) {
            cc.warn('Trail buffer overflow: trail requires超过65535个顶点，建议降低TrailModule寿命或粒子数量');
            this._ia._count = 0;
            return;
        }

        // 填充顶点数据
        // floats per vertex: pos(2) + uv0(2) + uv1(4) + color(u8x4 packed into 1x u32 slot)
        // 不要写死 fv=9，避免未来 vertexFormat 变化或平台差异导致 stride 解析错乱（表现为“乱连”）。
        const fv = (buffer._vertexFormat && buffer._vertexFormat._bytes) ? (buffer._vertexFormat._bytes / 4) : 9;
        let vbuf = buffer._vData;
        let uintbuf = buffer._uintVData;
        const colorOff = fv - 1;

        for (let i = 0; i < vertexCount; i++) {
            const vIdx = i * 2;        // 位置索引 (x, y)
            const uvIdx = i * 2;       // UV0 索引
            const uv1Idx = i * 4;      // UV1 索引
            const colorIdx = i * 4;    // 颜色索引 (r, g, b, a)
            const offset = i * fv;

            // 位置
            vbuf[offset + 0] = vertices[vIdx];
            vbuf[offset + 1] = vertices[vIdx + 1];

            // UV0
            vbuf[offset + 2] = uvs[uvIdx];
            vbuf[offset + 3] = uvs[uvIdx + 1];

            // UV1
            vbuf[offset + 4] = uv1s[uv1Idx];
            vbuf[offset + 5] = uv1s[uv1Idx + 1];
            vbuf[offset + 6] = uv1s[uv1Idx + 2];
            vbuf[offset + 7] = uv1s[uv1Idx + 3];

            // 颜色 (打包成 UINT32)
            const r = Math.floor(colors[colorIdx]);
            const g = Math.floor(colors[colorIdx + 1]);
            const b = Math.floor(colors[colorIdx + 2]);
            const a = Math.floor(colors[colorIdx + 3]);
            uintbuf[offset + colorOff] = ((a << 24) >>> 0) | (b << 16) | (g << 8) | r;
        }

        // 填充索引数据
        for (let i = 0; i < indexCount; i++) {
            buffer._iData[i] = indices[i];
        }

        // 更新状态
        buffer.byteOffset = vertexCount * fv * 4;
        buffer._currentVertexCount = vertexCount;
        buffer._currentIndexCount = indexCount;

        // 上传数据
        buffer.uploadData();

        // 设置渲染数量
        this._ia._count = indexCount;
    }

    /**
     * 提交渲染
     * @param {ParticleSystem} comp - 粒子系统组件
     * @param {Renderer} renderer - 渲染器
     */
    fillBuffers(comp, renderer) {
        if (!this._ia || this._ia._count === 0) {
            return;
        }

        // 获取材质
        let material = comp._trailModule.material;
        if (material) {
            material = MaterialVariant.create(material, comp);
        } else {
            material = comp._materials[0];
        }
        if (!material) {
            return;
        }

        // 设置节点和材质
        const PositionType = cc.ParticleSystem.PositionType;
        if (comp.positionType === PositionType.RELATIVE) {
            renderer.node = comp.node.parent;
        } else {
            renderer.node = comp.node;
        }
        renderer.material = material;

        // 提交渲染
        renderer._flushIA(this._ia);
    }
}

module.exports = TrailAssembler;

