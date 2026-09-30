package com.corenode.wordnew;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.StatFs;
import android.os.storage.StorageManager;
import android.os.storage.StorageVolume;
import android.provider.Settings;

import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.util.ArrayDeque;

/**
 * Storage volumes of the device (internal app data, shared storage, removable
 * SD cards) with capacity and free space, all-files access for public folders,
 * directory usage, and FileProvider hand-off of a stored file to other apps.
 * File I/O itself stays in the official Filesystem plugin (absolute paths).
 */
@CapacitorPlugin(
    name = "DeviceStorage",
    permissions = {
        @Permission(
            alias = DeviceStoragePlugin.STORAGE_ALIAS,
            strings = { Manifest.permission.READ_EXTERNAL_STORAGE, Manifest.permission.WRITE_EXTERNAL_STORAGE }
        )
    }
)
public class DeviceStoragePlugin extends Plugin {
    static final String STORAGE_ALIAS = "storage";
    private static final String KIND_INTERNAL = "internal";
    private static final String KIND_SHARED = "shared";
    private static final String KIND_REMOVABLE = "removable";
    private static final String APP_DATA_SEGMENT = "/Android/data/";
    private static final String PROVIDER_SUFFIX = ".fileprovider";
    private static final String DEFAULT_MIME = "application/octet-stream";
    private static final String ERROR_PATH_REQUIRED = "PATH_REQUIRED";
    private static final String ERROR_FILE_NOT_FOUND = "FILE_NOT_FOUND";
    private static final String ERROR_NO_HANDLER = "NO_HANDLER";
    private static final String ERROR_OUTSIDE_PROVIDER = "OUTSIDE_PROVIDER";

    @PluginMethod
    public void volumes(PluginCall call) {
        Context context = getContext();
        JSArray volumes = new JSArray();
        volumes.put(describe(context, context.getFilesDir(), KIND_INTERNAL, 0));
        File[] external = context.getExternalFilesDirs(null);
        for (int index = 0; index < external.length; index++) {
            File directory = external[index];
            if (directory == null) continue;
            String kind = Environment.isExternalStorageRemovable(directory) ? KIND_REMOVABLE : KIND_SHARED;
            volumes.put(describe(context, directory, kind, index));
        }
        JSObject result = new JSObject();
        result.put("volumes", volumes);
        result.put("allFilesAccess", hasAllFilesAccess());
        call.resolve(result);
    }

    @PluginMethod
    public void directoryStats(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.isEmpty()) {
            call.reject(ERROR_PATH_REQUIRED);
            return;
        }
        getBridge().execute(() -> {
            long bytes = 0;
            long files = 0;
            ArrayDeque<File> pending = new ArrayDeque<>();
            pending.push(toFile(path));
            while (!pending.isEmpty()) {
                File current = pending.pop();
                File[] children = current.listFiles();
                if (children == null) continue;
                for (File child : children) {
                    if (child.isDirectory()) {
                        pending.push(child);
                    } else {
                        bytes += child.length();
                        files += 1;
                    }
                }
            }
            JSObject result = new JSObject();
            result.put("bytes", bytes);
            result.put("files", files);
            call.resolve(result);
        });
    }

    @PluginMethod
    public void checkAllFilesAccess(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", hasAllFilesAccess());
        result.put("settingsPage", Build.VERSION.SDK_INT >= Build.VERSION_CODES.R);
        call.resolve(result);
    }

    /** Android 11+: the system "All files access" page; older: the storage permission dialog. */
    @PluginMethod
    public void requestAllFilesAccess(PluginCall call) {
        if (hasAllFilesAccess()) {
            checkAllFilesAccess(call);
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Intent intent = new Intent(
                Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION,
                Uri.parse("package:" + getContext().getPackageName())
            );
            try {
                startActivityForResult(call, intent, "allFilesAccessResult");
            } catch (ActivityNotFoundException error) {
                startActivityForResult(call, new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION), "allFilesAccessResult");
            }
            return;
        }
        requestPermissionForAlias(STORAGE_ALIAS, call, "storagePermissionResult");
    }

    @ActivityCallback
    private void allFilesAccessResult(PluginCall call, ActivityResult result) {
        checkAllFilesAccess(call);
    }

    @PermissionCallback
    private void storagePermissionResult(PluginCall call) {
        checkAllFilesAccess(call);
    }

    @PluginMethod
    public void openFile(PluginCall call) {
        handOff(call, Intent.ACTION_VIEW);
    }

    @PluginMethod
    public void shareFile(PluginCall call) {
        handOff(call, Intent.ACTION_SEND);
    }

    private void handOff(PluginCall call, String action) {
        String path = call.getString("path");
        String mimeType = call.getString("mimeType", DEFAULT_MIME);
        if (path == null || path.isEmpty()) {
            call.reject(ERROR_PATH_REQUIRED);
            return;
        }
        File file = toFile(path);
        if (!file.isFile()) {
            call.reject(ERROR_FILE_NOT_FOUND);
            return;
        }
        Uri uri;
        try {
            uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + PROVIDER_SUFFIX, file);
        } catch (IllegalArgumentException error) {
            call.reject(ERROR_OUTSIDE_PROVIDER, error);
            return;
        }
        Intent intent = new Intent(action);
        if (Intent.ACTION_SEND.equals(action)) {
            intent.setType(mimeType);
            intent.putExtra(Intent.EXTRA_STREAM, uri);
        } else {
            intent.setDataAndType(uri, mimeType);
        }
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        Intent chooser = Intent.createChooser(intent, file.getName());
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(chooser);
        } catch (ActivityNotFoundException error) {
            call.reject(ERROR_NO_HANDLER, error);
            return;
        }
        call.resolve();
    }

    private boolean hasAllFilesAccess() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            return Environment.isExternalStorageManager();
        }
        return getPermissionState(STORAGE_ALIAS) == PermissionState.GRANTED;
    }

    private static File toFile(String path) {
        Uri uri = Uri.parse(path);
        return "file".equals(uri.getScheme()) ? new File(uri.getPath()) : new File(path);
    }

    private JSObject describe(Context context, File appDirectory, String kind, int index) {
        JSObject volume = new JSObject();
        String appPath = appDirectory.getAbsolutePath();
        File root = volumeRoot(context, appDirectory);
        StatFs stat = new StatFs(appPath);
        volume.put("id", kind + ":" + index);
        volume.put("kind", kind);
        volume.put("label", volumeLabel(context, appDirectory));
        volume.put("appPath", appPath);
        volume.put("rootPath", root.getAbsolutePath());
        volume.put("totalBytes", stat.getTotalBytes());
        volume.put("freeBytes", stat.getAvailableBytes());
        volume.put("state", KIND_INTERNAL.equals(kind) ? Environment.MEDIA_MOUNTED : Environment.getExternalStorageState(appDirectory));
        volume.put("removable", KIND_REMOVABLE.equals(kind));
        return volume;
    }

    private static File volumeRoot(Context context, File appDirectory) {
        String path = appDirectory.getAbsolutePath();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            StorageVolume volume = context.getSystemService(StorageManager.class).getStorageVolume(appDirectory);
            if (volume != null && volume.getDirectory() != null) return volume.getDirectory();
        }
        int marker = path.indexOf(APP_DATA_SEGMENT);
        return marker > 0 ? new File(path.substring(0, marker)) : appDirectory;
    }

    private static String volumeLabel(Context context, File appDirectory) {
        StorageVolume volume = context.getSystemService(StorageManager.class).getStorageVolume(appDirectory);
        return volume != null ? volume.getDescription(context) : "";
    }
}
