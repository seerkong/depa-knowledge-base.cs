# 从 cozo-lib-dotnet 迁入的历史 tracks

本目录中的下列归档 track 来自 `/Users/kongweixian/infra-dev/cozodb/cozo/codument/tracks/`。迁移发生于 2026-07-26；每条记录只保留现由本仓两个包承担的能力，并在其 `track.xml` 中标明来源。

| 迁入 track | 保留的本仓职责 | 剔除的职责 |
| --- | --- | --- |
| add-om-query-codeknowledge | CodeKnowledge schema、批量事实写入与查询 API | Om.Query/Portable Datalog runtime |
| redesign-codeknowledge-schema-v2 | `ck_edge` v2 schema、重建式迁移、图投影 | wiki 工具接线 |
| add-llm-wiki-community-detection | 社区检测 API、质量与预算 | indexer 自动重算 |
| add-llm-wiki-process-extraction | 入口点与有界执行流 API | 解析器/索引管线 |
| add-llm-wiki-trace-and-check | 调用路径与循环检测 API | agent 工具注册 |
| deepen-llm-wiki-context-impact | DeepImpact 与 SymbolContext 富化 | CallResolver 与工具层 |
| add-llm-wiki-depa-ontology | DEPA schema、effect catalog、scan 观测层 | 通用 OM 核心 |
| add-llm-wiki-depa-conformance-tools | 违规检测、物化和报告聚合 API | CLI/tool runner |
| fix-om-depa-conformance-gaps | DEPA scan 配置显式化与清理语义 | `Depa.Ontology` 的 DeleteEntity/TimeProvider |
| refine-depa-detection-precision | V-F2 纯委托豁免 | CallResolver 解析精度 |
| expand-depa-detection-rules | rubrics、8 维报告、检测规则 | 全局 skill 回写 |
| add-llm-wiki-incremental-indexing | 文件级 CodeKnowledge 事实清理契约 | Git/indexing orchestration |
| add-codeknowledge-semantic-claims | `ck_semantic_claim` 事实合同与 schema preflight | 语义候选、LLM、审核和业务本体导出 |

以下源 track 没有迁入：`add-dotnet-om-depa`（整体属于 `depa-ontology.cs`）；Tree-sitter/Roslyn/Java/Spring 解析、LLM Wiki 的 MCP/CLI/HTTP/Viz/向量检索/文档管线，以及业务本体生成 tracks。这些模块不在本仓的发布边界内。

原仓保留为原始、完整证据；本仓归档不是文件副本，而是按当前包职责裁剪后的历史记录。
