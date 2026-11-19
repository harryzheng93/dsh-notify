# 发布指南 / Publishing guide

这个包目前是本地直连安装（profile 里是 `link:` 指向本目录）。要发布，先选一条路线。

## 发布前要做的一件事：改名

现在包名是 `@local/dsh-notify`，`@local` 不是能在 npm 上发布的 scope。发布前把这两处改成你
自己的名字（例如 `dsh-notify`，或 `@你的scope/dsh-notify`）：

- `package.json` 的 `name`
- `cordis.patch.yml` 里的 `name:`
- `market/index.example.json` 里插件的 `name`

改完要在 DSH 里重新安装一次（旧的 `link:` 依赖指向的是同一个目录，改名后需要更新 profile
依赖与 bundle 列表）。

## 路线 A：发到 npm

```powershell
npm login
npm publish --access public    # scoped 包需要 --access public
```

然后索引里这一版的来源写 npm：

```json
"source": { "type": "npm" }
```

## 路线 B：只放 git 仓库（不需要 npm 账号）

1. 把本目录推到一个公开仓库；
2. 取该提交的完整 SHA：`git rev-parse HEAD`（40 位十六进制）；
3. 索引里写：

```json
"source": { "type": "git", "url": "https://github.com/YOU/dsh-notify", "commit": "<40 位 SHA>" }
```

包在仓库子目录里时再加 `"path": "packages/dsh-notify"`。

## 市场索引怎么落地

DSH 的「插件市场」读的是**索引 JSON 的 URL**，索引是 `format: 1` 的文档，插件条目带中英文
`title` / `description`（`{ "en": …, "zh": … }`）。`market/index.example.json` 就是这个格式的
模板，把占位符换掉即可。

1. 把填好的 `index.json` 放到任意 HTTPS 可访问的位置（GitHub raw、Gist、Pages、自己的服务器都行）；
2. 在 DSH 里启用插件市场（当前 profile 里 `@deepseek-ai/dsh-experimental-plugin-market-bundle`
   是关闭的），设置里添加索引 URL；
3. 之后在 Discover 页里就能搜到并按索引里的来源安装。

## 官方市场

官方市场由 DeepSeek 那边收录，流程不在本机：把仓库/包名和这份索引条目交给官方渠道即可。
本机的准备工作（中英文文案、图标、详情页、索引条目）已经齐了。

## 发布前自检

```powershell
npm pack --dry-run     # 看打包清单是否包含 index.js、cordis.patch.yml、locale、docs、icon、README、LICENSE
node --check index.js
```

再从一个真实来源装一遍（npm 包名或 git 地址），确认「设置 → 插件」里标题和详情是中英文双份，
并发一条通知确认 toast 与点击回前台仍然有效。
