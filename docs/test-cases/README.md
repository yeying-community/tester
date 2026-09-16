# 端到端测试用例总览

以测试人员视角整理的各产品**应有** E2E 测试用例,作为自动化实现的依据。
每个产品一份文档,用例按功能模块分组,标注优先级(P0/P1/P2)、类型(UI/API/DAPP/DATA/E2E)、
状态(✅ 已实现并链接到 spec / ⬜ 待实现)与完整的前置条件·步骤·预期结果。

## 进度总览

| 产品 | 文档 | 用例数 | ✅ 已实现 | ⬜ 待实现 | 完成度 |
| --- | --- | ---: | ---: | ---: | ---: |
| 仓库 Warehouse | [warehouse.md](warehouse.md) | 91 | 66 | 25 | 73% |
| 节点 Node | [node.md](node.md) | 50 | 38 | 12 | 76% |
| 路由 Router | [router.md](router.md) | 79 | 47 | 32 | 60% |
| 钱包 Wallet | [wallet.md](wallet.md) | 56 | 41 | 15 | 73% |
| 对话 Chat | [chat.md](chat.md) | 92 | 5 | 87 | 5% |
| 社交 Social | [social.md](social.md) | 87 | 65 | 22 | 75% |
| 项目 Project | [project.md](project.md) | 141 | 105 | 36 | 74% |
| 知识库 Knowledge | [knowledge.md](knowledge.md) | 110 | 5 | 105 | 5% |
| 智能体 Agent | [agent.md](agent.md) | 58 | 4 | 54 | 7% |
| 应用市场 Marketplace | [marketplace.md](marketplace.md) | 59 | 5 | 54 | 8% |
| 文档 Books | [books.md](books.md) | 35 | 4 | 31 | 11% |
| **合计** | | **858** | **385** | **473** | **45%** |

## 使用方式

- **实现测试时**:挑一个产品文档,从 P0 的 ⬜ 待实现用例做起;每落地一条,把状态改为
  ✅ 并补上对应 spec 路径,同步更新该文档的覆盖总览表与本页进度表的计数。
- **状态口径**:「已实现」以*逻辑用例*是否被现有 spec 覆盖为准(一条逻辑用例可能对应多个
  spec test 块,也可能多条逻辑用例合并进一个 spec)。本目录是用例的唯一事实来源:记录
  「每个产品应该有哪些用例、还差哪些」,而 `products/<name>/tests/*.spec.ts` 是这些用例的
  自动化实现。

## 各产品重点缺口

**Warehouse** — P0 + P1 已补齐(负向鉴权基线、撤销 AccessKey 拒绝、S3 SigV4 真实 ListBuckets、公开/定向分享全生命周期与只读写拒绝、WebDAV 增删改、回收站、配额限额、改密、admin 用户管理、SIWE 重放拒绝、大文件上传/重命名 UI)。剩余待建(P2/整片):logout/邮箱验证码/UCAN 登录、WebDAV COPY/OPTIONS/404、AccessKey 追加绑定、文件预览/排序/冲突 UI、清空回收站、二次分享与 audiences、通知整片、分组整片、管理员删改用户。

**Node** — P0 + P1 已补齐(未过审发布 403、写操作签名信封校验、真实 SIWE 端到端登录、受保护路由守卫、refresh 轮换/logout 撤销、应用可见范围与非属主 403、TOTP/PKCE 身份能力、草稿编辑与 apply-to-use 流程)。剩余待建(P2/需管理员):健康别名/就绪 503、verify 负路径、i18n 与应用检索 UI、审核发布全链路(ND-E2E-003/004 缺管理员审批)、下线恢复、草稿重名检查、身份状态查询/Passkey 注册。

**Router** — P0 + P1 已补齐(混合信封契约、SIWE 负路径与 nonce 一次性、admin 越权 403、未登录重定向、令牌更新/删除、models API-key 门禁、登录/会话 UI、充值订单基线、兑换码)。剩余待建(P2/整片):OpenAI 兼容中继整块(models / chat/completions 扣额度、未实现端点、DISABLE_OPENAI_COMPAT、路由日志)、充值订单全流转(刷新/取消/套餐预览/状态机)、余额汇总/批次/兑换记录、账户设置改名改密 E2E、challenge 自动注册拒绝、refresh 换发、大小写登录、限流、侧栏/语言/模型/额度/令牌交互 UI。

**Wallet** — P0 + P1 已补齐(dApp 侧负路径 4001 拒绝、EIP-2255 权限与链切换审批、私钥/keystore 导入与负向校验、dApp 触发交易审批窗、密码/导入校验、删除账户、RPC 回退、reveal/改密守卫、代币与交易详情)。剩余待建(P2):非法私钥导入报错、收款二维码/导出账户、编辑/删除自定义网络、默认网络切换、清空历史、通讯录、ReCap/watchAsset/accountsChanged/eth_accounts 空/审批超时/并发复用、多次错误解锁处理。

**Chat** — LLM 会话主路径(流式回复 / 停止响应中断 / 无效 key 优雅报错)、钱包 SIWE 登录准入、
Router 令牌选择、Provider 代理转发。整个业务链路(登录门槛之后)现为冒烟层覆盖。

**Social** — P0 + P1 已补齐(邮箱+密码与 web3-identity SIWE 双路径签发、鉴权守卫、SIWE nonce 一次性与错误签名拒绝、好友/建群/私聊+群聊收发、消息历史/撤回/离线/已读、媒体上传、刷新/改密/绑钱包、导航/设置/登出 UI)。剩余待建(P2/整片):refresh 负路径、改密旧码错误、过期 token 拒绝、钱包登录/注册页/二维码轮询 UI、解绑钱包、注销、在线状态、免打扰、AI(改写/建议/摘要)、RTC(配置/信令/通话)、图片语音发送/群 @/通话面板 UI。注:web3-graph/incentive 后端为空壳,未纳入。

**Project**(夜莺/DooTask)— P0 + P1 已补齐(登录签发 token、`ret=-1`/身份失效鉴权守卫、admin 越权 403、项目/列/任务/工作流/成员/标签/文件/汇报/搜索/令牌/账号 API、仪表盘与 SPA 导航、UI 建项目向导与看板加卡)。因 admin 账号被验证码锁、钱包 SIWE 命中 setup_token 门,用例改用开放注册的临时账号跑通;共享 MySQL 下用宽超时 + 单次重试稳过。剩余待建(P2/整片):图形验证码、passport 轮询、user/counts 角标、404 页、项目移交/置顶/排序、复制任务、任务聊天室、消息与群组 UI、汇报模板、改邮箱/设备登出/删号、令牌审计与 AK/SK 头、部门管理、联系人/文件/消息搜索、demo 账号。

**Knowledge** — SIWE 登录换双令牌、受保护接口 401 基线、知识库创建、Search Lab 三模式检索对比、
面向 Agent 的服务检索(`X-Service-Api-Key`)。实为完整知识运营系统,17 个模块业务链路全待建。

**Agent** — 钱包 SIWE 换会话 Cookie 主流程、错误签名拒绝、会话校验 401、受保护目录 401、
Messenger 实例创建与生命周期。

**Marketplace** — 完整技能包 schema 全字段校验、index↔packages 一致性、path/toolServers 引用完整性、
(id,lang) 唯一性。现有 spec 仅校验轻量索引的少数字段。

**Books** — SUMMARY 链接目标文件存在(死链校验)、章节孤儿检测、硬断言而非缺失即跳过。
已发现真实死链:`agent/README.md` 内 SUMMARY 链接写成绝对路径且缺 `opensource/` 段。
