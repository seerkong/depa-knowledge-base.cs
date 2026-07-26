# Depa Knowledge Base for .NET

本仓库将本体运行时之上的知识库扩展拆成两个 NuGet 包，不包含 native Cozo binding：

| 包 | 职责 |
| --- | --- |
| `Depa.KnowledgeBase.CodeKnowledge` | 代码知识 schema、投影、process extraction 与影响分析 |
| `Depa.KnowledgeBase.Depa` | 基于代码知识的 DEPA effect catalog、一致性扫描、违规检测与报告 |

两个包依赖已发布的 `Depa.Ontology`；后者额外显式依赖 `Depa.Cozo`，以保留
数据库错误类型的语义。发布时先发布 CodeKnowledge，再发布 Depa。

```bash
dotnet build Depa.KnowledgeBase.slnx --configuration Release
dotnet pack Depa.KnowledgeBase.slnx --configuration Release
```
