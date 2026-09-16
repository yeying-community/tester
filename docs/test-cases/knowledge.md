# 知识库 Knowledge — 端到端测试用例

> 测试人员视角整理的**应有** E2E 用例清单,作为实现依据。
> 状态说明:✅ 已实现(链接到 spec) / ⬜ 待实现。
> 端点:前端 5173 · FastAPI 8000 · 健康检查 `/health` · Swagger `/docs`
> 说明:一条逻辑用例可能对应多个 spec;"已实现"以逻辑用例是否被现有 spec 覆盖为准,而非 spec 中的 test 块数量。
> 鉴权说明:除鉴权、通行证回调、`service/*` 服务检索(用 `X-Service-Api-Key`)外,业务接口均需 `Authorization: Bearer <access_token>`(钱包地址绑定的 JWT);知识库等资源按 `owner_wallet_address` 归属隔离,越权访问返回 404。
> 最后更新:2026-09-16

## 覆盖总览

| 模块 | 用例数 | 已实现 | 待实现 |
| --- | --- | --- | --- |
| 一、健康检查与冒烟 | 6 | 5 | 1 |
| 二、鉴权与会话 | 12 | 0 | 12 |
| 三、登录页 UI | 3 | 0 | 3 |
| 四、知识库管理 | 9 | 0 | 9 |
| 五、来源接入与扫描 | 7 | 0 | 7 |
| 六、Evidence 证据构建 | 5 | 0 | 5 |
| 七、候选知识与知识项 | 11 | 0 | 11 |
| 八、发布版本管理 | 7 | 0 | 7 |
| 九、检索验证 Search Lab | 6 | 0 | 6 |
| 十、服务检索与授权 | 10 | 0 | 10 |
| 十一、导入任务 | 7 | 0 | 7 |
| 十二、文档管理 | 3 | 0 | 3 |
| 十三、Warehouse 集成 | 9 | 0 | 9 |
| 十四、分析任务 Analysis Runs | 5 | 0 | 5 |
| 十五、记忆 Memory | 3 | 0 | 3 |
| 十六、运维 Ops | 4 | 0 | 4 |
| 十七、Agent Runs 服务编排 | 3 | 0 | 3 |
| **合计** | **110** | **5** | **105** |

---

## 一、健康检查与冒烟

### KN-API-001 健康检查返回 ok
- 优先级:P0
- 类型:API
- 状态:✅ 已实现 — products/knowledge/tests/smoke.spec.ts
- 前置条件:FastAPI 服务在 8000 可用
- 步骤:
  1. `GET /health`
- 预期结果:返回 2xx(应为 200),响应体 `{"status":"ok"}`

### KN-API-002 Swagger 文档可访问
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:后端已启动
- 步骤:
  1. `GET /docs`(以及 `GET /openapi.json`)
- 预期结果:返回 200,Swagger UI 可加载;openapi 文档含 `/auth`、`/kbs`、`/service/search` 等路由

### KN-UI-001 首页渲染
- 优先级:P0
- 类型:UI
- 状态:✅ 已实现 — products/knowledge/tests/smoke.spec.ts
- 前置条件:前端 5173 可用
- 步骤:
  1. 访问首页 `/`
- 预期结果:`body` 可见,页面正常挂载(未认证时应落到登录页 "登录 Knowledge")

### KN-UI-002 首页存在导航/链接入口
- 优先级:P1
- 类型:UI
- 状态:✅ 已实现 — products/knowledge/tests/smoke.spec.ts;products/knowledge/tests/user-flow.spec.ts
- 前置条件:前端 5173 可用
- 步骤:
  1. 访问首页
  2. 统计 `a[href]` / `[role="link"]` / `[role="menuitem"]` 数量
- 预期结果:至少存在一个可导航入口

### KN-UI-003 落地页文本内容充分
- 优先级:P1
- 类型:UI
- 状态:✅ 已实现 — products/knowledge/tests/user-flow.spec.ts
- 前置条件:前端 5173 可用
- 步骤:
  1. 访问首页,读取 `body` 文本
- 预期结果:去空白后文本长度 > 50,页面渲染了实质内容(品牌/登录说明等)

### KN-UI-004 登录/交互控件可发现
- 优先级:P1
- 类型:UI
- 状态:✅ 已实现 — products/knowledge/tests/user-flow.spec.ts
- 前置条件:前端 5173 可用
- 步骤:
  1. 访问首页,统计 `input, button, a, [role="button"], [role="link"]`
- 预期结果:存在至少一个可交互控件(登录按钮等)

> 注:本模块 UI 用例编号至 KN-UI-004;登录页 UI 从 KN-UI-005 起(见模块三),UI 编号跨模块连续。

---

## 二、鉴权与会话

### KN-API-003 SIWE 挑战返回 nonce 与消息
- 优先级:P0
- 类型:API
- 状态:⬜ 待实现
- 前置条件:后端可用(development 环境无需预置 `SIWE_DOMAIN/SIWE_URI`)
- 步骤:
  1. `POST /auth/challenge`,body `{"wallet_address":"0x...<42位>"}`
- 预期结果:返回 `{wallet_address, nonce, message, challenge, expires_at}`,`message` 为待签名 SIWE 文本,`challenge==message`

### KN-API-004 挑战地址长度不合法被拒
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:无
- 步骤:
  1. `POST /auth/challenge` 传入长度 < 42 的地址
- 预期结果:返回 422(schema 校验 `min_length=42`),不下发 challenge

### KN-API-005 挑战→签名→verify 换取访问与刷新令牌
- 优先级:P0
- 类型:API
- 状态:⬜ 待实现
- 前置条件:准备一个测试钱包私钥
- 步骤:
  1. `POST /auth/challenge` 得到 `message`
  2. 用私钥对 `message` 做 `personal_sign`
  3. `POST /auth/verify`,body `{wallet_address, signature}`
- 预期结果:返回 `{access_token, token, refresh_token, wallet_address, expires_at, refresh_expires_at}`,token 为绑定该地址的 JWT

### KN-API-006 verify 错误签名被拒
- 优先级:P0
- 类型:API
- 状态:⬜ 待实现
- 前置条件:已获取地址 A 的 challenge
- 步骤:
  1. 用另一把私钥 B 对 A 的 challenge 签名
  2. `POST /auth/verify` 提交(wallet_address=A)
- 预期结果:返回 400,验证失败,不下发 token

### KN-API-007 钱包身份(identity)登录会话与验证
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:通行证/identity issuer 已配置(否则断言 503 降级)
- 步骤:
  1. `POST /auth/identity/login/session` 创建会话
  2. `POST /auth/identity/login/verify` 提交 `{session_id, presentation}`
- 预期结果:配置可用时验证通过返回 TokenResponse;未配置返回 503;presentation 非法返回 400

### KN-API-008 创建通行证登录会话
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:夜莺通行证已登记回调(否则断言 503)
- 步骤:
  1. `POST /auth/passport/sessions`
- 预期结果:配置可用时返回 `{session_id, verify_url, status, expires_at}`;未配置返回 503

### KN-API-009 轮询通行证会话状态
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:已创建 passport 会话
- 步骤:
  1. `GET /auth/passport/sessions/{session_id}`
- 预期结果:未完成返回 `{status}`(非 completed);完成后返回 `{status:"completed", token:{...}}`;会话不存在返回 410

### KN-API-010 Demo 登录仅开发环境可用
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:区分 development / 生产环境
- 步骤:
  1. `POST /auth/demo`
- 预期结果:development(或 debug)返回 TokenResponse 并注入示例知识库/文档/发布;非开发环境返回 403

### KN-API-011 refresh 刷新令牌
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:已登录取得 refresh_token
- 步骤:
  1. `POST /auth/refresh`,body `{refresh_token}`
- 预期结果:返回新的 access/refresh 令牌;传入非 refresh 类型或非法 token 返回 401

### KN-API-012 logout 注销
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:无
- 步骤:
  1. `POST /auth/logout`
- 预期结果:返回 `{"ok":true}`

### KN-API-013 受保护接口缺少 JWT 返回 401
- 优先级:P0
- 类型:API
- 状态:⬜ 待实现
- 前置条件:无
- 步骤:
  1. 不带 `Authorization` 头请求 `GET /kbs`
- 预期结果:返回 401,detail `Authentication required`

### KN-API-014 受保护接口非法/过期 JWT 返回 401
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:无
- 步骤:
  1. 携带伪造/过期 `Authorization: Bearer xxx` 请求 `GET /kbs`
- 预期结果:返回 401,拒绝访问

---

## 三、登录页 UI

### KN-UI-005 渲染钱包与通行证两种登录入口并可切换
- 优先级:P1
- 类型:UI
- 状态:⬜ 待实现
- 前置条件:前端 5173 可用,未认证
- 步骤:
  1. 访问首页,观察登录面板
  2. 点击右上角切换按钮(指纹/钱包图标)
- 预期结果:默认展示"使用钱包登录",切换后展示"使用夜莺通行证登录",标题恒为"登录 Knowledge"

### KN-UI-006 通行证未配置时 503 友好提示
- 优先级:P2
- 类型:UI
- 状态:⬜ 待实现
- 前置条件:后端未配置夜莺通行证(`/auth/passport/sessions` 返回 503)
- 步骤:
  1. 切换到通行证模式,点击"使用夜莺通行证登录"
- 预期结果:页面弹出错误提示"夜莺通行证尚未配置,请联系管理员登记应用回调地址。",无 JS 崩溃

### KN-UI-007 无钱包扩展时钱包登录报错
- 优先级:P2
- 类型:UI
- 状态:⬜ 待实现
- 前置条件:浏览器未注入可用钱包 provider
- 步骤:
  1. 在钱包模式点击"使用钱包登录"
- 预期结果:提示"未检测到可用钱包..."类错误,状态回到"钱包登录未完成",页面不崩溃

---

## 四、知识库管理

### KN-API-015 列出当前钱包的知识库
- 优先级:P0
- 类型:API
- 状态:⬜ 待实现
- 前置条件:JWT 已登录
- 步骤:
  1. `GET /kbs`
- 预期结果:返回该钱包拥有的知识库数组,按创建时间倒序;仅含本人资源

### KN-API-016 创建知识库
- 优先级:P0
- 类型:API
- 状态:⬜ 待实现
- 前置条件:JWT 已登录
- 步骤:
  1. `POST /kbs`,body `{name, description?, retrieval_config?}`
  2. `GET /kbs` 确认
- 预期结果:返回新建 KB(含默认 retrieval_config:chunk_size/overlap/top_k/embedding_model),列表中出现

### KN-API-017 访问他人知识库返回 404
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:存在归属其它钱包的 kb_id
- 步骤:
  1. 以当前 JWT `GET /kbs/{他人kb_id}`
- 预期结果:返回 404 `knowledge base not found`(归属隔离)

### KN-API-018 更新知识库(改切片配置触发重建)
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:已有含文档的知识库
- 步骤:
  1. `PATCH /kbs/{kb_id}` 修改 `retrieval_config.chunk_size`
- 预期结果:返回更新后的 KB;当 chunk_size/overlap/embedding_model 变化且已有文档时,后台安排 reindex 任务

### KN-API-019 删除知识库(存在活动任务返回 409)
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:知识库存在
- 步骤:
  1. 无活动任务时 `DELETE /kbs/{kb_id}`
  2. 另测:存在 running/cancel_requested 任务时删除
- 预期结果:无活动任务时返回 `{"ok":true}` 并级联清理文档/切片/向量/绑定;有活动任务返回 409

### KN-API-020 知识库统计 stats
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:知识库存在
- 步骤:
  1. `GET /kbs/{kb_id}/stats`
- 预期结果:返回 `{kb_id, bindings_count, documents_count, chunks_count, latest_task_status, latest_task_finished_at}`

### KN-API-021 工作台 workbench 汇总
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:知识库存在
- 步骤:
  1. `GET /kbs/{kb_id}/workbench`
- 预期结果:返回绑定/来源等工作台聚合视图结构

### KN-UI-008 创建知识库并出现在下拉
- 优先级:P0
- 类型:E2E
- 状态:⬜ 待实现
- 前置条件:已认证会话进入知识工作台
- 步骤:
  1. 在"知识库"面板输入"新知识库名称"
  2. 点击"创建"
- 预期结果:创建成功,新知识库进入下拉并被自动选中(按钮态"正在创建"→恢复)

### KN-UI-009 选择知识库后展开工作台面板
- 优先级:P1
- 类型:UI
- 状态:⬜ 待实现
- 前置条件:至少存在一个知识库
- 步骤:
  1. 在下拉"选择知识库"中选择一个 KB
- 预期结果:渲染来源、候选、知识项、发布、检索验证、分析任务等面板;未选择时显示"创建或选择知识库后开始接入来源。"

---

## 五、来源接入与扫描

### KN-API-022 添加来源
- 优先级:P0
- 类型:API
- 状态:⬜ 待实现
- 前置条件:知识库存在
- 步骤:
  1. `POST /kbs/{kb_id}/sources`,body 指定 `source_type`(warehouse/local_file/github_repository)、`source_path`
- 预期结果:返回 SourceRead,含 source_path/source_type/sync_status

### KN-API-023 列出来源
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:已添加来源
- 步骤:
  1. `GET /kbs/{kb_id}/sources`
- 预期结果:返回来源数组,含刚添加项

### KN-API-024 获取来源详情
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:来源存在
- 步骤:
  1. `GET /kbs/{kb_id}/sources/{source_id}`
- 预期结果:返回该来源详情

### KN-API-025 更新来源
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:来源存在
- 步骤:
  1. `PATCH /kbs/{kb_id}/sources/{source_id}` 修改 enabled/scope 等
- 预期结果:返回更新后的来源,变更持久化

### KN-API-026 扫描来源
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:来源存在且可访问
- 步骤:
  1. `POST /kbs/{kb_id}/sources/{source_id}/scan`
- 预期结果:返回 SourceScanResponse,`sync_status` 更新为 synced/failed,记录扫描结果

### KN-API-027 列出资产 assets
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:扫描后已产生资产
- 步骤:
  1. `GET /kbs/{kb_id}/assets`
  2. `GET /kbs/{kb_id}/sources/{source_id}/assets`
- 预期结果:分别返回知识库级/来源级资产列表

### KN-UI-010 添加来源并触发扫描
- 优先级:P1
- 类型:E2E
- 状态:⬜ 待实现
- 前置条件:已选择知识库
- 步骤:
  1. 在"添加来源"选择类型、填写路径,点击"添加"
  2. 在"已接入来源"对该来源点击"扫描"
- 预期结果:来源出现在列表;扫描后提示"来源扫描完成。",sync_status 刷新

---

## 六、Evidence 证据构建

### KN-API-028 从来源构建 Evidence
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:来源已扫描出资产
- 步骤:
  1. `POST /kbs/{kb_id}/sources/{source_id}/build-evidence`
- 预期结果:返回 EvidenceBuildResponse,生成 text_span 等证据单元

### KN-API-029 从资产构建 Evidence
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:资产存在
- 步骤:
  1. `POST /kbs/{kb_id}/assets/{asset_id}/build-evidence`
- 预期结果:返回构建结果,针对该资产生成证据

### KN-API-030 列出 Evidence
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:已构建证据
- 步骤:
  1. `GET /kbs/{kb_id}/evidence`
- 预期结果:返回证据单元数组,含 text/来源定位

### KN-API-031 获取单条 Evidence
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:证据存在
- 步骤:
  1. `GET /kbs/{kb_id}/evidence/{evidence_id}`
- 预期结果:返回该证据详情;不存在返回 404

### KN-UI-011 构建并查看 Evidence
- 优先级:P2
- 类型:E2E
- 状态:⬜ 待实现
- 前置条件:已选知识库且来源已扫描
- 步骤:
  1. 对来源点击"构建 Evidence"
  2. 点击"查看"
- 预期结果:提示"Evidence 构建完成。";Evidence 面板列出证据条目(`#id` + 文本)

---

## 七、候选知识与知识项

### KN-API-032 从来源生成候选
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:来源已构建证据
- 步骤:
  1. `POST /kbs/{kb_id}/sources/{source_id}/generate-candidates`
- 预期结果:返回 CandidateGenerationResponse,生成待审核候选

### KN-API-033 从资产生成候选
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:资产存在
- 步骤:
  1. `POST /kbs/{kb_id}/assets/{asset_id}/generate-candidates`
- 预期结果:返回候选生成结果

### KN-API-034 列出候选
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:已生成候选
- 步骤:
  1. `GET /kbs/{kb_id}/candidates`
- 预期结果:返回候选数组,含 title/statement/item_type/review_status

### KN-API-035 接受候选生成正式知识项
- 优先级:P0
- 类型:API
- 状态:⬜ 待实现
- 前置条件:存在 pending_review 候选
- 步骤:
  1. `POST /kbs/{kb_id}/candidates/{candidate_id}/accept`
  2. `GET /kbs/{kb_id}/items` 确认
- 预期结果:返回知识项详情(含当前修订与 Evidence 关联);知识项出现在列表

### KN-API-036 拒绝候选
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:存在 pending_review 候选
- 步骤:
  1. `POST /kbs/{kb_id}/candidates/{candidate_id}/reject`
- 预期结果:返回候选,review_status 变为 rejected

### KN-API-037 列出知识项
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:知识库存在
- 步骤:
  1. `GET /kbs/{kb_id}/items`
- 预期结果:返回知识项数组,含 item_type/origin_type/lifecycle_status

### KN-API-038 手工创建知识项
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:知识库存在
- 步骤:
  1. `POST /kbs/{kb_id}/items/manual`,提交 title/statement/item_type 等
- 预期结果:返回知识项详情,origin_type=manual

### KN-API-039 获取知识项详情
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:知识项存在
- 步骤:
  1. `GET /kbs/{kb_id}/items/{item_id}`
- 预期结果:返回 `current_revision`(title/statement)与 `evidence_links` 列表

### KN-API-040 更新知识项
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:知识项存在
- 步骤:
  1. `PATCH /kbs/{kb_id}/items/{item_id}` 修改内容
- 预期结果:返回更新后的详情,生成新修订/更新工作区头

### KN-UI-012 审核候选(接受/拒绝)
- 优先级:P1
- 类型:E2E
- 状态:⬜ 待实现
- 前置条件:存在待审核候选
- 步骤:
  1. 在"待审核候选知识"面板点击"接受为知识项"或"拒绝"
- 预期结果:接受后候选转为知识项并从待审核区移除;拒绝后状态更新

### KN-UI-013 浏览知识项与详情
- 优先级:P2
- 类型:UI
- 状态:⬜ 待实现
- 前置条件:存在正式知识项
- 步骤:
  1. 在"知识项"面板点击某条 `#id`
- 预期结果:右侧详情区展示标题、statement 与 Evidence 关联;无知识项时显示占位文案

---

## 八、发布版本管理

### KN-API-041 发布当前工作区为新版本
- 优先级:P0
- 类型:API
- 状态:⬜ 待实现
- 前置条件:知识库含已确认知识项
- 步骤:
  1. `POST /kbs/{kb_id}/releases`,body `{version, release_note?}`
- 预期结果:返回 ReleaseDetailResponse,status=published,包含已发布知识项列表

### KN-API-042 列出发布版本
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:已有发布
- 步骤:
  1. `GET /kbs/{kb_id}/releases`
- 预期结果:返回发布版本数组,含 version/status/published_at

### KN-API-043 获取当前发布
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:已有已发布版本
- 步骤:
  1. `GET /kbs/{kb_id}/releases/current`
- 预期结果:返回当前生效发布的详情

### KN-API-044 获取发布详情
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:发布存在
- 步骤:
  1. `GET /kbs/{kb_id}/releases/{release_id}`
- 预期结果:返回该发布详情与其条目

### KN-API-045 hotfix 补丁发布
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:存在基线发布
- 步骤:
  1. `POST /kbs/{kb_id}/releases/{release_id}/hotfix`
- 预期结果:返回新的 hotfix 发布详情

### KN-API-046 rollback 回滚
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:存在多个发布
- 步骤:
  1. `POST /kbs/{kb_id}/releases/{release_id}/rollback`
- 预期结果:回滚成功,当前发布切换为目标版本

### KN-UI-014 发布版本并查看已发布知识项
- 优先级:P1
- 类型:E2E
- 状态:⬜ 待实现
- 前置条件:已选知识库含知识项
- 步骤:
  1. 在"发布版本"面板填写版本号与说明,点击"发布当前工作区"
  2. 在列表点击该版本
- 预期结果:版本出现在列表;右侧详情展示发布说明与"已发布知识项"(Item/Revision/health)

---

## 九、检索验证 Search Lab

### KN-API-047 三模式检索对比
- 优先级:P0
- 类型:API
- 状态:⬜ 待实现
- 前置条件:知识库含可检索内容(如 Demo 数据)
- 步骤:
  1. `POST /kbs/{kb_id}/search-lab/compare`,body `{query, top_k, result_view, availability_mode}`
- 预期结果:返回 `{kb_id, query, current_release, retrieval_log_id, formal_only, evidence_only, formal_first}`,三组结果各含 results

### KN-API-048 空查询被拒
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:知识库存在
- 步骤:
  1. `POST /kbs/{kb_id}/search-lab/compare` 传入空/空白 query
- 预期结果:返回 400(参数校验失败)

### KN-API-049 检索日志列表
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:已发生检索
- 步骤:
  1. `GET /kbs/{kb_id}/retrieval-logs?limit=50`
- 预期结果:返回检索日志数组

### KN-API-050 检索日志详情
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:存在检索日志
- 步骤:
  1. `GET /kbs/{kb_id}/retrieval-logs/{log_id}`
- 预期结果:返回该日志详情(query/命中/模式)

### KN-API-051 来源治理视图
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:知识库存在来源/资产
- 步骤:
  1. `GET /kbs/{kb_id}/source-governance`
- 预期结果:返回来源与资产治理聚合信息

### KN-UI-015 运行检索对比展示三列
- 优先级:P1
- 类型:E2E
- 状态:⬜ 待实现
- 前置条件:已选知识库含内容
- 步骤:
  1. 在"检索验证"面板输入问题,点击"运行对比"
- 预期结果:渲染 Formal only / Evidence only / Formal first 三列,命中项显示 result_kind·score 与文本;无结果显示"无结果"

---

## 十、服务检索与授权

### KN-API-052 创建服务主体返回 api_key
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:JWT 已登录
- 步骤:
  1. `POST /service-principals`,body `{service_id, display_name, identity_type}`
- 预期结果:返回 `{principal, api_key}`,api_key 仅创建时明文回显

### KN-API-053 校验服务主体 api_key
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:已创建 api_key
- 步骤:
  1. `POST /service-principals/verify`,body `{api_key}`
- 预期结果:有效返回主体信息;无效返回 404/403

### KN-API-054 列出与更新服务主体
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:已创建主体
- 步骤:
  1. `GET /service-principals`
  2. `PATCH /service-principals/{principal_id}` 更新状态/名称
- 预期结果:列表含该主体;更新生效

### KN-API-055 为知识库创建授权 grant
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:主体存在,知识库有已发布版本
- 步骤:
  1. `POST /kbs/{kb_id}/grants`,绑定主体与发布通道
- 预期结果:返回 ServiceGrantRead,授权建立

### KN-API-056 列出与更新授权
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:已创建授权
- 步骤:
  1. `GET /kbs/{kb_id}/grants`
  2. `PATCH /kbs/{kb_id}/grants/{grant_id}` 调整权限/状态
- 预期结果:列表含该授权;更新生效

### KN-API-057 服务检索 formal_first(默认)
- 优先级:P0
- 类型:API
- 状态:⬜ 待实现
- 前置条件:主体已获授权,有效 api_key
- 步骤:
  1. `POST /service/search`,Header `X-Service-Api-Key`,body `{kb_id, query, top_k, result_view, availability_mode}`
- 预期结果:返回 ServiceSearchResponse(formal_first 模式),含命中结果

### KN-API-058 服务检索 formal_only
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:同上
- 步骤:
  1. `POST /service/search/formal`,带 `X-Service-Api-Key`
- 预期结果:仅返回正式知识命中

### KN-API-059 服务检索 evidence_only
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:同上
- 步骤:
  1. `POST /service/search/evidence`,带 `X-Service-Api-Key`
- 预期结果:仅返回 Evidence 命中

### KN-API-060 无效/缺失 api key 被拒
- 优先级:P0
- 类型:API
- 状态:⬜ 待实现
- 前置条件:无
- 步骤:
  1. `POST /service/search` 不带 `X-Service-Api-Key`(缺失 Header)
  2. 带非法 api key 再请求
- 预期结果:缺失返回 422;非法返回 403/404(未授权知识库返回 403)

### KN-API-061 服务侧 grants/kbs/releases 解析
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:有效 api_key 且已授权
- 步骤:
  1. `GET /service/grants`、`GET /service/kbs`、`GET /service/releases/current`(带 `X-Service-Api-Key`)
- 预期结果:分别返回该主体可见的授权、知识库、当前发布

---

## 十一、导入任务

### KN-API-062 创建导入任务
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:知识库存在,来源可访问
- 步骤:
  1. `POST /kbs/{kb_id}/tasks/import`,指定 source_paths
- 预期结果:返回 TaskResponse,task_type=import,status=pending

### KN-API-063 创建重建任务 reindex
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:知识库已有文档
- 步骤:
  1. `POST /kbs/{kb_id}/tasks/reindex`
- 预期结果:返回 reindex 任务

### KN-API-064 创建删除任务 delete
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:知识库已有文档
- 步骤:
  1. `POST /kbs/{kb_id}/tasks/delete`,指定路径
- 预期结果:返回 delete 任务

### KN-API-065 从绑定创建任务
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:知识库存在 source binding
- 步骤:
  1. `POST /kbs/{kb_id}/tasks/import-from-bindings`(及 reindex/delete-from-bindings)
- 预期结果:按绑定生成对应任务

### KN-API-066 任务列表与详情
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:已创建任务
- 步骤:
  1. `GET /tasks`
  2. `GET /tasks/{task_id}`、`GET /tasks/{task_id}/items`
- 预期结果:列表含任务与队列位置;详情返回状态、items 明细

### KN-API-067 任务重试与取消
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:存在失败/进行中任务
- 步骤:
  1. `POST /tasks/{task_id}/retry`
  2. `POST /tasks/{task_id}/cancel`
- 预期结果:重试重置任务;取消置为 cancel_requested/canceled

### KN-API-068 触发处理待处理任务
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:存在 pending 任务
- 步骤:
  1. `POST /tasks/process-pending`
- 预期结果:pending 任务被拾取处理(worker 未运行时用于手动推进)

---

## 十二、文档管理

### KN-API-069 列出文档
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:知识库已导入文档
- 步骤:
  1. `GET /kbs/{kb_id}/documents`
- 预期结果:返回文档数组(source_path/parse_status/chunk_count 等);越权 kb 返回 404

### KN-API-070 获取文档详情
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:文档存在
- 步骤:
  1. `GET /kbs/{kb_id}/documents/{doc_id}`
- 预期结果:返回文档详情(含切片信息)

### KN-API-071 删除文档
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:文档存在
- 步骤:
  1. `DELETE /kbs/{kb_id}/documents/{doc_id}`
  2. 再 `GET /kbs/{kb_id}/documents` 确认
- 预期结果:删除成功,文档及其切片/向量被移除,不再出现在列表

---

## 十三、Warehouse 集成

### KN-API-072 Warehouse 绑定状态
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:JWT 已登录
- 步骤:
  1. `GET /warehouse/status`
- 预期结果:返回 WarehouseStatusResponse(读/写凭据是否就绪、当前 app 绑定状态)

### KN-API-073 Warehouse bootstrap 引导
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:Warehouse 服务可达
- 步骤:
  1. `POST /warehouse/bootstrap/challenge`
  2. 签名后 `POST /warehouse/bootstrap/initialize`
- 预期结果:引导初始化成功,建立应用目录/凭据

### KN-API-074 读凭据 创建/列出/揭示/删除
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:JWT 已登录
- 步骤:
  1. `POST /warehouse/credentials/read` 创建
  2. `GET /warehouse/credentials/read` 列出
  3. `GET /warehouse/credentials/read/{credential_id}/secret` 揭示
  4. `DELETE /warehouse/credentials/read/{credential_id}` 删除
- 预期结果:创建/列出/揭示/删除全链路成功,secret 仅按需揭示

### KN-API-075 写凭据 创建/揭示/删除
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:JWT 已登录
- 步骤:
  1. `POST /warehouse/credentials/write` 创建
  2. `GET /warehouse/credentials/write/secret` 揭示
  3. `DELETE /warehouse/credentials/write` 删除
- 预期结果:写凭据创建/揭示/删除成功

### KN-API-076 浏览 Warehouse 目录
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:读凭据就绪
- 步骤:
  1. `GET /warehouse/browse?path=/apps/knowledge.yeying.pub/uploads`
- 预期结果:返回目录条目;非法/越权路径返回 400

### KN-API-077 上传文件与上传列表
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:写凭据就绪
- 步骤:
  1. `POST /warehouse/upload`(multipart 文件)
  2. `GET /warehouse/uploads`
- 预期结果:上传返回 UploadResponse;uploads 列出已上传文件

### KN-API-078 预览文件
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:已有可预览文件
- 步骤:
  1. `GET /warehouse/preview?path=...`
- 预期结果:返回文件预览内容/元数据

### KN-API-079 来源绑定 bindings 增删改查
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:知识库存在
- 步骤:
  1. `POST /kbs/{kb_id}/bindings` 创建
  2. `GET /kbs/{kb_id}/bindings` 列出
  3. `PATCH /kbs/{kb_id}/bindings/{binding_id}` 更新
  4. `DELETE /kbs/{kb_id}/bindings/{binding_id}` 删除
- 预期结果:绑定创建/列出/更新/删除全链路成功

### KN-UI-016 保存 S3 凭据并上传文件
- 优先级:P1
- 类型:E2E
- 状态:⬜ 待实现
- 前置条件:已认证会话进入工作台 Warehouse 面板
- 步骤:
  1. 填写 S3 Access Key / Secret / root path,点击"保存凭据"
  2. 选择文件,点击"上传文件"
- 预期结果:凭据保存成功(按钮态"正在保存"→恢复);文件上传成功并可见

---

## 十四、分析任务 Analysis Runs

### KN-API-080 创建分析任务
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:JWT 已登录,存在可分析文件(Warehouse CSV/Excel)
- 步骤:
  1. `POST /analysis-runs`,body 含文件路径、分析意图、max_rows
- 预期结果:返回 AgentRunRead,任务进入队列/运行

### KN-API-081 分析任务列表与详情
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:已创建分析任务
- 步骤:
  1. `GET /analysis-runs`
  2. `GET /analysis-runs/{run_id}`
- 预期结果:列表含任务;详情返回状态与元数据

### KN-API-082 分析任务事件与 SSE 流
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:任务存在
- 步骤:
  1. `GET /analysis-runs/{run_id}/events`
  2. `GET /analysis-runs/{run_id}/events/stream`(SSE)
- 预期结果:events 返回事件数组;stream 以 text/event-stream 推送事件

### KN-API-083 分析产物列表与下载
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:任务已产出产物
- 步骤:
  1. `GET /analysis-runs/{run_id}/artifacts`
  2. `GET /analysis-runs/{run_id}/artifacts/{artifact_id}/download`
- 预期结果:列出产物;下载返回文件字节

### KN-UI-017 创建分析任务并查看产物
- 优先级:P2
- 类型:E2E
- 状态:⬜ 待实现
- 前置条件:已认证会话进入"分析任务"面板
- 步骤:
  1. 填写文件路径与分析目标(或"选择已上传文件"),点击"创建分析任务"
  2. 在任务列表选择该任务,查看详情/事件/产物并点击"下载"
- 预期结果:任务创建成功并出现在列表;详情区展示事件与产物,可下载

---

## 十五、记忆 Memory

### KN-API-084 长期记忆增改删查
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:JWT 已登录
- 步骤:
  1. `POST /memory/long-term` 创建
  2. `GET /memory/long-term` 列出
  3. `PATCH /memory/long-term/{memory_id}` 更新
  4. `DELETE /memory/long-term/{memory_id}` 删除
- 预期结果:长期记忆创建/列出/更新/删除全链路成功

### KN-API-085 短期记忆增删查
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:JWT 已登录
- 步骤:
  1. `POST /memory/short-term` 创建
  2. `GET /memory/short-term` 列出
  3. `DELETE /memory/short-term/{memory_id}` 删除
- 预期结果:短期记忆创建/列出/删除成功

### KN-API-086 记忆摄取与事件
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:JWT 已登录
- 步骤:
  1. `POST /memory/ingest` 提交待摄取内容
  2. `GET /memory/ingestions` 查看事件
- 预期结果:摄取返回 MemoryIngestionResponse;事件列表记录本次摄取

---

## 十六、运维 Ops

### KN-API-087 运维概览
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:JWT 已登录(ops 路由整体要求鉴权)
- 步骤:
  1. `GET /ops/overview`
- 预期结果:返回系统概览统计结构

### KN-API-088 存储健康检查
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:JWT 已登录
- 步骤:
  1. `GET /ops/stores/health`
- 预期结果:返回数据库/向量库等存储健康状态

### KN-API-089 worker 状态与任务失败列表
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:JWT 已登录
- 步骤:
  1. `GET /ops/workers`
  2. `GET /ops/tasks/failures`
- 预期结果:返回 worker 运行状态与失败任务列表

### KN-API-090 无 token 访问 Ops 返回 401
- 优先级:P1
- 类型:API
- 状态:⬜ 待实现
- 前置条件:无
- 步骤:
  1. 不带 `Authorization` 请求 `GET /ops/overview`
- 预期结果:返回 401(ops 路由 `dependencies=[get_current_wallet]` 全局拦截)

---

## 十七、Agent Runs 服务编排

### KN-API-091 创建 agent run 及生命周期
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:JWT 已登录
- 步骤:
  1. `POST /service/runs` 创建运行
  2. `PUT /service/runs/{run_id}/context` 更新上下文
  3. 依次 `POST .../complete`、`.../fail`、`.../cancel`(分别验证)
- 预期结果:创建返回 AgentRunRead;各生命周期操作使 status 相应变化

### KN-API-092 agent run 只读子资源
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:run 存在
- 步骤:
  1. `GET /service/runs/{run_id}`
  2. `GET .../inputs`、`.../steps`、`.../events`、`.../artifacts`
- 预期结果:分别返回运行详情、输入、步骤、事件、产物列表

### KN-API-093 manifest 重试
- 优先级:P2
- 类型:API
- 状态:⬜ 待实现
- 前置条件:存在需重试 manifest 的 run
- 步骤:
  1. `POST /runs/{run_id}/manifest/retry`
- 预期结果:返回 AgentRunRead,manifest 重试被触发
</content>
</invoke>
