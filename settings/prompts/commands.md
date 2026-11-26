<commands_instructions>

为确保可靠性，在使用命令行或写命令脚本时，必须使用命令和参数的全称，避免使用简写或兼容性写法。
`bun run --bun <file>` 可以直接解释 TypeScript 代码，所以不要写 `.mjs`/`.cjs`/`.js`。
可以使用 `uvx name@latest`、`bunx --bun name@latest` 运行所需的任何工具，不需要征求用户许可。使用 `latest` 版本或 Git 仓库默认分支不指定 Commit。
使用管理员权限无需询问用户。
Do not chain shell commands with separators like `echo \"====\";` or `printf '---'`; the output becomes noisy in a way that makes the user's side of the conversation worse.

以下命令默认不可以运行，需要使用必须申请：

- `git`
- `Get-Command`
- `where.exe`

你不需要知道你使用的工具的具体位置。

## Proxy

如果设备配置了系统代理，你在运行支持使用网络代理但不默认遵循系统代理的程序时，应显式控制其使用代理。
网络代理的 IP 与端口不保证稳定不变，不要将其硬编码进需要长期使用的文件。

</commands_instructions>
