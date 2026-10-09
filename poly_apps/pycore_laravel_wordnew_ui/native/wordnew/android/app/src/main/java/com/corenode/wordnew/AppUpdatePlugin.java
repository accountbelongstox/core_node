package com.corenode.wordnew;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.content.pm.SigningInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Pattern;

/**
 * In-place self update (contract app_downloads.auto_update): the installed identity (applicationId, versionCode,
 * signing certificate, build type), a resumable sha256-verified APK download into the app-private cache, and the
 * hand-off to the system package installer through the FileProvider. The installer is launched only for an APK of
 * this same package with the same signing certificate and a higher versionCode, so app data is never lost.
 * Cached APKs are removed once the app starts with a higher versionCode than the one recorded before.
 */
@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {
    private static final String UPDATE_DIR = "app_update";
    private static final String PART_SUFFIX = ".part";
    private static final String APK_MIME = "application/vnd.android.package-archive";
    private static final String PROVIDER_SUFFIX = ".fileprovider";
    private static final String PREFS_NAME = "core_node_app_update";
    private static final String PREF_LAST_VERSION_CODE = "last_version_code";
    private static final String META_BUILD_TYPE = "core_node.build_type";
    private static final String DEFAULT_BUILD_TYPE = "debug";
    private static final String ERROR_INVALID_REQUEST = "INVALID_REQUEST";
    private static final String ERROR_ABORTED = "ABORTED";
    private static final String ERROR_NETWORK = "NETWORK_ERROR";
    private static final String ERROR_HTTP = "HTTP_ERROR";
    private static final String ERROR_HASH_MISMATCH = "HASH_MISMATCH";
    private static final String ERROR_SIZE_MISMATCH = "SIZE_MISMATCH";
    private static final String ERROR_FILE_NOT_FOUND = "FILE_NOT_FOUND";
    private static final String ERROR_NEED_INSTALL_PERMISSION = "NEED_INSTALL_PERMISSION";
    private static final String ERROR_PACKAGE_MISMATCH = "PACKAGE_MISMATCH";
    private static final String ERROR_SIGNER_MISMATCH = "SIGNER_MISMATCH";
    private static final String ERROR_VERSION_NOT_NEWER = "VERSION_NOT_NEWER";
    private static final String ERROR_NO_HANDLER = "NO_HANDLER";
    private static final int CONNECT_TIMEOUT_MS = 15000;
    private static final int DEFAULT_IDLE_TIMEOUT_MS = 30000;
    private static final int READ_BUFFER_BYTES = 64 * 1024;
    private static final int MAX_REDIRECTS = 8;
    private static final int HTTP_OK = 200;
    private static final int HTTP_PARTIAL = 206;
    private static final int HTTP_RANGE_NOT_SATISFIABLE = 416;
    private static final long PROGRESS_EVENT_INTERVAL_MS = 250;
    private static final Pattern SAFE_FILE_NAME = Pattern.compile("^[A-Za-z0-9._-]{1,120}$");
    private static final Pattern PRIVATE_LAN_HTTP = Pattern.compile(
        "^http://(10\\.\\d{1,3}|172\\.(1[6-9]|2\\d|3[01])|192\\.168)\\.\\d{1,3}\\.\\d{1,3}(:\\d+)?/.*",
        Pattern.CASE_INSENSITIVE
    );
    private static final ExecutorService EXECUTOR = Executors.newFixedThreadPool(2);

    private final ConcurrentHashMap<String, AtomicBoolean> activeDownloads = new ConcurrentHashMap<>();

    @Override
    public void load() {
        cleanupAfterUpdate();
    }

    @Override
    protected void handleOnDestroy() {
        for (AtomicBoolean cancelled : activeDownloads.values()) {
            cancelled.set(true);
        }
    }

    @PluginMethod
    public void info(PluginCall call) {
        Context context = getContext();
        JSObject result = new JSObject();
        try {
            PackageInfo installed = packageInfo(context, context.getPackageName());
            List<String> signers = signerHashes(installed);
            JSArray signerList = new JSArray();
            for (String signer : signers) {
                signerList.put(signer);
            }
            result.put("applicationId", context.getPackageName());
            result.put("versionCode", versionCodeOf(installed));
            result.put("versionName", installed.versionName == null ? "" : installed.versionName);
            result.put("signerSha256", signers.isEmpty() ? "" : signers.get(0));
            result.put("signers", signerList);
        } catch (Exception error) {
            call.reject("Installed package info is unavailable", ERROR_INVALID_REQUEST, error);
            return;
        }
        result.put("buildType", buildType(context));
        result.put("canInstall", canRequestPackageInstalls(context));
        result.put("sdk", Build.VERSION.SDK_INT);
        call.resolve(result);
    }

    @PluginMethod
    public void canInstall(PluginCall call) {
        JSObject result = new JSObject();
        result.put("allowed", canRequestPackageInstalls(getContext()));
        call.resolve(result);
    }

    /** Opens the system "Install unknown apps" page of this app. */
    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
        } catch (ActivityNotFoundException error) {
            call.reject("Install settings page is unavailable", ERROR_NO_HANDLER, error);
            return;
        }
        call.resolve();
    }

    /**
     * Downloads {@code url} into the app-private update cache as {@code fileName} and verifies {@code sha256}. A file
     * already cached with the right hash resolves at once; an interrupted download resumes from its .part file
     * (HTTP Range). Reports {@code updateProgress} events.
     */
    @PluginMethod
    public void download(PluginCall call) {
        String url = call.getString("url", "").trim();
        String requestId = call.getString("requestId", "").trim();
        String fileName = call.getString("fileName", "").trim();
        String expectedSha = call.getString("sha256", "").trim().toLowerCase(Locale.ROOT);
        long expectedSize = call.getLong("size", 0L);
        int idleMs = call.getInt("idleTimeoutMs", DEFAULT_IDLE_TIMEOUT_MS);
        if (!(url.startsWith("https://") || PRIVATE_LAN_HTTP.matcher(url).matches()) || requestId.isEmpty()
            || !SAFE_FILE_NAME.matcher(fileName).matches() || expectedSha.length() != 64) {
            call.reject("AppUpdate download requires an HTTPS (or LAN http) URL, requestId, file name and sha256", ERROR_INVALID_REQUEST);
            return;
        }
        AtomicBoolean cancelled = new AtomicBoolean(false);
        if (activeDownloads.putIfAbsent(requestId, cancelled) != null) {
            call.reject("AppUpdate requestId is already active", ERROR_INVALID_REQUEST);
            return;
        }
        EXECUTOR.execute(() -> {
            try {
                File target = new File(updateDir(), fileName);
                if (target.isFile() && expectedSha.equals(sha256Of(target))) {
                    call.resolve(downloadResult(target, true));
                    return;
                }
                File part = new File(updateDir(), fileName + PART_SUFFIX);
                transfer(url, requestId, part, expectedSize, idleMs, cancelled);
                if (expectedSize > 0 && part.length() != expectedSize) {
                    part.delete();
                    call.reject("Downloaded size differs from the manifest", ERROR_SIZE_MISMATCH);
                    return;
                }
                if (!expectedSha.equals(sha256Of(part))) {
                    part.delete();
                    call.reject("Downloaded file does not match its sha256", ERROR_HASH_MISMATCH);
                    return;
                }
                if (target.exists() && !target.delete()) {
                    throw new IOException("Cannot replace " + target);
                }
                if (!part.renameTo(target)) {
                    throw new IOException("Cannot move " + part + " to " + target);
                }
                call.resolve(downloadResult(target, false));
            } catch (AbortedException aborted) {
                call.reject("Download was aborted", ERROR_ABORTED);
            } catch (HttpStatusException status) {
                call.reject("Download answered HTTP " + status.status, ERROR_HTTP, status);
            } catch (Exception error) {
                call.reject("Download failed: " + error.getMessage(), ERROR_NETWORK, error);
            } finally {
                activeDownloads.remove(requestId);
            }
        });
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        AtomicBoolean cancelled = activeDownloads.get(call.getString("requestId", "").trim());
        if (cancelled != null) {
            cancelled.set(true);
        }
        call.resolve();
    }

    /** Launches the system installer for a downloaded update after the package, signer and version checks. */
    @PluginMethod
    public void install(PluginCall call) {
        String fileName = call.getString("fileName", "").trim();
        if (!SAFE_FILE_NAME.matcher(fileName).matches()) {
            call.reject("AppUpdate install requires a file name", ERROR_INVALID_REQUEST);
            return;
        }
        File apk = new File(updateDir(), fileName);
        if (!apk.isFile()) {
            call.reject("Update file is missing", ERROR_FILE_NOT_FOUND);
            return;
        }
        Context context = getContext();
        if (!canRequestPackageInstalls(context)) {
            call.reject("Installing unknown apps is not allowed for this app yet", ERROR_NEED_INSTALL_PERMISSION);
            return;
        }
        try {
            PackageInfo installed = packageInfo(context, context.getPackageName());
            PackageInfo archive = archiveInfo(context, apk);
            if (archive == null || !context.getPackageName().equals(archive.packageName)) {
                call.reject("Update file is for another package", ERROR_PACKAGE_MISMATCH);
                return;
            }
            List<String> installedSigners = signerHashes(installed);
            List<String> archiveSigners = signerHashes(archive);
            if (installedSigners.isEmpty() || !installedSigners.equals(archiveSigners)) {
                call.reject("Update file has another signing certificate", ERROR_SIGNER_MISMATCH);
                return;
            }
            if (versionCodeOf(archive) <= versionCodeOf(installed)) {
                call.reject("Update file is not newer than the installed app", ERROR_VERSION_NOT_NEWER);
                return;
            }
            Uri uri = FileProvider.getUriForFile(context, context.getPackageName() + PROVIDER_SUFFIX, apk);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, APK_MIME);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
        } catch (ActivityNotFoundException error) {
            call.reject("No package installer is available", ERROR_NO_HANDLER, error);
            return;
        } catch (Exception error) {
            call.reject("Update install could not start: " + error.getMessage(), ERROR_INVALID_REQUEST, error);
            return;
        }
        call.resolve();
    }

    /** Removes every cached update file except {@code keepFileName}, when given. */
    @PluginMethod
    public void cleanup(PluginCall call) {
        String keep = call.getString("keepFileName", "").trim();
        File[] files = updateDir().listFiles();
        int removed = 0;
        if (files != null) {
            for (File file : files) {
                if (!keep.isEmpty() && (file.getName().equals(keep) || file.getName().equals(keep + PART_SUFFIX))) {
                    continue;
                }
                if (file.delete()) {
                    removed += 1;
                }
            }
        }
        JSObject result = new JSObject();
        result.put("removed", removed);
        call.resolve(result);
    }

    private void cleanupAfterUpdate() {
        try {
            Context context = getContext();
            long current = versionCodeOf(packageInfo(context, context.getPackageName()));
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            long previous = prefs.getLong(PREF_LAST_VERSION_CODE, 0L);
            if (previous != 0L && current > previous) {
                File[] files = updateDir().listFiles();
                if (files != null) {
                    for (File file : files) {
                        file.delete();
                    }
                }
            }
            if (previous != current) {
                prefs.edit().putLong(PREF_LAST_VERSION_CODE, current).apply();
            }
        } catch (Exception ignored) {
            // The cache is cleaned again on the next start.
        }
    }

    private File updateDir() {
        File directory = new File(getContext().getCacheDir(), UPDATE_DIR);
        if (!directory.isDirectory()) {
            directory.mkdirs();
        }
        return directory;
    }

    private JSObject downloadResult(File file, boolean cached) {
        JSObject result = new JSObject();
        result.put("fileName", file.getName());
        result.put("bytes", file.length());
        result.put("cached", cached);
        return result;
    }

    private void transfer(String url, String requestId, File part, long expectedSize, int idleMs, AtomicBoolean cancelled) throws Exception {
        boolean restarted = false;
        while (true) {
            long existing = part.isFile() ? part.length() : 0L;
            if (expectedSize > 0 && existing > expectedSize) {
                part.delete();
                existing = 0L;
            }
            if (expectedSize > 0 && existing == expectedSize) {
                return;
            }
            HttpURLConnection connection = open(url, existing, idleMs);
            try {
                int status = connection.getResponseCode();
                if (status == HTTP_RANGE_NOT_SATISFIABLE && existing > 0 && !restarted) {
                    part.delete();
                    restarted = true;
                    continue;
                }
                if (status != HTTP_OK && status != HTTP_PARTIAL) {
                    throw new HttpStatusException(status);
                }
                boolean append = status == HTTP_PARTIAL && existing > 0;
                long total = connection.getContentLengthLong();
                total = total > 0 ? total + (append ? existing : 0L) : expectedSize;
                copy(connection, requestId, part, append, append ? existing : 0L, total, cancelled);
                return;
            } finally {
                connection.disconnect();
            }
        }
    }

    private HttpURLConnection open(String url, long resumeFrom, int idleMs) throws IOException {
        String current = url;
        for (int redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
            HttpURLConnection connection = (HttpURLConnection) new URL(current).openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
            connection.setReadTimeout(idleMs > 0 ? idleMs : DEFAULT_IDLE_TIMEOUT_MS);
            connection.setRequestProperty("Accept-Encoding", "identity");
            if (resumeFrom > 0) {
                connection.setRequestProperty("Range", "bytes=" + resumeFrom + "-");
            }
            int status = connection.getResponseCode();
            if (status >= 300 && status < 400) {
                String location = connection.getHeaderField("Location");
                connection.disconnect();
                if (location == null || location.isEmpty()) {
                    throw new IOException("Redirect without a location");
                }
                String next = new URL(new URL(current), location).toString();
                if (!(next.startsWith("https://") || PRIVATE_LAN_HTTP.matcher(next).matches())) {
                    throw new IOException("Redirect to an insecure address");
                }
                current = next;
                continue;
            }
            return connection;
        }
        throw new IOException("Too many redirects");
    }

    private void copy(HttpURLConnection connection, String requestId, File part, boolean append, long written, long total, AtomicBoolean cancelled) throws Exception {
        byte[] buffer = new byte[READ_BUFFER_BYTES];
        long lastEventAt = 0L;
        try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(part, append)) {
            int read;
            while ((read = input.read(buffer)) != -1) {
                if (cancelled.get()) {
                    throw new AbortedException();
                }
                output.write(buffer, 0, read);
                written += read;
                long now = System.currentTimeMillis();
                if (now - lastEventAt >= PROGRESS_EVENT_INTERVAL_MS) {
                    lastEventAt = now;
                    notifyProgress(requestId, written, total);
                }
            }
            output.getFD().sync();
        }
        notifyProgress(requestId, written, total);
    }

    private void notifyProgress(String requestId, long bytes, long total) {
        JSObject event = new JSObject();
        event.put("requestId", requestId);
        event.put("bytes", bytes);
        event.put("total", total);
        notifyListeners("updateProgress", event);
    }

    private static String sha256Of(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = new FileInputStream(file)) {
            byte[] buffer = new byte[READ_BUFFER_BYTES];
            int read;
            while ((read = input.read(buffer)) != -1) {
                digest.update(buffer, 0, read);
            }
        }
        return hex(digest.digest());
    }

    private static String hex(byte[] bytes) {
        StringBuilder text = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) {
            text.append(String.format(Locale.ROOT, "%02x", value));
        }
        return text.toString();
    }

    @SuppressWarnings("deprecation")
    private static PackageInfo packageInfo(Context context, String packageName) throws PackageManager.NameNotFoundException {
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        return context.getPackageManager().getPackageInfo(packageName, flags);
    }

    @SuppressWarnings("deprecation")
    private static PackageInfo archiveInfo(Context context, File apk) {
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        return context.getPackageManager().getPackageArchiveInfo(apk.getAbsolutePath(), flags);
    }

    @SuppressWarnings("deprecation")
    private static long versionCodeOf(PackageInfo info) {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? info.getLongVersionCode() : info.versionCode;
    }

    @SuppressWarnings("deprecation")
    private static List<String> signerHashes(PackageInfo info) throws Exception {
        List<String> hashes = new ArrayList<>();
        Signature[] signatures = null;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            SigningInfo signing = info.signingInfo;
            if (signing != null) {
                signatures = signing.getApkContentsSigners();
            }
        } else {
            signatures = info.signatures;
        }
        if (signatures == null) {
            return hashes;
        }
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        for (Signature signature : signatures) {
            hashes.add(hex(digest.digest(signature.toByteArray())));
        }
        return hashes;
    }

    private static boolean canRequestPackageInstalls(Context context) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O || context.getPackageManager().canRequestPackageInstalls();
    }

    private static String buildType(Context context) {
        try {
            ApplicationInfo application = context.getPackageManager().getApplicationInfo(context.getPackageName(), PackageManager.GET_META_DATA);
            String value = application.metaData == null ? null : application.metaData.getString(META_BUILD_TYPE);
            return value == null || value.isEmpty() ? DEFAULT_BUILD_TYPE : value;
        } catch (PackageManager.NameNotFoundException error) {
            return DEFAULT_BUILD_TYPE;
        }
    }

    private static final class AbortedException extends Exception {
    }

    private static final class HttpStatusException extends IOException {
        final int status;

        HttpStatusException(int status) {
            super("HTTP " + status);
            this.status = status;
        }
    }
}
