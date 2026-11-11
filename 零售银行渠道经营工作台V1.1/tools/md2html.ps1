<#
.SYNOPSIS
  Markdown → 「阅读版」HTML 转换脚本（离线、仅依赖 PowerShell 5.1，无需 python / node）。

.DESCRIPTION
  把 PRD / Spec 的原始 Markdown 转成与交付清单一致的「阅读版」HTML：
  顶部带「← 返回交付清单」导航栏、900px 版心卡片样式，支持标题、表格、
  有序/无序列表、引用块、分隔线、加粗与行内 code。

.EXAMPLE
  # 最简用法：自动输出同名 .html，标题取 md 首个一级标题，meta 自动生成
  .\tools\md2html.ps1 -MdPath ..\零售银行\docs\prd\零售员工工作台_PRD_v1_5.md

.EXAMPLE
  # 指定输出路径与 meta（当前交付包中两份 PRD 就是用这两条命令生成的）
  .\tools\md2html.ps1 -MdPath "docs\prd\零售员工工作台_PRD_v1_5.md" -BarLabel "研发实施 PRD" `
      -Meta "来源：docs/prd/零售员工工作台_PRD_v1_5.md　·　版本：员工端 v1.5　·　状态：已评审　·　作者：蔡中琴" `
      -PageTitle "研发实施 PRD · 零售员工工作台 v1.5 · 零售银行渠道经营工作台"

  .\tools\md2html.ps1 -MdPath "docs\prd\零售团队长看板_PRD_v0_4.md" -BarLabel "研发实施 PRD" `
      -Meta "来源：docs/prd/零售团队长看板_PRD_v0_4.md　·　版本：团队长端 v0.4　·　状态：已评审　·　作者：蔡中琴" `
      -PageTitle "研发实施 PRD · 零售团队长看板 v0.4 · 零售银行渠道经营工作台"

.NOTES
  阅读版 HTML 是从 md 派生的中间产物；md 更新后重跑本脚本即可覆盖生成。
  返回导航固定指向 docs/零售银行渠道经营工作台_交付清单.html，因此输出文件应位于 docs 下一级目录（如 docs/prd）。
#>
param(
  [Parameter(Mandatory = $true)][string]$MdPath,
  [string]$HtmlPath,
  [string]$BarLabel = '研发实施 PRD',
  [string]$Meta,
  [string]$PageTitle
)

$ErrorActionPreference = 'Stop'

function Esc([string]$s) {
  return ($s -replace '&', '&amp;' -replace '<', '&lt;' -replace '>', '&gt;')
}

function Inline([string]$s) {
  $x = Esc $s
  $x = $x -replace '`([^`]+)`', '<code>$1</code>'
  $x = $x -replace '\*\*([^*]+)\*\*', '<strong>$1</strong>'
  return $x
}

$MdPath = (Resolve-Path -LiteralPath $MdPath).Path
if (-not $HtmlPath) {
  $HtmlPath = [System.IO.Path]::ChangeExtension($MdPath, '.html')
}

$t = [System.IO.File]::ReadAllText($MdPath)
$t = $t -replace "`r`n", "`n"
$lines = $t -split "`n"
$n = $lines.Count

if (-not $PageTitle) {
  $h1 = $lines | Where-Object { $_ -match '^#\s+(.*?)\s*$' } | Select-Object -First 1
  $PageTitle = if ($h1) { ($h1 -replace '^#\s+', '') + ' · 阅读版' } else { [System.IO.Path]::GetFileNameWithoutExtension($MdPath) }
}
if (-not $Meta) {
  $root = Split-Path -Parent $PSScriptRoot
  $rel = $MdPath
  if ($MdPath.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
    $rel = ($MdPath.Substring($root.Length) -replace '^[\\/]+', '')
  }
  $Meta = '来源：' + ($rel -replace '\\', '/') + '　·　状态：已评审　·　作者：蔡中琴'
}

$sb = New-Object System.Text.StringBuilder
$i = 0

while ($i -lt $n) {
  $line = $lines[$i]

  if ($line -match '^\s*$') { $i++; continue }

  # 标题
  if ($line -match '^(#{1,6})\s+(.*?)\s*$') {
    $h = $matches[1].Length
    [void]$sb.AppendLine("<h$h>" + (Inline $matches[2]) + "</h$h>")
    $i++; continue
  }

  # 分隔线
  if ($line -match '^\s*-{3,}\s*$') { [void]$sb.AppendLine('<hr>'); $i++; continue }

  # 表格
  if ($line -match '^\s*\|') {
    $rows = @()
    while ($i -lt $n -and $lines[$i] -match '^\s*\|') { $rows += $lines[$i]; $i++ }
    $parsed = @()
    foreach ($r in $rows) {
      $r2 = $r.Trim()
      $r2 = $r2 -replace '^\|', ''
      $r2 = $r2 -replace '\|$', ''
      $cells = @()
      foreach ($c in ($r2 -split '\|')) { $cells += $c.Trim() }
      $parsed += , $cells
    }
    [void]$sb.AppendLine('<table>')
    $bodyStart = 0
    if ($parsed.Count -ge 2 -and (($parsed[1] -join '') -match '^[\s\-:]+$')) {
      [void]$sb.AppendLine('<thead><tr>')
      foreach ($c in $parsed[0]) { [void]$sb.AppendLine('<th>' + (Inline $c) + '</th>') }
      [void]$sb.AppendLine('</tr></thead>')
      $bodyStart = 2
    }
    [void]$sb.AppendLine('<tbody>')
    for ($k = $bodyStart; $k -lt $parsed.Count; $k++) {
      [void]$sb.AppendLine('<tr>')
      foreach ($c in $parsed[$k]) { [void]$sb.AppendLine('<td>' + (Inline $c) + '</td>') }
      [void]$sb.AppendLine('</tr>')
    }
    [void]$sb.AppendLine('</tbody></table>')
    continue
  }

  # 引用块
  if ($line -match '^\s*>\s?') {
    $buf = @()
    while ($i -lt $n -and $lines[$i] -match '^\s*>\s?') {
      $buf += ($lines[$i] -replace '^\s*>\s?', '')
      $i++
    }
    $joined = (($buf | Where-Object { $_ -ne '' }) | ForEach-Object { Inline $_ }) -join '<br>'
    [void]$sb.AppendLine('<blockquote><p>' + $joined + '</p></blockquote>')
    continue
  }

  # 无序列表
  if ($line -match '^\s*[-*+]\s+(.*)$') {
    [void]$sb.AppendLine('<ul>')
    while ($i -lt $n -and $lines[$i] -match '^\s*[-*+]\s+(.*)$') {
      [void]$sb.AppendLine('<li>' + (Inline $matches[1]) + '</li>')
      $i++
    }
    [void]$sb.AppendLine('</ul>')
    continue
  }

  # 有序列表
  if ($line -match '^\s*\d+\.\s+(.*)$') {
    [void]$sb.AppendLine('<ol>')
    while ($i -lt $n -and $lines[$i] -match '^\s*\d+\.\s+(.*)$') {
      [void]$sb.AppendLine('<li>' + (Inline $matches[1]) + '</li>')
      $i++
    }
    [void]$sb.AppendLine('</ol>')
    continue
  }

  # 段落
  $para = @($line)
  $i++
  while ($i -lt $n -and $lines[$i] -notmatch '^\s*$' -and $lines[$i] -notmatch '^(#{1,6})\s' -and $lines[$i] -notmatch '^\s*\|' -and $lines[$i] -notmatch '^\s*>') {
    $para += $lines[$i]
    $i++
  }
  [void]$sb.AppendLine('<p>' + (Inline ($para -join ' ')) + '</p>')
}

$css = @'
:root{--ink:#1f2937;--muted:#6b7688;--line:#e5e6eb;--bg:#f6f7f9;--brand:#2f6bff}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.75 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
.bar{position:sticky;top:0;z-index:5;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 22px;background:#fff;border-bottom:1px solid var(--line);font-size:13px;color:var(--muted)}
.bar a{color:var(--brand);text-decoration:none;font-weight:600}
.doc{max-width:900px;margin:22px auto 60px;padding:30px 34px;background:#fff;border:1px solid var(--line);border-radius:14px}
.doc .meta{color:var(--muted);font-size:13px;margin:0 0 18px;padding-bottom:14px;border-bottom:1px dashed var(--line)}
.doc h1{font-size:24px;margin:0 0 10px}
.doc h2{font-size:19px;margin:26px 0 10px;padding-left:10px;border-left:4px solid var(--brand)}
.doc h3{font-size:16px;margin:20px 0 8px}
.doc h4,.doc h5{font-size:14.5px;margin:16px 0 6px;color:#374151}
.doc p{margin:0 0 10px}
.doc ul,.doc ol{margin:0 0 10px;padding-left:22px}
.doc li{margin:4px 0}
.doc code{font-family:Consolas,Menlo,monospace;font-size:12.5px;background:#f3f4f6;padding:1px 5px;border-radius:3px}
.doc pre{background:#f7f8fa;padding:12px 14px;border-radius:8px;overflow:auto}
.doc pre code{background:none;padding:0}
.doc table{width:100%;border-collapse:collapse;font-size:13.5px;margin:0 0 14px;table-layout:fixed}
.doc th,.doc td{border:1px solid var(--line);padding:8px 10px;text-align:left;vertical-align:top;word-break:break-word}
.doc th{background:#f7f8fa;font-weight:600}
.doc blockquote{margin:0 0 10px;padding:8px 14px;border-left:3px solid #cbd7ea;background:#f8fafc;color:var(--muted)}
.doc hr{border:none;border-top:1px solid var(--line);margin:20px 0}
.doc a{color:var(--brand)}
@media (max-width:720px){.doc{margin:12px;padding:20px 16px}.doc table{font-size:12.5px}}
'@

$html = @"
<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>$PageTitle</title>
<style>
$css
</style>
</head>
<body>
<header class="bar"><a href="../零售银行渠道经营工作台_交付清单.html">← 返回交付清单</a><span>$BarLabel</span></header>
<main class="doc">
  <p class="meta">$Meta</p>
$($sb.ToString().TrimEnd())
</main>
</body>
</html>
"@

$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($HtmlPath, $html, $enc)
Write-Output "written: $HtmlPath"
