/****************************************************************************
 Copyright (c) 2017-2018 Chukong Technologies Inc.

 https://www.cocos.com/

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated engine source code (the "Software"), a limited,
  worldwide, royalty-free, non-assignable, revocable and  non-exclusive license
 to use Cocos Creator solely to develop games on your target platforms. You shall
  not use Cocos Creator software for developing other software or tools that's
  used for developing games. You are not granted to publish, distribute,
  sublicense, and/or sell copies of Cocos Creator.

 The software or tools in this License Agreement are licensed, not sold.
 Chukong Aipu reserves all rights not expressly granted to you.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/

import Assembler from '../../core/renderer/assembler';

const CustomParticleSystem = require('../CCCustomParticleSystem');
const renderer = require('../../core/renderer');
const QuadBuffer = require('../../core/renderer/webgl/quad-buffer');
const MeshBuffer = require('../../core/renderer/webgl/mesh-buffer');
const vfmtPosUvUv1Color = require('../../core/renderer/webgl/vertex-format').vfmtPosUvUv1Color;

import InputAssembler from '../../renderer/core/input-assembler';
const MaterialVariant = require('../../core/assets/material/material-variant');

const VertexFormat = require('../../core/renderer/webgl/vertex-format');
const gfx = require('../../renderer/gfx');

class CustomParticleAssembler extends Assembler {
    constructor(comp) {
        super(comp);

        // Quad 模式缓冲与 IA
        this._quadBuffer = null;
        this._quadIA = null;

        // Mesh 模式缓冲与 IA
        this._meshBuffer = null;
        this._meshIA = null;

        // 当前使用的缓冲与 IA
        this._buffer = null;
        this._ia = null;

        this._vfmt = vfmtPosUvUv1Color;
    }

    getBuffer() {
        const comp = this._renderComp;
        const RenderType = cc.CustomParticleSystem.RenderType;
        const useMesh = comp && comp.renderType === RenderType.MESH;

        if (useMesh) {
            if (!this._meshBuffer) {
                // Mesh 模式：使用 MeshBuffer
                this._meshBuffer = new MeshBuffer(renderer._handle, vfmtPosUvUv1Color);

                this._meshIA = new InputAssembler();
                this._meshIA._vertexBuffer = this._meshBuffer._vb;
                this._meshIA._indexBuffer = this._meshBuffer._ib;
                this._meshIA._start = 0;
                this._meshIA._count = 0;
            }
            this._buffer = this._meshBuffer;
            this._ia = this._meshIA;
        } else {
            if (!this._quadBuffer) {
                // Quad 模式：使用 QuadBuffer
                this._quadBuffer = new QuadBuffer(renderer._handle, vfmtPosUvUv1Color);

                this._quadIA = new InputAssembler();
                this._quadIA._vertexBuffer = this._quadBuffer._vb;
                this._quadIA._indexBuffer = this._quadBuffer._ib;
                this._quadIA._start = 0;
                this._quadIA._count = 0;
            }
            this._buffer = this._quadBuffer;
            this._ia = this._quadIA;
        }

        return this._buffer;
    }

    fillBuffers(comp, renderer) {
        if (!this._ia) return;

        const PositionType = cc.CustomParticleSystem.PositionType;

        // 检查是否需要先渲染 Trail（在粒子下方）
        const shouldRenderTrailFirst = comp._trailNeedsRender &&
            comp._trailAssembler &&
            comp._trailModule &&
            !comp._trailModule.renderAboveParticles; // false = 在粒子下方

        // 如果 Trail 在粒子下方，先渲染 Trail
        if (shouldRenderTrailFirst) {
            this._renderTrail(comp, renderer);
        }

        // 渲染粒子
        if (comp.positionType === PositionType.RELATIVE) {
            renderer.node = comp.node.parent;
        } else {
            renderer.node = comp.node;
        }
        renderer.material = comp._materials[0];
        renderer._flushIA(this._ia);

        // 如果 Trail 在粒子上方，后渲染 Trail
        if (comp._trailNeedsRender && comp._trailAssembler && !shouldRenderTrailFirst) {
            this._renderTrail(comp, renderer);
        }
    }

    _renderTrail(comp, renderer) {
        const PositionType = cc.CustomParticleSystem.PositionType;
        if (comp.positionType === PositionType.RELATIVE) {
            renderer.node = comp.node.parent;
        } else {
            renderer.node = comp.node;
        }

        // 使用 Trail 的材质或粒子系统的材质
        let trailMaterial = comp._trailModule.material;
        if (trailMaterial) {
            // 独立 Trail 材质：根据 TrailModule 的混合因子配置一个变体
            trailMaterial = MaterialVariant.create(trailMaterial, comp);

            const src = comp._trailModule.srcBlendFactor;
            const dst = comp._trailModule.dstBlendFactor;
            if (src != null && dst != null && trailMaterial) {
                // 使用材质的 setBlend API（内部会下发到每个 Pass）
                trailMaterial.setBlend(
                    true,
                    gfx.BLEND_FUNC_ADD,
                    src, dst,
                    gfx.BLEND_FUNC_ADD,
                    src, dst
                );
            }
        } else {
            // 未设置独立 Trail 材质时，沿用粒子系统的材质（使用粒子系统自身的混合配置）
            trailMaterial = comp._materials[0];
        }
        renderer.material = trailMaterial;

        // 提交 Trail 的 InputAssembler
        renderer._flushIA(comp._trailAssembler._ia);
    }
}

Assembler.register(CustomParticleSystem, CustomParticleAssembler);
module.exports = CustomParticleAssembler;


