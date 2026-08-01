# Design: FS-native ontology manifest authority

## 上下文

历史 Cozo ontology skill 的 latest grammar 是 `Ontology/Resources`。上游 mission
后来把 desired state 修订为 FS-native manifest，并直接在本 workspace 形成了目标
实现。这个 track 不假装从零实现，而是把当前 diff 纳入规范、任务、fresh review、
验证和 archive 的完整 ownership lifecycle。

## 方案概览

1. Generic resource system 与 ontology domain 分层
   - `system/` 只拥有 source shape、catalog、KindDefinition、identity、containment、registry 和 diagnostics。
   - `ontology-domain/` 通过 KindDefinitions 定义 ontology 业务 grammar 和语义约束。
2. 单一 assembly authority
   - `Ontology` 是 manifest Kind，入口由 KindDefinition 固定为精确 PascalCase `Manifest.xml`；大小写不同的别名被拒绝。
   - catalog 只做 first-level discovery，并服从目标 KindDefinition 的 source shape。
   - `Resources`、`Modules`、per-resource `href` 和兼容翻译全部拒绝。
3. 分层 ontology semantics
   - lower kernel 拥有 Type/Mixin/Property/Relation/Rule/StateMachine。
   - BusinessObject 是 upper object-type manifest，直接拥有 object properties 与本地 behavior resources，不创建 shadow Type。
   - Operation、Evidence、RuntimeBinding、mapping、evolution 使用显式 catalog/manifest resources。
4. Runtime projection boundary
   - depa-ontology.ts package 是 Bun OM capability authority。
   - import 先验证 XML，再映射 schema/behavior APIs。
   - export 只从 schema snapshot/behavior manifest 加显式 policy 生成 XML，不从 rows 发明 profile-only facts。

## 影响范围与修改点（Impact）

- `skills/ontology-exchange-xml-standard/SKILL.md`
- `skills/ontology-exchange-xml-standard/agents/openai.yaml`
- `skills/ontology-exchange-xml-standard/system/**`
- `skills/ontology-exchange-xml-standard/ontology-domain/**`
- `skills/ontology-exchange-xml-standard/scripts/**`
- `skills/ontology-exchange-xml-standard/tests/**`
- `codument/behaviors/ontology-exchange-xml-standard.xml`
- `codument/modeling/domain/resource_framework/index.xnl`

## 决策摘要

- 详见 `decisions.xnl`。
- 当前关键结论：本 workspace 是 latest ontology XML definition authority；旧 Cozo Resources grammar 仅是历史证据。

## 风险 / 权衡

- 既有 diff 规模大，retrospective ownership 容易漏项 -> fresh leaf review + coding/docs attractor + independent verify。
- behavior/modeling registry 已先于 track 出现在 working tree -> delta 写完整目标态，归档前检查 identical/add-add merge。
- 旧 consumer 可能仍生成 Resources -> 保持明确迁移诊断，不引入兼容执行分支。

## 兼容性设计

这是定义 grammar 的破坏性迁移。旧 Resources/Modules/href 输入必须得到稳定诊断；
迁移是资源树重排与 identity/catalog 显式化，不是 validator 内部自动翻译。

## 迁移计划

1. 盘点当前 diff 和历史 grammar，冻结 baseline。
2. 对 system/domain specification、validator、fixtures 和 projections 做分层 fresh review。
3. 修复发现的目标偏差，运行 validator/security/skill/modeling/behavior checks。
4. 独立验证、归档并向上游 mission 回传 archive evidence。

## 待解决问题

- 无需用户决策；authority 已由上游 mission Revision 12 和本 workspace 现状确定。
