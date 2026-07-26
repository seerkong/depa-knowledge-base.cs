# 设计

`Depa.KnowledgeBase.CodeKnowledge` 保存 schema、代码图投影、process extraction 与 impact analysis。`Depa.KnowledgeBase.Depa` 依赖前者，提供 effect catalog、扫描 pipeline、违规检测与报告查询。

两个组件原先依赖同一程序集的 internal 类型。拆包后，effect API 词汇是实际跨包契约，因而提升为 public；其他跨层依赖通过 `Depa.Ontology` 和 `Depa.Cozo` 的公开 package reference 显式表达。

集成测试独立为可执行项目，以 source project reference 连接 ontology 与薄绑定，防止单体程序集意外掩盖跨包可见性或 native asset 装载问题。DEPA rubrics 属于运行时扫描解释的配套资料，随 `Depa.KnowledgeBase.Depa` 作为 `contentFiles/any/any/rubrics/` 打包。
