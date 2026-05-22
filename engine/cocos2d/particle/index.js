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

require('./CCParticleAsset');
require('./CCParticleSystem');
require('./CCCustomParticleSystem');
require('./CCParticleTrail');
require('./particle-simulator');
require('./custom/custom-particle-simulator');
require('./particle-system-assembler');
require('./custom/custom-particle-system-assembler');

// 注册自定义动画模块，确保序列化系统能找到它们
require('./Animate/p_animator-base');
require('./Animate/p-size-overtime');
require('./Animate/p-color-overtime');
require('./Animate/p-custom-vstream');
require('./Animate/p-rotation-overtime');
require('./Animate/p-texture-animation');
require('./Animate/p-limit-velocity-overtime');
require('./Animate/p-shape');
require('./Animate/p-trail');
