param(
  [string]$Hwnd = "0",
  [string]$Title = "MyBrowser",
  [string]$Text = "",
  [string]$Url = ""
)

Add-Type -AssemblyName System.Windows.Forms
$null = [Windows.ApplicationModel.DataTransfer.DataTransferManager, Windows.ApplicationModel.DataTransfer, ContentType=WindowsRuntime]
$null = [Windows.ApplicationModel.DataTransfer.DataPackage, Windows.ApplicationModel.DataTransfer, ContentType=WindowsRuntime]
$null = [Windows.ApplicationModel.DataTransfer.DataRequestedEventArgs, Windows.ApplicationModel.DataTransfer, ContentType=WindowsRuntime]

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class WinShareInterop {
  [DllImport("combase.dll", PreserveSig = false)]
  private static extern void RoGetActivationFactory([MarshalAs(UnmanagedType.HString)] string classId, [In] ref Guid iid, out IntPtr factory);

  [ComImport, Guid("3A3DCD6C-3EAB-43DC-BCDE-45671CE800C8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  private interface IDataTransferManagerInterop {
    IntPtr GetForWindow([In] IntPtr appWindow, [In] ref Guid riid);
    void ShowShareUIForWindow(IntPtr appWindow);
  }

  public static object GetManager(IntPtr hwnd, out object interopObj) {
    Guid iidInterop = new Guid("3A3DCD6C-3EAB-43DC-BCDE-45671CE800C8");
    IntPtr factoryPtr;
    RoGetActivationFactory("Windows.ApplicationModel.DataTransfer.DataTransferManager", ref iidInterop, out factoryPtr);
    var interop = (IDataTransferManagerInterop)Marshal.GetObjectForIUnknown(factoryPtr);
    Marshal.Release(factoryPtr);
    Guid iidDtm = new Guid("A5CAEE9B-8708-49D1-8D36-67D25A8DA00C");
    IntPtr dtmPtr = interop.GetForWindow(hwnd, ref iidDtm);
    object dtm = Marshal.GetObjectForIUnknown(dtmPtr);
    Marshal.Release(dtmPtr);
    interopObj = interop;
    return dtm;
  }

  public static void ShowUI(object interopObj, IntPtr hwnd) {
    ((IDataTransferManagerInterop)interopObj).ShowShareUIForWindow(hwnd);
  }
}
"@

# نافذة مضيفة مخفية مملوكة لنفس العملية لأن Windows WinRT يرفض HWND مملوكاً لعملية أخرى
$form = New-Object System.Windows.Forms.Form
$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
$form.ShowInTaskbar = $false
$form.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
$form.Size = New-Object System.Drawing.Size(1, 1)
$form.Opacity = 0.01
$form.TopMost = $true

$shareTitle = if ([string]::IsNullOrWhiteSpace($Title)) { "MyBrowser" } else { $Title }
$shareText = $Text
$shareUrl = $Url
$script:interop = $null
$script:dtm = $null

$form.Add_Shown({
  try {
    $h = $form.Handle
    $interopLocal = $null
    $dtmLocal = [WinShareInterop]::GetManager($h, [ref]$interopLocal)
    $script:interop = $interopLocal
    $script:dtm = $dtmLocal
    $dtmLocal.add_DataRequested({
      param($sender, $args)
      try {
        $dp = $args.Request.Data
        $dp.Properties.Title = $shareTitle
        if (-not [string]::IsNullOrWhiteSpace($shareText)) {
          $dp.Properties.Description = $shareText
          $dp.SetText($shareText)
        } elseif (-not [string]::IsNullOrWhiteSpace($shareUrl)) {
          $dp.Properties.Description = $shareUrl
          $dp.SetText($shareUrl)
        }
        if ($shareUrl -match '^https?://') {
          $dp.SetWebLink([Uri]$shareUrl)
        }
      } catch {}
    }) | Out-Null
    [WinShareInterop]::ShowUI($interopLocal, $h)
  } catch {
    Write-Error $_
    $form.Close()
  }
})

# إغلاق تلقائي هادئ بعد 30 ثانية حتى لا تبقى أي عملية في الخلفية
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 30000
$timer.Add_Tick({ $timer.Stop(); $form.Close() })
$timer.Start()

[System.Windows.Forms.Application]::Run($form)
