# 项目背景（Project Context）

> 本文件为 OpenSpec 提供项目背景，与 `config.yaml` 的 `context` 配合，在生成 proposal / spec / tasks 时注入给 AI。

## 一句话简介

CocosCreator 2.4.15 的高性能 2D 渲染实验项目，聚焦自定义 GLRender、GPUInstance 实例化渲染，以及高性能飘字（伤害数字）系统。

## 技术栈

- **引擎**：CocosCreator V2.4.15（cocos2d-html5）
- **语言**：TypeScript（target `es5`、`commonjs`、`experimentalDecorators`）
- **运行环境**：Node.js；目标平台含 Web 与移动端
- **资源目录**：`assets/`（Effect、Material、Scene、Script、Texture）

## 目录结构

| 路径 | 说明 |
|------|------|
| `assets/Script/` | 游戏与渲染逻辑（TS） |
| `assets/Effect/` `assets/Material/` | 自定义 shader 与材质 |
| `assets/Scene/` | 场景 |
| `assets/Texture/` | 贴图资源 |
| `doc/` | 文档 |
| `openspec/` | 规范驱动开发（本工具） |

## 当前重点

- **GLRender**：自定义底层渲染封装
- **GPUInstance**：GPU 实例化渲染，与普通 GLRender 做性能对比
- **高性能飘字**：伤害数字 / 飘字系统的批处理与性能优化

## 约定

- **提交规范**：conventional commits（`feat` / `fix` / `docs` / `refactor` / `perf` ...）
- **输出语言**：所有 artifact 内容使用简体中文
- **性能优先**：优先考虑 drawcall 合并、批处理、GC 友好；改动需兼顾移动端性能
- **渲染改动**：需说明对 drawcall / 内存的预期影响，并给出可量化指标（帧率、drawcall 数）

## 非目标（Non-goals）

- 不做 3D 渲染相关能力
- 暂不引入额外的第三方渲染框架，优先在引擎原生能力上扩展
