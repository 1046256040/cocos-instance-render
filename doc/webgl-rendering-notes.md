# WebGL Rendering Notes

本文整理当前项目里关于 WebGL 渲染、GLRender 与 GPU Instance 两种实现方式、VBO/VAO、以及实例化渲染底层传递链路的讨论结论，方便后续查阅。

## 1. WebGL 渲染原理总览

先脱离项目实现，单看 WebGL 渲染本身，可以把一次绘制理解成下面这条链：

1. CPU 准备数据
2. CPU 把数据放进 GPU buffer
3. CPU 发起 draw call
4. GPU 顶点着色器处理顶点
5. GPU 光栅化三角形
6. GPU 片元着色器处理像素
7. 输出到 framebuffer

如果把它压缩成一句话，就是：

`CPU 负责组织数据和发命令，GPU 负责并行计算顶点和像素。`

### 1.1 CPU 在做什么

CPU 侧通常负责：

- 组织场景数据
- 生成顶点数据或实例数据
- 创建/更新 VBO、IBO、纹理
- 设置 shader、uniform、texture
- 发起 draw call

在当前项目里：

- `GLRender` 路径里 CPU 还要负责“算最终顶点位置”
- `GPU Instance` 路径里 CPU 更多是在准备“实例参数”

### 1.2 GPU 在做什么

GPU 在 draw call 发出后，主要经历两个大的可编程阶段：

- 顶点着色器（Vertex Shader）
- 片元着色器（Fragment Shader）

中间夹着固定流水线阶段，例如：

- primitive assembly
- clipping
- rasterization

### 1.3 顶点着色器的职责

顶点着色器的输入是：

- 每个顶点对应的 attribute
- uniform
- 纹理通常不是在顶点阶段采样，但也可以参与某些算法

它最常做的事情是：

- 模型空间 -> 世界空间 -> 裁剪空间变换
- 计算 UV / 颜色 / 法线等传给片元阶段的插值结果

最重要的一点：

`顶点着色器是“按顶点执行”的。`

如果有 1200000 个顶点，就会执行大约 1200000 次顶点着色器。

### 1.4 片元着色器的职责

片元着色器不是按“对象”执行，而是按“最终覆盖到屏幕上的像素片元”执行。

它通常做：

- 纹理采样
- 颜色混合
- alpha test / alpha blend
- 光照、特效、后处理中的部分计算

如果屏幕覆盖很多、透明重叠很多，那么即使顶点数量不夸张，片元阶段也可能成为瓶颈。

### 1.5 draw call 到底是什么

一次 draw call 可以简单理解成：

`告诉 GPU：用当前绑定好的 shader、buffer、texture、状态，去画一批图元。`

一个 draw call 通常隐含依赖这些状态：

- program / shader
- vertex buffers
- index buffer
- uniforms
- textures
- blend / depth / cull 状态

为什么 draw call 重要：

- 每次 draw call 都有 CPU 调度成本
- 状态切换越多，CPU 越忙
- 所以大量小 draw call 往往不划算

但也要注意：

`draw call 少不一定代表一定快。`

因为真正的瓶颈也可能在：

- CPU 生成顶点
- 实例数据上传
- 顶点着色器吞吐
- 像素填充率

### 1.6 attribute、uniform、varying 分别是什么

这三个概念最好分开记。

#### attribute

attribute 是“每个顶点（或每个实例）不同的数据”。

例如：

- 位置
- UV
- 顶点颜色
- 实例变换参数

它们通常来自 vertex buffer。

#### uniform

uniform 是“这次 draw call 内部共享的数据”。

例如：

- 变换矩阵
- 某个材质参数
- 某张贴图绑定到哪个采样器

uniform 在一次 draw call 中不会按顶点变化。

#### varying

varying 是顶点着色器输出、片元着色器输入的数据。

典型例子：

- 顶点 shader 输出 UV
- 光栅化阶段对三角形内部做插值
- 片元 shader 接收到插值后的 UV

所以：

- attribute：来自 buffer
- uniform：来自 CPU 设置的全局参数
- varying：顶点阶段传给片元阶段的插值结果

### 1.7 为什么“模板 + 实例参数”能减少 CPU 压力

如果不用 instancing，CPU 往往要：

- 为每个对象生成完整顶点
- 每个对象 4 个点就要写 4 份位置和 4 份 UV

如果用 instancing：

- 模板顶点只保留 1 份
- CPU 只提供每个实例的参数
- GPU 在顶点 shader 中自行生成最终顶点位置

所以 instancing 省下来的不是“GPU 不算顶点”，而是：

`CPU 不再重复生成大量结构相同、只是在变换参数上不同的顶点数据。`

### 1.8 为什么 GPU Instance 不是没有成本

instancing 只是换了一种成本分布。

它仍然有这些开销：

- 实例数据上传
- 顶点 shader 每顶点执行
- atlas 采样
- 透明混合
- overdraw

也就是说，instancing 的本质不是“没有代价”，而是：

`把 CPU 的重复顶点展开，换成 GPU 的批量顶点变换。`

### 1.9 为什么项目源码里没有显式 VAO，仍然能完成 attribute 绑定

在原生 OpenGL/WebGL 教程里，经常会看到：

- `gl.bindBuffer`
- `gl.vertexAttribPointer`
- `gl.enableVertexAttribArray`
- `gl.vertexAttribDivisor`
- `gl.bindVertexArray`

这些 API 显式地把“数据”和“读取规则”绑起来。

而在当前项目里，这些步骤被封装到了引擎层：

- `VertexFormat`
- `VertexBuffer`
- `InputAssembler`
- `device.setVertexBuffer`

从职责上说，它们共同承担了类似 VAO 的功能：

- 记录当前有哪些 vertex buffer
- 每个 buffer 的 stride / offset / type
- 每个 stream 的 divisor
- shader 需要的 attribute 名字

所以可以把项目里的机制理解为：

`没有直接暴露 VAO API，但保留了 VAO 的核心思想：把“数据”和“读取方式”一起组织起来。`

### 1.10 为什么名字匹配是合理的

项目底层不是靠“第几个 attribute 对第几个 buffer”来绑定，而是靠名字匹配：

- shader 声明 `a_position`
- 某个 `VertexFormat` 里也有 `a_position`
- 那这个 buffer 就可以提供这个 attribute

这种方式的好处是：

- 代码更灵活
- 一个 shader 可以同时从多个 stream 取不同 attribute
- 基础顶点流和实例流可以自然拼接

代价是：

- 命名必须一致
- 改 shader attribute 名字时，CPU 侧 `VertexFormat` 也必须同步修改

### 1.11 为什么 Instancing 特别适合“同形不同参”的对象

instancing 最适合的对象通常满足两个条件：

1. 几何结构相同
2. 只是变换参数不同

例如：

- 食物
- 脚印 / 踩点
- 飘字字形
- 树木、草、子弹、粒子 quad

这类对象的共同点是：

- 基础形状可以复用
- 差异只在位置、旋转、缩放、颜色、UV、动画帧

这正是 instancing 的甜区，因为：

- 模板只要一份
- 差异通过实例参数表达

如果每个对象几何结构本身都不同，instancing 的收益就会下降很多。

## 2. GLRender 与 GPU Instance 的核心差异

项目里目前有两条主要渲染路径：

- `GLRender`
- `GPU Instance`

它们最大的区别不是“有没有用 GPU”，而是：

- `GLRender`：CPU 先把最终顶点算出来，再提交给 GPU
- `GPU Instance`：CPU 只提交实例参数，GPU 在顶点着色器里展开最终顶点

### 1.1 GLRender 在做什么

以 `FoodsGLNode.calRenderData()` 为例：

- 遍历所有 food
- 判断是否在屏幕内
- 读取 rect / uv / direction
- 计算旋转后的四个顶点
- 把四个顶点的位置写进 `vPositions`
- 把四个顶点的 UV 写进 `vTexCoords`
- 最后交给 `GLRender` / assembler 提交

也就是说，`GLRender` 路径里：

- 每个 food 最终会展开成 4 个顶点
- 顶点的最终位置在 CPU/JS 里就已经算好了

### 1.2 GPU Instance 在做什么

`GpuInstanceTest` 里走的是 instancing 路径：

- 基础 mesh 只保留 1 个单位 quad
- 每个实例只上传一份参数
- 顶点着色器根据实例参数计算最终顶点

实例参数通常包括：

- 位置
- 尺寸
- 颜色
- atlas UV
- 旋转

所以 GPU Instance 的本质是：

- CPU 只提供“模板 + 参数”
- GPU 负责把模板批量变形成最终顶点

## 3. 为什么 300000 个对象时两者帧率差这么大

实测中：

- `GLRender` 约 12 FPS
- `GPU Instance` 约 59 FPS

差距最大的原因通常是：

`GLRender 把大量顶点生成工作放在了 CPU/JS 上，而 GPU Instance 把这部分工作转移到了 GPU 顶点着色器。`

### 2.1 GLRender 的主要成本

假设有 300000 个 food：

- 每个 food 展开成 4 个顶点
- 总计约 1200000 个顶点

CPU 每帧要做的事包括：

- 遍历对象
- 屏幕裁剪判断
- 旋转计算
- 写顶点位置
- 写 UV

这些操作都发生在 JS 主线程里，所以很容易成为瓶颈。

### 2.2 GPU Instance 的主要成本

GPU Instance 也不是零成本，它只是把瓶颈换了位置。它的主要成本通常在：

- 实例数据上传
- GPU 顶点着色器吞吐
- 纹理采样
- 透明混合 / overdraw

但在当前项目这个场景下，CPU 拼顶点的成本明显高于实例化上传成本，所以 GPU Instance 明显更快。

## 4. VBO 和 VAO 分别做什么

### 3.1 VBO

`VBO` 全称是 `Vertex Buffer Object`。

作用：

- 存顶点数据
- 或者存实例数据

在当前项目语境里：

- 基础 quad mesh 的顶点数据相当于一个 VBO
- `InstanceBatchRenderer` 创建的实例 buffer 也相当于一个 VBO

### 3.2 VAO

`VAO` 全称是 `Vertex Array Object`。

作用：

- 记录如何解释 VBO 中的数据
- 记录 attribute 与 buffer 之间的绑定关系

它记录的通常是：

- 哪个 attribute 从哪个 buffer 取
- stride
- offset
- type
- normalize
- divisor

当前项目里虽然没有显式写 `glBindVertexArray()`，但底层引擎帮我们完成了同类职责：

- `attributes`
- `setVertexStream`
- `divisor`
- shader attribute 名字匹配

这些合起来承担了 VAO 管理的工作。

## 5. GPU Instance 中 `divisor = 1` 的意义

### 4.1 普通顶点属性

普通 attribute 默认是按顶点推进：

- 顶点 0 读第 0 份数据
- 顶点 1 读第 1 份数据
- 顶点 2 读第 2 份数据

### 4.2 实例属性

当 `divisor = 1` 时，attribute 变成按实例推进：

- 一个实例里的 4 个顶点共享同一份实例数据
- 切到下一个实例时，才读取下一份实例数据

这也是为什么：

- 一个基础 quad
- 加上一大批实例参数

就能绘制出成千上万个对象。

## 6. 当前项目里 stream 的对应关系

以 `GpuInstanceTest` 为例，可以把数据源理解成两个 stream。

### 5.1 Stream 0：基础 quad

基础 mesh 里有：

- `a_position`
- `a_uv0`

它描述的是“一个单位矩形长什么样”。

### 5.2 Stream 1：实例 buffer

实例 buffer 里有：

- `a_instanced_transform`
- `a_instanced_color`
- `a_instanced_uv_top`
- `a_instanced_uv_bottom`
- `a_instanced_misc`

它描述的是“这个实例应该放哪里、如何旋转、采 atlas 的哪一块”。

## 7. `InstanceBatchRenderer` 中的 `_instanceFormat` 是怎么传到底层的

`_instanceFormat` 不是作为单独参数一路往下传的，而是：

`作为 VertexBuffer 的元数据跟着 VertexBuffer 一起传到底层。`

链路如下。

### 6.1 在 `InstanceBatchRenderer` 中构造格式

文件：

- [assets/Script/Core/GpuInstance/InstanceBatchRenderer.ts](/Users/cc/NewProject/assets/Script/Core/GpuInstance/InstanceBatchRenderer.ts:39)

```ts
this._instanceFormat = new this._gfx.VertexFormat(options.attributes || []);
```

这里把实例属性列表整理成一份 `VertexFormat`。

### 6.2 用 `_instanceFormat` 创建 `VertexBuffer`

同文件：

```ts
this._vertexBuffer = new this._gfx.VertexBuffer(
    cc.renderer.device,
    this._instanceFormat,
    this._gfx.USAGE_DYNAMIC,
    this._data
);
```

到这里为止：

- `_data` 是实例数据内容
- `_instanceFormat` 是实例数据结构说明
- `_vertexBuffer` 是两者的打包体

### 6.3 `VertexBuffer` 自己保存 format

文件：

- [engine/cocos2d/renderer/gfx/vertex-buffer.js](/Users/cc/NewProject/engine/cocos2d/renderer/gfx/vertex-buffer.js:11)

```js
this._format = format;
```

所以 format 已经和 buffer 绑定在一起了。

### 6.4 `setVertexStream()` 把这个 buffer 挂到 InputAssembler

文件：

- [assets/Script/Core/GpuInstance/InstanceBatchRenderer.ts](/Users/cc/NewProject/assets/Script/Core/GpuInstance/InstanceBatchRenderer.ts:67)

```ts
this._renderer.setVertexStream(this._stream, this._vertexBuffer, 0, 1);
```

再往下到：

- [engine/cocos2d/core/mesh/CCMeshRenderer.js](/Users/cc/NewProject/engine/cocos2d/core/mesh/CCMeshRenderer.js:275)
- [engine/cocos2d/renderer/core/input-assembler.js](/Users/cc/NewProject/engine/cocos2d/renderer/core/input-assembler.js:22)

最终是把：

- 哪个 stream
- 对应哪个 buffer
- offset
- divisor

存到了 `InputAssembler`。

### 6.5 draw 前 device 真正消费 format

文件：

- [engine/cocos2d/renderer/core/base-renderer.js](/Users/cc/NewProject/engine/cocos2d/renderer/core/base-renderer.js:343)
- [engine/cocos2d/renderer/gfx/device.js](/Users/cc/NewProject/engine/cocos2d/renderer/gfx/device.js:478)

渲染时 device 会遍历所有 stream 上的 vertex buffer，并对 shader 所需的 attribute 做匹配。

最关键的一句在这里：

```js
let el = vb._format.element(attr.name);
```

含义是：

- shader 里声明了某个 attribute 名
- 当前 vertex buffer 的 format 里如果也有这个名字
- 就说明这个 attribute 应该从这个 buffer 读取

然后调用：

```js
gl.vertexAttribPointer(...)
```

再配合：

```js
divisorFunc.call(..., attr.location, vbDivisor || el.divisor || 0);
```

确定它是：

- 按顶点推进
- 还是按实例推进

## 8. Shader attribute 是怎么和 buffer 对上的

底层并不是靠“第 0 个 attribute 对第 0 个 buffer”这种位置关系，而是：

`靠 attribute 名字匹配。`

链路如下：

### 7.1 shader link 后解析 active attributes

文件：

- [engine/cocos2d/renderer/gfx/program.js](/Users/cc/NewProject/engine/cocos2d/renderer/gfx/program.js:114)

程序会把 shader 里的 active attributes 存成：

- `name`
- `location`
- `type`

例如：

- `a_position`
- `a_uv0`
- `a_instanced_transform`

### 7.2 draw 时用名字去 `vb._format` 里查

文件：

- [engine/cocos2d/renderer/gfx/device.js](/Users/cc/NewProject/engine/cocos2d/renderer/gfx/device.js:489)

```js
let el = vb._format.element(attr.name);
if (!el) {
  continue;
}
```

如果找到，就说明：

- 这个 attribute 应该从当前 stream 的 buffer 中取

如果找不到，就跳过，继续查别的 buffer。

### 7.3 最终绑定成 WebGL attribute

找到以后，就会用 format 里的：

- `num`
- `type`
- `normalize`
- `stride`
- `offset`

去执行 `gl.vertexAttribPointer()`。

所以真正的匹配规则是：

`shader attribute 名字 <-> VertexFormat 里的元素名字`

## 9. 性能对比时要注意什么

单纯比较 FPS 容易不公平，因为两条路径做的事不一定完全一样。

更合理的比较方式：

### 8.1 静态模式

两边都只初始化一次，不做每帧重建。

关注：

- `initCost`
- FPS
- Draw Calls

### 8.2 动态模式

两边都每帧重建/提交。

关注：

- `avgUpdate`
- `maxUpdate`
- FPS
- Draw Calls

### 8.3 当前项目中的 benchmark 含义

在当前改造后的 benchmark 中：

- `GLRenderTest`
  - 固定一批 food
  - 动态模式下每帧重算顶点并提交

- `GpuInstanceTest`
  - 固定一批实例源数据
  - 动态模式下每帧复制实例数据并 upload

这样对比的意义是：

`比较 CPU 拼顶点提交 vs GPU Instance 实例参数上传 这两种路径的差异。`

## 10. `FoodsGLNode` 中临时数组分配的优化

原先 `FoodsGLNode` 里用 `_buildRotatedQuad()` / `_rotatePoint()` 返回数组，会带来：

- 每个对象创建临时数组
- 额外的展开和 GC 压力

在对象数量很大、且每帧调用时，这会放大开销。

后续已经改成：

- 直接在 `calRenderData()` 里做标量旋转计算
- 直接写入 `vPositions`

这样可以减少：

- 临时数组分配
- 垃圾回收压力

更适合热点路径。

## 11. 一句话总结

当前项目里 WebGL 实例化渲染的关键思路是：

- 基础 quad 只存一次
- 每个实例只上传参数
- shader 按 attribute 名字从不同 stream 的 buffer 中取数据
- `divisor = 1` 让实例属性按实例推进
- `device.js` 用 `vb._format.element(attr.name)` 完成 shader 与底层 buffer 的匹配

这也是为什么在大批量对象场景下，GPU Instance 会显著优于 CPU 侧展开顶点的 `GLRender` 路径。
