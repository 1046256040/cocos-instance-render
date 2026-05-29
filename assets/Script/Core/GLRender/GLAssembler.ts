//@ts-ignore
const gfx = cc.gfx;

const vfmtPos2Uv = new gfx.VertexFormat([
    { name: gfx.ATTR_POSITION, type: gfx.ATTR_TYPE_FLOAT32, num: 2 },
    { name: gfx.ATTR_UV0, type: gfx.ATTR_TYPE_FLOAT32, num: 2 }
]);

//@ts-ignore
export class GLAssembler extends cc.Assembler {
    private vCount: number = 0;
    private vPositions: number[] = [];
    private vTexCoords: number[] = [];

    init(comp: any) {
        super.init(comp);
    }

    setRenderData(vCount: number, vPositions: number[], vTexCoords: number[]) {
        this.vCount = vCount;
        this.vPositions = vPositions;
        this.vTexCoords = vTexCoords;
    }

    //更新渲染数据
    updateRenderData(comp) {
    }

    //填充数据 buffer
    fillBuffers(comp, renderer) {
        if (this.vCount == 0) {
            return;
        }

        const indicesCount = this.vCount * 6 / 4;

        const buffer = renderer.getBuffer('mesh', vfmtPos2Uv);
        const offsetInfo = buffer.request(this.vCount, indicesCount);

        const vbuf = buffer._vData;
        const ibuf = buffer._iData;
        const vertexOffset = offsetInfo.byteOffset >> 2;
        const vertexId = offsetInfo.vertexOffset;

        for (let i = 0, offset = vertexOffset; i < this.vCount; i++) {
            vbuf[offset++] = this.vPositions[2 * i + 0];
            vbuf[offset++] = this.vPositions[2 * i + 1];
            vbuf[offset++] = this.vTexCoords[2 * i + 0];
            vbuf[offset++] = this.vTexCoords[2 * i + 1];
        }

        for (let i = 0, offset = offsetInfo.indiceOffset, l = this.vCount / 4; i < l; i++) {
            const startIndex = vertexId + i * 4;
            ibuf[offset++] = startIndex;
            ibuf[offset++] = startIndex + 1;
            ibuf[offset++] = startIndex + 2;
            ibuf[offset++] = startIndex + 1;
            ibuf[offset++] = startIndex + 3;
            ibuf[offset++] = startIndex + 2;
        }
    }
}