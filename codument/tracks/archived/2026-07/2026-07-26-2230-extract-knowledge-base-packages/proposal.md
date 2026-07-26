# 变更：提取 .NET 知识库扩展包

## 背景和动机 (Context And Why)

代码知识抽取和 DEPA 一致性扫描不属于 ontology core。它们需要独立版本、独立安装，但共享已发布的 ontology 契约。

## "要做"和"不做" (Goals / Non-Goals)

**目标:**

- 提供 `Depa.KnowledgeBase.CodeKnowledge` 与 `Depa.KnowledgeBase.Depa`。
- 依赖 `Depa.Ontology` 及所需公开低层类型。
- 建立可构建、可打包的多项目 solution。

**非目标:**

- 不将 native binding 或 ontology core 代码复制到知识库仓库。
- 不执行 NuGet 发布。

## 变更内容（What Changes）

- 从 `Om.CodeKnowledge` 和 `Om.Depa` 迁移源文件与命名空间。
- 将跨包共享的 effect API 规则提升为公开契约。

## 测试与资源迁移记录

原单体的完整 OM、CodeKnowledge 和 DEPA 集成回归已放入 `tests/Depa.KnowledgeBase.IntegrationTests`，以拆分后的 source project graph 运行。`rubrics/` 中的八份来源规则文档同时进入 `Depa.KnowledgeBase.Depa` 的 `contentFiles`，使包消费者可获得与扫描规则对应的审计资料。

## 影响范围（Impact）

- 受影响的能力（behaviors）：depa-knowledge-base
- 受影响的代码：src、Depa.KnowledgeBase.slnx
