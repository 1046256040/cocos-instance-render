//@ts-ignore
const gfx = cc.gfx;

const vfmtPosUv = new gfx.VertexFormat([
    { name: gfx.ATTR_POSITION, type: gfx.ATTR_TYPE_FLOAT32, num: 2 },
    { name: gfx.ATTR_UV0, type: gfx.ATTR_TYPE_FLOAT32, num: 2 },
]);

// 单批顶点数受 16 位索引限制（≤65535）。每点 2 顶点，留余量取 16384 点/块（32768 顶点）。
const MAX_POINTS_PER_CHUNK = 16384;

/**
 * 连续三角带丝带 Assembler。
 *
 * 顶点按「每个路径点左右两顶点」顺序排列（L0,R0,L1,R1,...），相邻段共享顶点 →
 * MSAA 下无缝。索引按 strip 展开为三角形。坐标为节点本地，填充时应用世界矩阵。
 */
//@ts-ignore
export class RibbonAssembler extends cc.Assembler {
    private _vertCount = 0;                          // 顶点数 = 2 * 路径点数
    private _positions: Float32Array = new Float32Array(0); // 本地坐标 [x,y,...]
    private _uvs: Float32Array = new Float32Array(0);       // [u,v,...]

    init(comp: any) {
        super.init(comp);
    }

    setRenderData(vertCount: number, positions: Float32Array, uvs: Float32Array) {
        this._vertCount = vertCount;
        this._positions = positions;
        this._uvs = uvs;
    }

    updateRenderData(comp: any) {
    }

    fillBuffers(comp: any, renderer: any) {
        const vertCount = this._vertCount;
        if (vertCount < 4) {
            // 至少 2 个路径点（4 个顶点）。
            return;
        }

        const pointCount = vertCount >> 1; // 路径点数 N

        // 本地 → 世界（2D 仿射）。
        const matrix = comp.node._worldMatrix;
        const m = matrix.m;
        const m0 = m[0], m1 = m[1], m4 = m[4], m5 = m[5], m12 = m[12], m13 = m[13];

        const pos = this._positions;
        const uvs = this._uvs;
        const buffer = renderer.getBuffer('mesh', vfmtPosUv);

        // 2D 渲染 buffer 为 16 位索引，单批顶点数上限 65535；按点分块，
        // 块之间共享边界点（下一块从上一块末点开始）保证三角带连续。
        let chunkStart = 0;
        while (chunkStart < pointCount - 1) {
            const chunkEnd = Math.min(chunkStart + MAX_POINTS_PER_CHUNK - 1, pointCount - 1);
            const ptsInChunk = chunkEnd - chunkStart + 1;
            const vertsInChunk = ptsInChunk * 2;
            const segInChunk = ptsInChunk - 1;
            const indicesInChunk = segInChunk * 6;

            const offsetInfo = buffer.request(vertsInChunk, indicesInChunk);
            const vbuf = buffer._vData;
            const ibuf = buffer._iData;
            let offset = offsetInfo.byteOffset >> 2;
            const vertexId = offsetInfo.vertexOffset;

            // 顶点：每点 L,R 两个。
            for (let p = 0; p < ptsInChunk; p++) {
                const v = (chunkStart + p) * 2; // 该点 L 顶点在源数组中的顶点序号
                // L
                let x = pos[2 * v];
                let y = pos[2 * v + 1];
                vbuf[offset++] = m0 * x + m4 * y + m12;
                vbuf[offset++] = m1 * x + m5 * y + m13;
                vbuf[offset++] = uvs[2 * v];
                vbuf[offset++] = uvs[2 * v + 1];
                // R
                x = pos[2 * v + 2];
                y = pos[2 * v + 3];
                vbuf[offset++] = m0 * x + m4 * y + m12;
                vbuf[offset++] = m1 * x + m5 * y + m13;
                vbuf[offset++] = uvs[2 * v + 2];
                vbuf[offset++] = uvs[2 * v + 3];
            }

            // 索引：strip。
            let ioff = offsetInfo.indiceOffset;
            for (let s = 0; s < segInChunk; s++) {
                const base = vertexId + 2 * s; // L_s
                ibuf[ioff++] = base;
                ibuf[ioff++] = base + 1;
                ibuf[ioff++] = base + 2;
                ibuf[ioff++] = base + 1;
                ibuf[ioff++] = base + 3;
                ibuf[ioff++] = base + 2;
            }

            // 下一块从本块末点开始（共享边界点），保证连续。
            chunkStart = chunkEnd;
        }
    }
}
