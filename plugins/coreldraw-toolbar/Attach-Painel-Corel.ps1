param(
  [string]$Side = "R",
  [int]$Width = 318
)
$ErrorActionPreference = "SilentlyContinue"

Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class IbdDockWin {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

  [DllImport("user32.dll")]
  public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);

  [DllImport("user32.dll")]
  public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

  [DllImport("user32.dll", EntryPoint = "SetWindowLong")]
  private static extern IntPtr SetWindowLong32(IntPtr hWnd, int nIndex, IntPtr dwNewLong);

  [DllImport("user32.dll", EntryPoint = "SetWindowLongPtr")]
  private static extern IntPtr SetWindowLongPtr64(IntPtr hWnd, int nIndex, IntPtr dwNewLong);

  public static IntPtr SetOwner(IntPtr child, IntPtr owner) {
    if (IntPtr.Size == 8) return SetWindowLongPtr64(child, -8, owner);
    return SetWindowLong32(child, -8, owner);
  }
}
"@

$htaHwnd = [IntPtr]::Zero
for ($i = 0; $i -lt 25; $i++) {
  $htaHwnd = [IbdDockWin]::FindWindow($null, "IBD Ferramentas - CorelDRAW")
  if ($htaHwnd -ne [IntPtr]::Zero) { break }
  Start-Sleep -Milliseconds 120
}
if ($htaHwnd -eq [IntPtr]::Zero) { exit 0 }

$corel = Get-Process -Name "CorelDRW" | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $corel) { exit 0 }

$corelHwnd = $corel.MainWindowHandle
[void][IbdDockWin]::SetOwner($htaHwnd, $corelHwnd)

$rc = New-Object IbdDockWin+RECT
if ([IbdDockWin]::GetWindowRect($corelHwnd, [ref]$rc)) {
  $top = $rc.Top + 132
  $h = [Math]::Max(420, ($rc.Bottom - $rc.Top) - 168)
  if ($Side -eq "L") {
    $x = $rc.Left + 8
    [void][IbdDockWin]::MoveWindow($htaHwnd, $x, $top, $Width, $h, $true)
  } elseif ($Side -eq "R") {
    $x = [Math]::Max($rc.Left + 8, $rc.Right - $Width - 10)
    [void][IbdDockWin]::MoveWindow($htaHwnd, $x, $top, $Width, $h, $true)
  }
}
[void][IbdDockWin]::SetWindowPos($htaHwnd, [IntPtr]::Zero, 0, 0, 0, 0, 0x0013)
