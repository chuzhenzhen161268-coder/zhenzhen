<#
.SYNOPSIS
  原型双写闸门：校验「原型源文件」与「docs/pages 渲染版」是否逐行一致。

.DESCRIPTION
  两份文件唯一允许的差异是 React 引导方式：
    源文件（设计工具导出）：<script src="./support.js"></script>
    渲染版（可独立运行）  ：react.production.min.js + react-dom.production.min.js + support.js
  剔除渲染版中的 2 行 vendor React 引用后，两份必须逐行完全一致。

  改完原型后跑一次本脚本：一致则退出码 0；不一致会打印差异位置并以退出码 1 结束；
  文件缺失或定位不到唯一目标时以退出码 2 结束。

.EXAMPLE
  .\tools\check-proto-sync.ps1

.EXAMPLE
  .\tools\check-proto-sync.ps1 -RenderedPath "docs\pages\v1.5-v0.4零售银行渠道经营工作台_原型.html"
#>
param(
  [string]$SourcePath,
  [string]$RenderedPath
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

# 渲染版允许存在的 React 引导行
$vendorPattern = '<script\s+src="\./vendor/react(?:-dom)?\.production\.min\.js"></script>'

function Resolve-One {
  param([string]$Explicit, [string]$Dir, [string]$Filter, [string]$Label)

  if ($Explicit) {
    $full = if ([System.IO.Path]::IsPathRooted($Explicit)) { $Explicit } else { Join-Path $root $Explicit }
    if (-not (Test-Path -LiteralPath $full)) {
      Write-Host "[FAIL] $Label 不存在：$full" -ForegroundColor Red
      exit 2
    }
    return (Resolve-Path -LiteralPath $full).Path
  }

  $hits = @(Get-ChildItem -LiteralPath (Join-Path $root $Dir) -Recurse -File -Filter $Filter |
            Where-Object { $_.FullName -notmatch '[\\/]archive[\\/]' })
  if ($hits.Count -ne 1) {
    Write-Host "[FAIL] 期望在 $Dir 下唯一命中 $Filter 作为$Label，实际命中 $($hits.Count) 个：" -ForegroundColor Red
    $hits | ForEach-Object { Write-Host "         $($_.FullName)" }
    Write-Host "         请用 -SourcePath / -RenderedPath 显式指定。" -ForegroundColor Red
    exit 2
  }
  return $hits[0].FullName
}

$src = Resolve-One -Explicit $SourcePath  -Dir 'prototypes'  -Filter '*.dc.html' -Label '原型源文件'
$ren = Resolve-One -Explicit $RenderedPath -Dir 'docs\pages' -Filter '*.html'     -Label '原型渲染版'

$srcLines    = [IO.File]::ReadAllLines($src)
$renAllLines = [IO.File]::ReadAllLines($ren)
$vendorLines = @($renAllLines | Where-Object { $_ -match $vendorPattern })
$renLines    = @($renAllLines | Where-Object { $_ -notmatch $vendorPattern })

Write-Host "源文件   $src  ($($srcLines.Count) 行)"
Write-Host "渲染版   $ren  ($($renAllLines.Count) 行，含 React 引导 $($vendorLines.Count) 行)"

$fail = $false

# 1. 渲染版必须挂全 React 两件套，否则无法独立打开
if ($vendorLines.Count -ne 2) {
  Write-Host "[FAIL] 渲染版 React 引导异常：期望 2 行（react + react-dom），实际 $($vendorLines.Count) 行，渲染版可能无法独立打开。" -ForegroundColor Red
  $fail = $true
}

# 2. 剔除引导差异后逐行严格比对
if ($srcLines.Count -ne $renLines.Count) {
  Write-Host "[FAIL] 行数不一致：源文件 $($srcLines.Count) 行 vs 渲染版剔除引导后 $($renLines.Count) 行。" -ForegroundColor Red
  $fail = $true
}
else {
  $diffs = New-Object System.Collections.Generic.List[int]
  for ($i = 0; $i -lt $srcLines.Count; $i++) {
    if ($srcLines[$i] -cne $renLines[$i]) { $diffs.Add($i) }
  }
  if ($diffs.Count -gt 0) {
    Write-Host "[FAIL] 发现 $($diffs.Count) 处内容差异，前 5 处：" -ForegroundColor Red
    foreach ($i in ($diffs | Select-Object -First 5)) {
      $s = $srcLines[$i]; if ($s.Length -gt 120) { $s = $s.Substring(0, 120) + '...' }
      $r = $renLines[$i]; if ($r.Length -gt 120) { $r = $r.Substring(0, 120) + '...' }
      Write-Host "         第 $($i + 1) 行"
      Write-Host "           源文件: $s"
      Write-Host "           渲染版: $r"
    }
    $fail = $true
  }
}

if ($fail) {
  Write-Host "[FAIL] 原型双写不同步：请把改动同时落到两份文件后重跑。" -ForegroundColor Red
  exit 1
}

Write-Host "[OK] 原型双写一致（仅 React 引导差异，属允许项）。" -ForegroundColor Green
exit 0
