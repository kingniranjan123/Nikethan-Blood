Add-Type -Path "d:\anti-gravity-projects-II\Nikethan-Blood\scripts\bouncycastle\lib\BouncyCastle.Crypto.dll"
Add-Type -Path "d:\anti-gravity-projects-II\Nikethan-Blood\scripts\itextsharp\lib\itextsharp.dll"

$clientDir = "d:\anti-gravity-projects-II\Nikethan-Blood\Client List"
$outputPdf = Join-Path $clientDir "clients_register_compiled.pdf"

$images = Get-ChildItem -Path $clientDir -Include "*.jpeg", "*.jpg" -Recurse | Sort-Object Name

$doc = New-Object iTextSharp.text.Document
$pdfWriter = [iTextSharp.text.pdf.PdfWriter]::GetInstance($doc, [System.IO.File]::Create($outputPdf))
$doc.Open()

$first = $true
foreach ($imgFile in $images) {
    try {
        $img = [iTextSharp.text.Image]::GetInstance($imgFile.FullName)
        $img.ScaleToFit($doc.PageSize.Width - $doc.LeftMargin - $doc.RightMargin, $doc.PageSize.Height - $doc.TopMargin - $doc.BottomMargin)
        $img.Alignment = [iTextSharp.text.Image]::ALIGN_CENTER
        
        if (-not $first) {
            $doc.NewPage() | Out-Null
        }
        $doc.Add($img) | Out-Null
        $first = $false
    } catch {
        Write-Host "Error processing $($imgFile.Name): $_"
    }
}

$doc.Close()
Write-Host "PDF created successfully at $outputPdf with $($images.Count) pages!"
