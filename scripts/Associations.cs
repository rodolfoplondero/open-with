using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;

namespace ExternalOpen
{
    public sealed class ApplicationInfo
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public bool Recommended { get; set; }
    }

    // Interfaces retain native vtable order. HRESULTs are checked explicitly.
    [ComImport, Guid("F04061AC-1659-4A3F-A954-775AA57FC083"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IAssocHandler
    {
        [PreserveSig] int GetName([MarshalAs(UnmanagedType.LPWStr)] out string name);
        [PreserveSig] int GetUIName([MarshalAs(UnmanagedType.LPWStr)] out string name);
        [PreserveSig] int GetIconLocation([MarshalAs(UnmanagedType.LPWStr)] out string path, out int index);
        [PreserveSig] int IsRecommended();
        [PreserveSig] int MakeDefault([MarshalAs(UnmanagedType.LPWStr)] string description);
        [PreserveSig] int Invoke([MarshalAs(UnmanagedType.Interface)] IDataObject data);
        [PreserveSig] int CreateInvoker([MarshalAs(UnmanagedType.Interface)] IDataObject data, out IntPtr invoker);
    }

    [ComImport, Guid("973810AE-9599-4B88-9E4D-6EE98C9552DA"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IEnumAssocHandlers
    {
        [PreserveSig] int Next(uint count, [MarshalAs(UnmanagedType.Interface)] out IAssocHandler handler, out uint fetched);
    }

    [ComImport, Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IShellItem
    {
        [PreserveSig] int BindToHandler(IntPtr context, ref Guid handlerId, ref Guid interfaceId,
            [MarshalAs(UnmanagedType.Interface)] out IDataObject data);
        [PreserveSig] int GetParent(out IShellItem parent);
        [PreserveSig] int GetDisplayName(uint kind, out IntPtr name);
        [PreserveSig] int GetAttributes(uint mask, out uint attributes);
        [PreserveSig] int Compare(IShellItem other, uint hint, out int order);
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    internal struct OpenAsInfo
    {
        [MarshalAs(UnmanagedType.LPWStr)] public string File;
        [MarshalAs(UnmanagedType.LPWStr)] public string Class;
        public uint Flags;
    }

    public static class Associations
    {
        [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = true)]
        private static extern int SHAssocEnumHandlers(string extension, uint filter, out IEnumAssocHandlers handlers);
        [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = true)]
        private static extern int SHCreateItemFromParsingName(string path, IntPtr context, ref Guid interfaceId, out IShellItem item);
        [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = true)]
        private static extern int SHOpenWithDialog(IntPtr owner, ref OpenAsInfo info);

        private static void Release(object value)
        {
            if (value != null && Marshal.IsComObject(value)) Marshal.ReleaseComObject(value);
        }
        private static IEnumAssocHandlers Enumerate(string filePath)
        {
            string extension = Path.GetExtension(filePath);
            if (String.IsNullOrEmpty(extension)) return null;
            IEnumAssocHandlers handlers;
            int result = SHAssocEnumHandlers(extension, 1, out handlers); // ASSOC_FILTER_RECOMMENDED: only handlers recommended for this type
            // No association is an empty list, other errors remain visible to the caller.
            if (result == unchecked((int)0x80070483) || result == unchecked((int)0x80070490)) return null;
            Marshal.ThrowExceptionForHR(result);
            return handlers;
        }
        public static ApplicationInfo[] List(string filePath)
        {
            var result = new List<ApplicationInfo>();
            IEnumAssocHandlers handlers = Enumerate(filePath);
            if (handlers == null) return result.ToArray();
            try
            {
                while (true)
                {
                    IAssocHandler handler;
                    uint fetched;
                    int status = handlers.Next(1, out handler, out fetched);
                    Marshal.ThrowExceptionForHR(status);
                    if (fetched == 0) break;
                    try
                    {
                        string id, name;
                        if (handler.GetName(out id) < 0 || String.IsNullOrWhiteSpace(id)) continue;
                        if (handler.GetUIName(out name) < 0 || String.IsNullOrWhiteSpace(name)) name = id;
                        result.Add(new ApplicationInfo { Id = id, Name = name, Recommended = handler.IsRecommended() == 0 });
                    }
                    finally { Release(handler); }
                }
            }
            finally { Release(handlers); }
            return result.ToArray();
        }
        public static void Open(string filePath, string handlerId)
        {
            IEnumAssocHandlers handlers = Enumerate(filePath);
            if (handlers == null) throw new InvalidOperationException("O aplicativo selecionado nao esta mais associado ao arquivo.");
            try
            {
                while (true)
                {
                    IAssocHandler handler;
                    uint fetched;
                    int status = handlers.Next(1, out handler, out fetched);
                    Marshal.ThrowExceptionForHR(status);
                    if (fetched == 0) break;
                    try
                    {
                        string id;
                        if (handler.GetName(out id) < 0 || !String.Equals(id, handlerId, StringComparison.OrdinalIgnoreCase)) continue;
                        IShellItem item = null;
                        IDataObject data = null;
                        try
                        {
                            Guid shellItemId = new Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE");
                            Marshal.ThrowExceptionForHR(SHCreateItemFromParsingName(filePath, IntPtr.Zero, ref shellItemId, out item));
                            Guid dataHandlerId = new Guid("B8C0BD9F-ED24-455C-83E6-D5390C4FE8C4"); // BHID_DataObject
                            Guid dataInterfaceId = new Guid("0000010E-0000-0000-C000-000000000046");
                            Marshal.ThrowExceptionForHR(item.BindToHandler(IntPtr.Zero, ref dataHandlerId, ref dataInterfaceId, out data));
                            Marshal.ThrowExceptionForHR(handler.Invoke(data));
                            return;
                        }
                        finally { Release(data); Release(item); }
                    }
                    finally { Release(handler); }
                }
            }
            finally { Release(handlers); }
            throw new InvalidOperationException("O aplicativo selecionado nao esta mais disponivel. Abra a lista novamente.");
        }
        public static void Native(string filePath)
        {
            var info = new OpenAsInfo { File = filePath, Class = null, Flags = 4 }; // OAIF_EXEC, no registration flags
            int status = SHOpenWithDialog(IntPtr.Zero, ref info);
            if (status != unchecked((int)0x800704C7)) Marshal.ThrowExceptionForHR(status); // cancellation is normal
        }
    }
}
