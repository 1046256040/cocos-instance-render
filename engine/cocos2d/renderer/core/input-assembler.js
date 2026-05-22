// Copyright (c) 2017-2018 Xiamen Yaji Software Co., Ltd.

import gfx from '../gfx';

export default class InputAssembler {
  constructor(vb, ib, pt = gfx.PT_TRIANGLES) {
    this._vertexBuffer = null;
    this._indexBuffer = null;
    this._primitiveType = pt;
    this._start = 0;
    this._count = -1;
    this._vertexBuffers = [];
    this._vertexBufferOffsets = [];
    this._vertexBufferDivisors = [];
    this._instanceCount = 0;

    if (vb) {
      this.setVertexBuffer(0, vb);
    }
    if (ib) {
      this.setIndexBuffer(ib);
    }
  }

  setVertexBuffer(stream, buffer, start = 0, divisor = 0) {
    this._vertexBuffers[stream] = buffer;
    this._vertexBufferOffsets[stream] = start;
    this._vertexBufferDivisors[stream] = divisor;

    if (stream === 0) {
      this._vertexBuffer = buffer;
    }
  }

  setIndexBuffer(buffer) {
    this._indexBuffer = buffer;
  }

  setPrimitiveType(type) {
    this._primitiveType = type;
  }

  setInstanceCount(count) {
    this._instanceCount = count > 0 ? count : 0;
  }

  /**
   * @property {Number} count The number of indices or vertices to dispatch in the draw call.
   */
  get count() {
    if (this._count !== -1) {
      return this._count;
    }

    if (this._indexBuffer) {
      return this._indexBuffer.count;
    }

    if (this._vertexBuffer) {
      return this._vertexBuffer.count;
    }

    return 0;
  }
}
