# 变更：收口 FS-native ontology manifest authority

## 背景和动机 (Context And Why)

当前 workspace 已存在一套大规模未提交的 ontology-exchange-xml-standard 重构：它把旧
`Ontology/Resources` 文件装配迁移为 FS-native manifest、ResourceCatalog
和 KindDefinition 体系，并把 depa-ontology.ts 固定为 Bun OM capability 真源。
这些变化已有 validator tests 和 modeling/behavior 草案，但没有真实 Codument
track 承担，因此上游 mission 无法用 archive evidence 证明当前 authority。

## "要做"和"不做" (Goals / Non-Goals)

**目标:**
- 由一个真实 track 接管、审计和验证当前 FS-native ontology-exchange-xml-standard diff。
- 固定 generic FS-native resource system 与 ontology-domain Kind package 的边界。
- 以 KindDefinition 声明的精确 manifest entry 为唯一 latest assembly；当前 `Ontology` 使用 `Manifest.xml`，并拒绝小写别名、`Resources`、`Modules`、`href` 和双 dialect。
- 保留 lower kernel、BusinessObject-local behavior、五维 Operation、完整 request preset、治理与安全契约。
- 固定 depa-ontology.ts 的 Bun OM import/export authority 和 no-fabrication export policy。
- 让 behavior、modeling、validator、examples、skill metadata 与 archived evidence 自洽。

**非目标:**
- 不修改 depa-ontology.ts runtime API。
- 不恢复旧 Resources/Modules compatibility branch。
- 不执行任意 ontology XML 或把它接入 depa-orm workbench runtime。
- 不提交、暂存或改写与当前 ontology-exchange-xml-standard diff 无关的 workspace 改动。

## 变更内容（What Changes）

- **BREAKING**：删除旧 `assets/examples`、根级 `foundation/spec/std` Resources grammar。
- 新增 generic `system/` 四层 FS-native resource specification。
- 新增 `ontology-domain/` 四层 Kind package、28 个 KindDefinitions、MakerSpace fixtures。
- 重写 validator 为 manifest/catalog discovery + kind/domain semantic pipeline。
- 新增 legacy assembly、shape、ownership、preset 和 XML/VFS security rejection tests。
- 更新 skill/agent metadata、behavior 与 modeling authority。

## 影响范围（Impact）

- 受影响的能力（behaviors）：`ontology-exchange-xml-standard`
- 受影响的代码：`skills/ontology-exchange-xml-standard/**`
- 受影响的长期知识：`codument/behaviors/ontology-exchange-xml-standard.xml`、`codument/modeling/domain/resource_framework/index.xnl`
