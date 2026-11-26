using System;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using Windows.ApplicationModel.DataTransfer;

static class Program {
  [DllImport("combase.dll", PreserveSig = false)]
  private static extern void RoGetActivationFactory([MarshalAs(UnmanagedType.HString)] string classId, [In] ref Guid iid, out IntPtr factory);

  [DllImport("user32.dll")]
  private static extern bool SetForegroundWindow(IntPtr hWnd);

  [ComImport, Guid("3A3DCD6C-3EAB-43DC-BCDE-45671CE800C8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  private interface IDataTransferManagerInterop {
    IntPtr GetForWindow([In] IntPtr appWindow, [In] ref Guid riid);
    void ShowShareUIForWindow(IntPtr appWindow);
  }

  [STAThread]
  static void Main(string[] args) {
    string title = args.Length > 0 && !string.IsNullOrWhiteSpace(args[0]) ? args[0] : "MyBrowser";
    string text = args.Length > 1 ? args[1] : "";
    string url = args.Length > 2 ? args[2] : "";

    Application.EnableVisualStyles();
    var form = new Form {
      FormBorderStyle = FormBorderStyle.None,
      ShowInTaskbar = false,
      StartPosition = FormStartPosition.CenterScreen,
      Size = new Size(360, 240),
      BackColor = Color.Magenta,
      TransparencyKey = Color.Magenta,
      TopMost = true
    };

    IDataTransferManagerInterop interop = null;
    DataTransferManager dtm = null;
    bool shown = false;

    form.Shown += (s, e) => {
      if (shown) return;
      shown = true;
      try {
        SetForegroundWindow(form.Handle);
        form.Activate();
        Guid iidInterop = new Guid("3A3DCD6C-3EAB-43DC-BCDE-45671CE800C8");
        IntPtr factoryPtr;
        RoGetActivationFactory("Windows.ApplicationModel.DataTransfer.DataTransferManager", ref iidInterop, out factoryPtr);
        interop = (IDataTransferManagerInterop)Marshal.GetObjectForIUnknown(factoryPtr);
        Marshal.Release(factoryPtr);

        Guid iidDtm = new Guid("A5CAEE9B-8708-49D1-8D36-67D25A8DA00C");
        IntPtr dtmPtr = interop.GetForWindow(form.Handle, ref iidDtm);
        dtm = (DataTransferManager)Marshal.GetObjectForIUnknown(dtmPtr);
        Marshal.Release(dtmPtr);

        dtm.DataRequested += (sender, ev) => {
          try {
            var dp = ev.Request.Data;
            dp.Properties.Title = title;
            if (!string.IsNullOrWhiteSpace(text)) {
              dp.Properties.Description = text;
              dp.SetText(text);
            } else if (!string.IsNullOrWhiteSpace(url)) {
              dp.Properties.Description = url;
              dp.SetText(url);
            }
            Uri uri;
            if (!string.IsNullOrWhiteSpace(url) && Uri.TryCreate(url, UriKind.Absolute, out uri) && (uri.Scheme == "http" || uri.Scheme == "https")) {
              dp.SetWebLink(uri);
            }
          } catch {}
        };

        var delay = new Timer { Interval = 80 };
        delay.Tick += (s2, e2) => {
          delay.Stop();
          try {
            SetForegroundWindow(form.Handle);
            interop.ShowShareUIForWindow(form.Handle);
          } catch {
            form.Close();
          }
        };
        delay.Start();
      } catch {
        form.Close();
      }
    };

    var autoClose = new Timer { Interval = 35000 };
    autoClose.Tick += (s, e) => { autoClose.Stop(); form.Close(); };
    autoClose.Start();

    Application.Run(form);
  }
}
