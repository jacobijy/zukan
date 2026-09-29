<#
.SYNOPSIS
  从 Linux 开发机通过 SFTP 轮询拉取 mp-weixin 的 dev 产物到本地，
  供微信开发者工具导入并自动刷新。

.DESCRIPTION
  Windows 零安装方案：只依赖系统自带的 OpenSSH 客户端 sftp.exe 和 robocopy。
  每轮先把远端产物整目录下载到临时目录，再用 robocopy /MIR 镜像到本地
  （含删除同步），传输失败时保留本地上一版。Mac 用户直接用同目录的
  pull-mp-weixin.sh 即可；追求毫秒级实时建议改用 Mutagen。

  先决条件：
    1) Win10 1809+ / Win11（自带 OpenSSH 客户端；设置 → 应用 → 可选功能里确认）
    2) 能 ssh 免密登录 Linux。Windows 没有 ssh-copy-id，用这行上传公钥：
         type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh $REMOTE "cat >> ~/.ssh/authorized_keys"
       （没有密钥就先 ssh-keygen -t ed25519）

  运行（右键“使用 PowerShell 运行”可能受执行策略限制，建议命令行）：
    powershell -ExecutionPolicy Bypass -File scripts\remote-debug\pull-mp-weixin.ps1

  地址与路径优先读同目录 pull.conf.sh / pull.conf.local（见该文件头注释）。
  也可用环境变量（或同名 - 参数）覆盖：
    REMOTE=user@host REMOTE_DIR=/path LOCAL_DIR=C:\path INTERVAL=2 SSH_KEY=C:\path\id_ed25519
#>
param(
    [string]$Remote = $(if ($env:REMOTE) { $env:REMOTE } else { '' }),
    [string]$RemoteDir = $(if ($env:REMOTE_DIR) { $env:REMOTE_DIR } else { '' }),
    [string]$LocalDir = $(if ($env:LOCAL_DIR) { $env:LOCAL_DIR } else { '' }),
    [int]$Interval = $(if ($env:INTERVAL) { [int]$env:INTERVAL } else { -1 }),
    [string]$SshKey = $env:SSH_KEY
)

# ── 配置文件：先 .local（本地覆盖，不提交），再基线配置；后读的覆盖前者 ──
# 只在调用方没显式给值时回填，优先级：参数/环境变量 > pull.conf.local > pull.conf.sh > 内置默认
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$conf = @{}
foreach ($f in @("pull.conf.sh", "pull.conf.local")) {
    $p = Join-Path $scriptDir $f
    if (Test-Path $p) {
        Get-Content $p | Where-Object { $_ -match '^\s*(?!\s*#)([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$' } |
            ForEach-Object {
                $m = $_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$'
                if ($m) {
                    $v = $m[2].Trim()
                    $v = ($v -split '\s+#', 2)[0].Trim()   # 剥行内注释
                    $v = $v.Trim('"').Trim("'")
                    $conf[$m[1]] = $v
                }
            }
    }
}

if (-not $Remote)    { $Remote    = if ($conf.REMOTE)     { $conf.REMOTE }     else { 'jacobi@192.168.100.100' } }
if (-not $RemoteDir) { $RemoteDir = if ($conf.MP_REMOTE_DIR) { $conf.MP_REMOTE_DIR } else { '/home/jacobi/Code/zukan/dist/dev/mp-weixin' } }
if (-not $LocalDir)  { $LocalDir  = if ($conf.MP_LOCAL_DIR)  { $conf.MP_LOCAL_DIR }  else { Join-Path $HOME 'zukan-mp-weixin' } }
if ($Interval -lt 0) { $Interval  = if ($conf.INTERVAL)       { [int]$conf.INTERVAL }     else { 2 } }

# 配置文件里的 $HOME 与 ~/ 展开（配置文件跨平台共用，写法照 sh 习惯）
$LocalDir = $LocalDir.Replace('$HOME', $HOME)
if ($LocalDir -like '~/*') { $LocalDir = Join-Path $HOME ($LocalDir.Substring(2)) }

# 临时目录根：Windows 上恒有 TEMP；非 Windows / 未设置时回落到系统默认临时路径
$tempRoot = $env:TEMP
if (-not $tempRoot) { $tempRoot = [System.IO.Path]::GetTempPath() }

# 清理上次异常退出残留的临时目录（仅本进程前缀，不动其他实例）
Get-ChildItem $tempRoot -Directory -Filter "mp-weixin-pull-$PID-*" -ErrorAction SilentlyContinue |
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

New-Item -ItemType Directory -Force -Path $LocalDir | Out-Null

Write-Host "从 ${Remote}:$RemoteDir"
Write-Host "  → $LocalDir（SFTP 下载 + robocopy /MIR，每 ${Interval}s 轮询，Ctrl-C 停止）"

while ($true) {
    $stamp = Get-Date -Format 'HH:mm:ss'
    $tmp = Join-Path $tempRoot "mp-weixin-pull-$PID-$([guid]::NewGuid().Guid)"
    New-Item -ItemType Directory -Path $tmp | Out-Null
    try {
        # BatchMode=yes：只走密钥/已知主机，绝不卡在密码或指纹交互提示上
        $sftpArgs = @('-b', '-', '-o', 'BatchMode=yes')
        if ($SshKey) { $sftpArgs += @('-i', $SshKey) }
        $sftpArgs += $Remote

        "lcd `"$tmp`"", "get -R `"$RemoteDir`" mp" | & sftp @sftpArgs
        if ($LASTEXITCODE -ne 0) {
            throw "sftp 退出码 $LASTEXITCODE（检查免密密钥、主机指纹、远端路径）"
        }
        $downloaded = Join-Path $tmp 'mp'
        if (-not (Test-Path $downloaded)) {
            throw 'sftp 未取回任何文件（远端目录是否存在？）'
        }

        # robocopy 退出码 < 8 均为成功：0 无变化 / 1 有复制 / 2 有删除 / 3 两者
        & robocopy $downloaded $LocalDir /MIR /NFL /NDL /NJH /NJS /NP /R:1 /W:1 | Out-Null
        if ($LASTEXITCODE -ge 8) {
            throw "robocopy 退出码 $LASTEXITCODE"
        }
        Write-Host "[$stamp] 已同步"
    }
    catch {
        Write-Warning "[$stamp] 本轮同步失败：$($_.Exception.Message)；保留本地上一版，${Interval}s 后重试"
    }
    finally {
        Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds $Interval
}
