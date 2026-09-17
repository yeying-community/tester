# 应用市场索引 Marketplace — 端到端测试用例

> 测试人员视角整理的**应有** E2E 用例清单,作为实现依据。
> 状态说明:✅ 已实现(链接到 spec) / ⬜ 待实现。
> 端点:无实时 UI · 从磁盘读取索引(MARKETPLACE_REPO_PATH)
> 说明:本产品为数据校验型,测试从磁盘读取仓库根 `index.json` / `packages.json` 及 `tools/`、`schemas/` 下的索引与 schema 文件;仅当提供 `MARKETPLACE_BASE_URL` 时改走静态 URL。一条逻辑用例可能对应多个 spec;"已实现"以逻辑用例是否被现有 spec 覆盖为准,而非 spec 中的 test 块数量。
> 最后更新:2026-09-17

## 覆盖总览

| 模块 | 用例数 | 已实现 | 待实现 |
| --- | --- | --- | --- |
| 一、文件与解析 | 7 | 7 | 0 |
| 二、Schema 校验:技能包 | 13 | 13 | 0 |
| 三、Schema 校验:Tool Server 包 | 7 | 7 | 0 |
| 四、条目唯一性与一致性 | 10 | 10 | 0 |
| 五、引用与资源完整性 | 8 | 8 | 0 |
| 六、分类、标签与排序 | 5 | 5 | 0 |
| 七、空值与异常数据处理 | 5 | 5 | 0 |
| 八、可选静态 URL 与冒烟 | 4 | 4 | 0 |
| **合计** | **59** | **59** | **0** |

---

## 一、文件与解析

### MP-DATA-001 index.json 存在且为合法 JSON 数组
- 优先级:P0
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/index.spec.ts
- 前置条件:`MARKETPLACE_REPO_PATH` 指向 marketplace 仓库根
- 步骤:
  1. 解析 `resolve(repoPath, 'index.json')`,先 `existsSync` 判断存在
  2. `JSON.parse` 读取内容
- 预期结果:文件存在;解析成功;顶层为数组(`Array.isArray === true`)

### MP-DATA-002 packages.json 存在且为合法 JSON
- 优先级:P0
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/index.spec.ts
- 前置条件:仓库根存在 `packages.json`
- 步骤:
  1. `JSON.parse(readFileSync('packages.json'))`
- 预期结果:解析成功且结果非 undefined(缺失时按现有实现 `test.skip`)

### MP-DATA-003 index.json 非空(至少一条技能条目)
- 优先级:P1
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/index.spec.ts
- 前置条件:index.json 已解析
- 步骤:
  1. 读取数组长度
- 预期结果:`entries.length > 0`,发布清单不为空

### MP-DATA-004 tools/index.json 存在且为合法 JSON 数组
- 优先级:P1
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:35
- 前置条件:仓库存在 `tools/index.json`(工具轻量索引)
- 步骤:
  1. `existsSync` + `JSON.parse` 读取 `tools/index.json`
  2. 断言顶层为数组
- 预期结果:文件存在;解析成功;为非空数组(当前含 brave-search / fetch / ifind-data / paper-broker / qmt-broker 共 5 条)

### MP-DATA-005 tools/packages.json 存在且为合法 JSON 数组
- 优先级:P1
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:42
- 前置条件:仓库存在 `tools/packages.json`(Tool Server 完整包列表)
- 步骤:
  1. `JSON.parse` 读取 `tools/packages.json`
  2. 断言为数组
- 预期结果:解析成功,顶层为数组,长度与 `tools/index.json` 一致

### MP-DATA-006 schemas 目录含两个 JSON Schema 且合法
- 优先级:P1
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:48
- 前置条件:仓库存在 `schemas/`
- 步骤:
  1. 读取并解析 `schemas/skill.schema.json`、`schemas/tool-server.schema.json`
  2. 断言各自含 `$schema`、`type: "object"`、`required` 数组
- 预期结果:两个 schema 均为合法 JSON 且结构完整,可用作后续 schema 校验的依据

### MP-DATA-007 templates 起始模板存在且为合法 JSON
- 优先级:P2
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:58
- 前置条件:仓库存在 `templates/`
- 步骤:
  1. 解析 `templates/skill.json`、`templates/tool-server.json`
- 预期结果:两个模板均为合法 JSON,且可通过对应 schema 的必填字段检查(作为作者复制起点)

---

## 二、Schema 校验:技能包

> 数据源:`packages.json`(按 `cn`/`en` 分组的完整技能包对象);校验依据:`schemas/skill.schema.json`。

### MP-DATA-008 技能包含全部必填字段
- 优先级:P0
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:75
- 前置条件:遍历 `packages.json` 的 `cn` 与 `en` 两组内每个技能包
- 步骤:
  1. 对每个技能包断言存在 `schemaVersion`、`id`、`version`、`name`、`launch`、`instructions`
- 预期结果:所有必填字段齐备;缺任一字段即判定失败(现有 spec 仅校验轻量 index 的 id/lang/name/category,未校验完整包)

### MP-DATA-009 schemaVersion 恒为 "1.0"
- 优先级:P1
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:84
- 前置条件:遍历所有技能包
- 步骤:
  1. 断言 `schemaVersion === "1.0"`(schema `const`)
- 预期结果:全部等于 `"1.0"`;其它取值判定失败

### MP-DATA-010 id 符合 kebab-case 正则
- 优先级:P0
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:90
- 前置条件:遍历所有技能包
- 步骤:
  1. 用 `^[a-z0-9][a-z0-9-]*[a-z0-9]$` 校验 `id`
- 预期结果:如 `reading-summary`、`strategy-trading`、`web-research` 均通过;含大写/下划线/首尾连字符判定失败

### MP-DATA-011 version 符合 semver 正则
- 优先级:P0
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:96
- 前置条件:遍历所有技能包
- 步骤:
  1. 用 `^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$` 校验 `version`
- 预期结果:如 `1.0.0`、`1.0.1` 通过;`1.0`、`v1` 等判定失败

### MP-DATA-012 name / description 为 localizedText
- 优先级:P1
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:102
- 前置条件:遍历所有技能包
- 步骤:
  1. 断言 `name` 为非空字符串,或为对象且至少含 `cn`/`en` 之一
  2. 若含 `description` 同样校验
- 预期结果:满足 `localizedText`(string 或 `{cn?,en?}`)形状;空对象或非法类型判定失败

### MP-DATA-013 launch 满足 oneOf 约束
- 优先级:P1
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:111
- 前置条件:遍历所有技能包
- 步骤:
  1. 断言 `launch.type ∈ {chat, workspace, external}`
  2. `workspace` 需含 `target`,`external` 需含 `url`,`chat` 不含多余字段
- 预期结果:当前技能均为 `{type:"chat"}` 通过;缺 target/url 或字段越界判定失败

### MP-DATA-014 instructions 满足 oneOf 约束
- 优先级:P0
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:129
- 前置条件:遍历所有技能包
- 步骤:
  1. 断言 `instructions.type` 为 `inline`(含非空 `content`)或 `file`(含非空 `path`)
- 预期结果:当前技能均为 `inline` 且 `content` 非空;`inline` 缺 content 或 `file` 缺 path 判定失败

### MP-DATA-015 icon 结构合法
- 优先级:P2
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:144
- 前置条件:技能包含可选 `icon`
- 步骤:
  1. 断言 `icon.type ∈ {emoji, builtin, url}` 且含 `value`
- 预期结果:如 `{type:"emoji",value:"1f4c8"}`、`{type:"builtin",value:"gpt-bot"}` 通过;缺 value 或非法 type 判定失败

### MP-DATA-016 visibility.scope 属枚举
- 优先级:P2
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:153
- 前置条件:技能包含可选 `visibility`
- 步骤:
  1. 断言 `visibility.scope ∈ {private, organization, public}`
- 预期结果:当前均为 `public` 通过;其它取值判定失败

### MP-DATA-017 permissions 含必填四字段
- 优先级:P1
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:162
- 前置条件:技能包含 `permissions`
- 步骤:
  1. 断言同时存在 `network`、`filesystem`、`wallet`、`externalTools`
  2. 前三者为布尔,`externalTools` 为数组
- 预期结果:四字段齐备且类型正确;缺任一项判定失败

### MP-DATA-018 release.status / review 属枚举
- 优先级:P1
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:173
- 前置条件:技能包含 `release`
- 步骤:
  1. 断言 `status ∈ {draft, published, deprecated, removed}`
  2. 若含 `review`,断言 `∈ {pending, approved, rejected}`
- 预期结果:当前均为 `{status:"published",review:"approved"}` 通过;非枚举值判定失败

### MP-DATA-019 toolServers[] 结构与 transport 枚举
- 优先级:P1
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:187
- 前置条件:技能包含 `toolServers`
- 步骤:
  1. 对每项断言含 `id`、`name`、`transport`、`required`
  2. 断言 `transport ∈ {stdio, http, sse}`,`required` 为布尔
- 预期结果:如 `ifind-data`/`qmt-broker`/`paper-broker`/`fetch`/`brave-search` 项 `transport:"stdio"` 通过;缺字段或非法 transport 判定失败

### MP-DATA-020 技能包无未知字段(additionalProperties=false)
- 优先级:P2
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:198
- 前置条件:遍历所有技能包
- 步骤:
  1. 用完整 skill.schema 做严格校验(顶层 `additionalProperties:false`)
- 预期结果:技能对象不含 schema 未声明的多余键;出现未知字段判定失败

---

## 三、Schema 校验:Tool Server 包

> 数据源:`tools/packages.json`;校验依据:`schemas/tool-server.schema.json`。

### MP-DATA-021 Tool Server 含全部必填字段
- 优先级:P0
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:209
- 前置条件:遍历 `tools/packages.json` 每个包
- 步骤:
  1. 断言存在 `schemaVersion`、`id`、`version`、`name`、`description`、`repo`、`tags`、`command`、`baseArgs`、`configurable`、`release`
- 预期结果:全部必填字段齐备;缺任一项判定失败

### MP-DATA-022 Tool Server id 符合 kebab-case
- 优先级:P1
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:218
- 前置条件:遍历所有 Tool Server 包
- 步骤:
  1. 用 `^[a-z0-9][a-z0-9-]*[a-z0-9]$` 校验 `id`
- 预期结果:`brave-search`、`ifind-data`、`qmt-broker` 等均通过;非法命名判定失败

### MP-DATA-023 configurable 为布尔
- 优先级:P2
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:224
- 前置条件:遍历所有 Tool Server 包
- 步骤:
  1. 断言 `typeof configurable === "boolean"`
- 预期结果:`brave-search=true`、`fetch=false` 等均为布尔;非布尔判定失败

### MP-DATA-024 release.status / review 属 Tool Server 枚举
- 优先级:P1
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:230
- 前置条件:遍历所有 Tool Server 包
- 步骤:
  1. 断言 `status ∈ {published, draft, removed}`(注意与技能枚举不同,无 `deprecated`)
  2. 断言 `review ∈ {approved, pending, rejected}`
- 预期结果:当前均为 `{status:"published",review:"approved"}` 通过;非枚举值判定失败

### MP-DATA-025 command 非空且 baseArgs 为字符串数组
- 优先级:P1
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:239
- 前置条件:遍历所有 Tool Server 包
- 步骤:
  1. 断言 `command` 为非空字符串(如 `npx`、`uvx`)
  2. 断言 `baseArgs` 为数组且元素均为字符串
- 预期结果:如 `command:"npx"` + `baseArgs:["-y","@brave/...","--transport","stdio"]` 通过;类型不符判定失败

### MP-DATA-026 configurable=true 时提供 configSchema
- 优先级:P2
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:248
- 前置条件:某 Tool Server `configurable === true`
- 步骤:
  1. 断言存在 `configSchema.properties` 且描述了必填配置项
- 预期结果:如 `brave-search` 提供 `braveApiKey` 配置项;`configurable=true` 却无 configSchema 判定为可疑/失败

### MP-DATA-027 Tool Server 无未知字段
- 优先级:P2
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:257
- 前置条件:遍历所有 Tool Server 包
- 步骤:
  1. 用 tool-server.schema 做严格校验(`additionalProperties:false`)
- 预期结果:不含 schema 未声明的多余键;出现未知字段判定失败

---

## 四、条目唯一性与一致性

### MP-DATA-028 index 条目含 id/lang/name/category
- 优先级:P0
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/index.spec.ts
- 前置条件:index.json 已解析
- 步骤:
  1. 遍历每条,断言 `id` 为非空字符串、`lang` 为字符串、`name` 至少含 cn/en 之一、`category` 为字符串
- 预期结果:各条目基础字段齐备

### MP-DATA-029 index 条目含 version/path/release
- 优先级:P1
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:268
- 前置条件:index.json 已解析
- 步骤:
  1. 遍历每条,断言含 `version`(字符串)、`path`(字符串)、`release`(对象含 status)
- 预期结果:轻量索引除 id/lang/name/category 外,version/path/release 也完整(现有 spec 未覆盖这三项)

### MP-DATA-030 (id, lang) 组合唯一
- 优先级:P0
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:277
- 前置条件:index.json 已解析
- 步骤:
  1. 以 `lang + ":" + id` 为键构建集合,统计重复
- 预期结果:无重复键。注意 `strategy-trading` 同时以 `cn`、`en` 出现属合法(键不同);仅当同 `lang` 下同 `id` 重复才失败

### MP-DATA-031 同一 lang 内 id 不重复
- 优先级:P0
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:286
- 前置条件:index.json 已解析
- 步骤:
  1. 分别在 `cn`、`en` 子集内检查 id 是否重复
- 预期结果:每种语言内 id 唯一(对应 build.mjs 的 `duplicate skill id` 断言)

### MP-DATA-032 lang 取值属 {cn, en}
- 优先级:P1
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:295
- 前置条件:index.json 已解析
- 步骤:
  1. 遍历每条断言 `lang ∈ {cn, en}`
- 预期结果:仅两种受支持语言;其它值判定失败

### MP-DATA-033 index 的 version 符合 semver
- 优先级:P1
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:301
- 前置条件:index.json 已解析
- 步骤:
  1. 用 semver 正则校验每条 `version`
- 预期结果:`1.0.0`、`1.0.1` 通过;非法版本号判定失败

### MP-DATA-034 index.id 与源文件父目录名一致
- 优先级:P1
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:307
- 前置条件:index.json 已解析,可访问 `skills/chat/`
- 步骤:
  1. 对每条,从 `path`(如 `skills/chat/web-research/cn.json`)取父目录名
  2. 断言父目录名 === `id`
- 预期结果:一致(对应 build.mjs 的 `skill id must match parent folder`)

### MP-DATA-035 index 与 packages 一致
- 优先级:P0
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:313
- 前置条件:index.json 与 packages.json 均已解析
- 步骤:
  1. 对每个 `(id, lang)`,断言在 `packages.json[lang]` 中存在同 id 的完整包
  2. 断言两侧 `version` 一致
  3. 反向断言 packages 中每个包也出现在 index 中
- 预期结果:轻量索引与完整包列表一一对应且版本一致,无孤儿条目

### MP-DATA-036 tools/index id 唯一且与 tools/packages 一致
- 优先级:P1
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:332
- 前置条件:`tools/index.json` 与 `tools/packages.json` 均已解析
- 步骤:
  1. 断言 `tools/index.json` 内 id 无重复(对应 build.mjs `duplicate tool server id`)
  2. 断言与 `tools/packages.json` 按 id 一一对应且版本一致
- 预期结果:两侧一致,无孤儿工具条目

### MP-DATA-037 codex 技能不进入 index / packages
- 优先级:P1
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:347
- 前置条件:`skills/codex/` 下存在 Codex 执行类技能(SKILL.md 结构)
- 步骤:
  1. 收集 `skills/codex/` 子目录名(如 `community-project-skill`、`community-warehouse-skill`)
  2. 断言它们不出现在 `index.json` 与 `packages.json`
- 预期结果:Codex 技能仅用 SKILL.md 目录组织,绝不进入 Chat 加载的发布清单

---

## 五、引用与资源完整性

### MP-DATA-038 index.path 指向真实存在的源文件
- 优先级:P0
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:369
- 前置条件:index.json 已解析,可访问仓库文件系统
- 步骤:
  1. 对每条 `resolve(repoPath, entry.path)` 后 `existsSync`
- 预期结果:每条 `path`(如 `skills/chat/reading-summary/en.json`)均指向实际存在的技能包文件;悬空引用判定失败

### MP-DATA-039 tools/index.path 指向真实存在的文件
- 优先级:P1
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:375
- 前置条件:`tools/index.json` 已解析
- 步骤:
  1. 对每条 `resolve(repoPath, entry.path)` 后 `existsSync`
- 预期结果:每条 `path`(如 `tools/servers/fetch.json`)均存在;悬空引用判定失败

### MP-DATA-040 技能 toolServers[].id 引用真实存在的 Tool Server
- 优先级:P0
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:381
- 前置条件:packages.json 与 tools/index.json 均已解析
- 步骤:
  1. 收集 `tools/index.json` 全部工具 id 作为集合
  2. 遍历每个技能包的 `toolServers[].id`,断言存在于该集合
- 预期结果:如 `ifind-data`、`qmt-broker`、`paper-broker`、`fetch`、`brave-search` 均可解析;引用未登记的工具判定失败

### MP-DATA-041 permissions.externalTools 与工具依赖一致
- 优先级:P2
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:390
- 前置条件:某技能包含 `permissions.externalTools`
- 步骤:
  1. 断言 `externalTools` 中每个 id 与该技能声明的 `tools[].id` 或 `toolServers[].id` 对应
- 预期结果:如 `strategy-trading` 的 `externalTools:[ifind-data,qmt-broker,paper-broker]` 与其 toolServers 一致;声明与依赖不一致判定为可疑/失败

### MP-DATA-042 icon.type=url 时 value 可解析
- 优先级:P2
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:404
- 前置条件:存在 `icon.type === "url"` 的技能(当前无,作为未来数据护栏)
- 步骤:
  1. 断言 `value` 为合法 URL 形状(必要时可选发起 HEAD 请求校验可达)
- 预期结果:URL 合法且资源可解析;非法/失效链接判定失败

### MP-DATA-043 icon.type=emoji 时 value 为合法 unicode 码点
- 优先级:P2
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:414
- 前置条件:存在 `icon.type === "emoji"` 的技能(如 `strategy-trading` 的 `1f4c8`)
- 步骤:
  1. 断言 `value` 可解析为有效 unicode 码点(十六进制)
- 预期结果:`1f4c8` 等解析为有效 emoji;非法码点判定失败

### MP-DATA-044 instructions.type=file 时 path 指向存在文件
- 优先级:P1
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:430
- 前置条件:存在 `instructions.type === "file"` 的技能(当前均为 inline,作为未来数据护栏)
- 步骤:
  1. 对 `instructions.path` 相对技能包目录 `existsSync`
- 预期结果:引用的指令文件存在;悬空引用判定失败

### MP-DATA-045 npx @yeying-community 包有本地源码
- 优先级:P2
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:443
- 前置条件:某 Tool Server `command:"npx"` 且 `baseArgs` 含 `@yeying-community/<pkg>`
- 步骤:
  1. 从 baseArgs 解析出包名后缀
  2. 断言 `tools/packages/<pkg>` 目录存在且含 `package.json`
- 预期结果:社区自维护包(如 `ifind-data-mcp`、`paper-broker-mcp`、`qmt-broker-mcp`)有对应本地源码;缺失判定失败(第三方 `npx`/`uvx` 包不在此校验)

---

## 六、分类、标签与排序

### MP-DATA-046 category 为非空字符串且属已知集合
- 优先级:P2
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:464
- 前置条件:index.json 已解析
- 步骤:
  1. 断言每条 `category` 为非空字符串
  2. 断言属于已知集合(如 `productivity`、`finance`、`research`)
- 预期结果:分类合法;空串或未登记分类判定为可疑/失败

### MP-DATA-047 tags 为字符串数组且元素唯一
- 优先级:P2
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:474
- 前置条件:index.json 与 packages.json 已解析
- 步骤:
  1. 断言 `tags` 为数组且元素均为字符串
  2. 断言同一条目内 tags 无重复(schema `uniqueItems`)
- 预期结果:如 `["trading","strategy","execution","risk","automation"]` 通过;含重复元素判定失败

### MP-DATA-048 packages.json 按 cn/en 分组且每组为数组
- 优先级:P1
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:486
- 前置条件:packages.json 已解析
- 步骤:
  1. 断言顶层为对象且含 `cn`、`en` 键
  2. 断言 `cn`、`en` 各为数组
- 预期结果:结构形如 `{cn:[...], en:[...]}`;缺键或非数组判定失败

### MP-DATA-049 index 条目按 id 稳定排序
- 优先级:P2
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:495
- 前置条件:index.json 已解析
- 步骤:
  1. 复制条目按 build.mjs 的收集顺序(技能文件夹 `sort()`,语言按 cn→en)重排
  2. 与实际顺序比对
- 预期结果:实际顺序与生成脚本确定性顺序一致,证明清单为脚本生成而非手改乱序

### MP-DATA-050 tools/index 按文件名稳定排序
- 优先级:P2
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/data.spec.ts:511
- 前置条件:tools/index.json 已解析
- 步骤:
  1. 断言条目顺序与 `tools/servers/*.json` 文件名 `sort()` 顺序一致
- 预期结果:顺序稳定(brave-search→fetch→ifind-data→paper-broker→qmt-broker)

---

## 七、空值与异常数据处理

### MP-DATA-051 index.json 缺失时给出明确错误
- 优先级:P1
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/edge.spec.ts:22
- 前置条件:将 `MARKETPLACE_REPO_PATH` 指向不含 index.json 的目录
- 步骤:
  1. 触发读取逻辑
- 预期结果:抛出明确错误 `marketplace index.json not found at <path>`,而非静默返回空或崩溃

### MP-DATA-052 packages.json 缺失时优雅跳过
- 优先级:P2
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/edge.spec.ts:29
- 前置条件:仓库缺少 `packages.json`
- 步骤:
  1. 运行 packages.json 相关校验
- 预期结果:用例 `test.skip` 并给出 `packages.json not found` 原因,不误报失败(现有实现具备该保护,但真实缺失路径未被断言覆盖)

### MP-DATA-053 非法 JSON 被解析失败捕获
- 优先级:P2
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/edge.spec.ts:40
- 前置条件:构造含尾逗号/截断的畸形 index.json 夹具
- 步骤:
  1. 对畸形内容执行 `JSON.parse`
- 预期结果:抛出 `SyntaxError`,被测试捕获并判定为数据非法(不吞掉异常)

### MP-DATA-054 空数组 index 触发断言失败
- 优先级:P2
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/edge.spec.ts:48
- 前置条件:构造 `[]` 空数组 index.json 夹具
- 步骤:
  1. 运行"非空"校验
- 预期结果:`length > 0` 断言失败,提示发布清单为空

### MP-DATA-055 可选字段缺省不报错
- 优先级:P2
- 类型:DATA
- 状态:✅ 已实现 — products/marketplace/tests/edge.spec.ts:58
- 前置条件:存在缺 `description`/`tags`/`icon` 等可选字段的合法技能包
- 步骤:
  1. 运行完整 schema 校验
- 预期结果:仅缺可选字段不触发失败(如 `reading-summary` 无 `ui`、`web-research` 无 `icon` 均合法),仅必填缺失才失败

---

## 八、可选静态 URL 与冒烟

### MP-API-001 静态 URL 提供时 GET /index.json 返回 <500
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/marketplace/tests/index.spec.ts
- 前置条件:设置 `MARKETPLACE_BASE_URL`(未设置则 `test.skip`)
- 步骤:
  1. `GET {baseURL}/index.json`
- 预期结果:响应状态码 `< 500`(证明索引已托管可访问)

### MP-API-002 静态 URL GET /packages.json 可获取且为合法 JSON
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/marketplace/tests/api.spec.ts:14
- 前置条件:设置 `MARKETPLACE_BASE_URL`
- 步骤:
  1. `GET {baseURL}/packages.json`
  2. 解析响应体
- 预期结果:返回 2xx,响应体为合法 JSON 且含 `cn`/`en` 分组

### MP-API-003 静态 URL GET /tools/packages.json 可获取
- 优先级:P2
- 类型:API
- 状态:✅ 已实现 — products/marketplace/tests/api.spec.ts:24
- 前置条件:设置 `MARKETPLACE_BASE_URL`
- 步骤:
  1. `GET {baseURL}/tools/packages.json`
- 预期结果:返回 2xx,响应体为合法 JSON 数组(工具包列表)

### MP-API-004 未设置 BASE_URL 时回退磁盘读取
- 优先级:P1
- 类型:API
- 状态:✅ 已实现 — products/marketplace/tests/api.spec.ts:32
- 前置条件:不设置 `MARKETPLACE_BASE_URL`,仅设 `MARKETPLACE_REPO_PATH`
- 步骤:
  1. 运行数据校验用例
- 预期结果:所有 DATA 用例从磁盘读取并正常执行,静态 URL 用例被 `test.skip`,降级路径无副作用
