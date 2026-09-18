param([string]$OutputDirectory = "$PSScriptRoot\..\icons")

Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

foreach ($size in 192, 512) {
    $bitmap = [System.Drawing.Bitmap]::new($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([System.Drawing.Color]::FromArgb(23, 32, 42))
    $scale = $size / 512.0
    $top = [System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new(96*$scale,150*$scale),
        [System.Drawing.PointF]::new(256*$scale,64*$scale),
        [System.Drawing.PointF]::new(416*$scale,150*$scale),
        [System.Drawing.PointF]::new(256*$scale,236*$scale)
    )
    $left = [System.Drawing.PointF[]]@($top[0],$top[3],[System.Drawing.PointF]::new(256*$scale,426*$scale),[System.Drawing.PointF]::new(96*$scale,340*$scale))
    $right = [System.Drawing.PointF[]]@($top[3],$top[2],[System.Drawing.PointF]::new(416*$scale,340*$scale),[System.Drawing.PointF]::new(256*$scale,426*$scale))
    $graphics.FillPolygon([System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(111,208,255)),$top)
    $graphics.FillPolygon([System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(40,127,168)),$left)
    $graphics.FillPolygon([System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(58,164,204)),$right)
    $cellBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255,207,86))
    $graphics.FillRectangle($cellBrush,205*$scale,197*$scale,102*$scale,102*$scale)
    $path = Join-Path $OutputDirectory "icon-$size.png"
    $bitmap.Save($path,[System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose(); $bitmap.Dispose()
}
