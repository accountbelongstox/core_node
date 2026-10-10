package com.corenode.wordnew;

import android.content.ClipData;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.webkit.MimeTypeMap;

import androidx.core.content.IntentCompat;
import androidx.core.content.pm.ShortcutInfoCompat;
import androidx.core.content.pm.ShortcutManagerCompat;
import androidx.core.graphics.drawable.IconCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Logger;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Share target of the app: files, images, audio, video, documents and text other apps send through the share
 * sheet (ACTION_SEND / ACTION_SEND_MULTIPLE, including Direct Share shortcuts). Every stream is copied off the
 * main thread into the app-private cache and queued in a small JSON file, so a share that started the app
 * survives until the page takes it and calls clear. Sharing shortcuts published by the page put targets in the
 * top row of the share sheet.
 */
@CapacitorPlugin(name = "ShareReceiver")
public class ShareReceiverPlugin extends Plugin {
    static final String SHARE_CATEGORY_SUFFIX = ".category.SHARE_TARGET";
    private static final String EVENT_SHARE_RECEIVED = "shareReceived";
    private static final String EXTRA_SHORTCUT_ID = "android.intent.extra.shortcut.ID";
    private static final String INBOX_DIRECTORY = "shared-inbox";
    private static final String QUEUE_FILE = "share-queue.json";
    private static final String QUEUE_TEMP_FILE = "share-queue.json.tmp";
    private static final String TEXT_FILE_NAME = "shared-text.txt";
    private static final String TEXT_MIME = "text/plain";
    private static final String DEFAULT_MIME = "application/octet-stream";
    private static final String FALLBACK_NAME = "shared-file";
    private static final long MAX_FILE_BYTES = 256L * 1024L * 1024L;
    private static final int MAX_TEXT_CHARS = 1024 * 1024;
    private static final int MAX_NAME_LENGTH = 120;
    private static final int MAX_SHORTCUT_LABEL = 40;
    private static final int COPY_BUFFER_BYTES = 64 * 1024;

    private final Object queueLock = new Object();
    private final ExecutorService worker = Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "ShareReceiver");
        thread.setDaemon(true);
        return thread;
    });
    private JSONArray queue;

    @Override
    public void load() {
        worker.execute(this::removeOrphanDirectories);
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        boolean isShare = Intent.ACTION_SEND.equals(action) || Intent.ACTION_SEND_MULTIPLE.equals(action);
        if (!isShare || (intent.getFlags() & Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0) return;
        final List<Uri> uris = collectUris(intent);
        final String text = uris.isEmpty() ? textOf(intent) : null;
        final String targetId = intent.getStringExtra(EXTRA_SHORTCUT_ID);
        final String intentMime = intent.getType();
        intent.setAction(Intent.ACTION_MAIN);
        if (uris.isEmpty() && text == null) return;
        worker.execute(() -> {
            try {
                ingest(uris, text, targetId, intentMime);
            } catch (Exception error) {
                Logger.error(getLogTag(), "Share ingest failed", error);
            }
        });
    }

    @PluginMethod
    public void getPending(PluginCall call) {
        JSObject result = new JSObject();
        synchronized (queueLock) {
            try {
                result.put("batches", new JSArray(loadQueue().toString()));
            } catch (JSONException error) {
                result.put("batches", new JSArray());
            }
        }
        call.resolve(result);
    }

    @PluginMethod
    public void clear(PluginCall call) {
        final JSArray ids = call.getArray("ids");
        worker.execute(() -> {
            JSObject result = new JSObject();
            result.put("removed", removeItems(ids));
            call.resolve(result);
        });
    }

    @PluginMethod
    public void publishShareTargets(PluginCall call) {
        JSArray targets = call.getArray("targets");
        Context context = getContext();
        List<ShortcutInfoCompat> shortcuts = new ArrayList<>();
        try {
            PackageManager packageManager = context.getPackageManager();
            Intent launch = packageManager.getLaunchIntentForPackage(context.getPackageName());
            if (launch == null) {
                call.reject("NO_LAUNCH_INTENT");
                return;
            }
            Set<String> categories = Collections.singleton(context.getPackageName() + SHARE_CATEGORY_SUFFIX);
            IconCompat icon = IconCompat.createWithResource(context, context.getApplicationInfo().icon);
            int limit = Math.min(ShortcutManagerCompat.getMaxShortcutCountPerActivity(context), 8);
            int count = targets == null ? 0 : targets.length();
            for (int index = 0; index < count && shortcuts.size() < limit; index++) {
                JSONObject target = targets.optJSONObject(index);
                String id = target == null ? "" : target.optString("id", "").trim();
                String label = target == null ? "" : target.optString("label", "").trim();
                if (id.isEmpty()) continue;
                if (label.isEmpty()) label = id;
                if (label.length() > MAX_SHORTCUT_LABEL) label = label.substring(0, MAX_SHORTCUT_LABEL);
                shortcuts.add(new ShortcutInfoCompat.Builder(context, id)
                    .setShortLabel(label)
                    .setLongLabel(label)
                    .setIcon(icon)
                    .setIntent(new Intent(launch))
                    .setCategories(categories)
                    .setLongLived(true)
                    .setRank(shortcuts.size())
                    .build());
            }
            if (shortcuts.isEmpty()) {
                ShortcutManagerCompat.removeAllDynamicShortcuts(context);
            } else {
                ShortcutManagerCompat.setDynamicShortcuts(context, shortcuts);
            }
        } catch (Exception error) {
            call.reject("PUBLISH_FAILED", error.getMessage());
            return;
        }
        JSObject result = new JSObject();
        result.put("published", shortcuts.size());
        call.resolve(result);
    }

    private List<Uri> collectUris(Intent intent) {
        Set<Uri> uris = new LinkedHashSet<>();
        if (Intent.ACTION_SEND_MULTIPLE.equals(intent.getAction())) {
            ArrayList<Uri> streams = IntentCompat.getParcelableArrayListExtra(intent, Intent.EXTRA_STREAM, Uri.class);
            if (streams != null) {
                for (Uri uri : streams) if (uri != null) uris.add(uri);
            }
        } else {
            Uri stream = IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri.class);
            if (stream != null) uris.add(stream);
        }
        ClipData clip = intent.getClipData();
        if (clip != null) {
            for (int index = 0; index < clip.getItemCount(); index++) {
                Uri uri = clip.getItemAt(index).getUri();
                if (uri != null) uris.add(uri);
            }
        }
        return new ArrayList<>(uris);
    }

    private String textOf(Intent intent) {
        CharSequence text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        if (text == null) return null;
        String value = text.toString();
        if (value.trim().isEmpty()) return null;
        return value.length() > MAX_TEXT_CHARS ? value.substring(0, MAX_TEXT_CHARS) : value;
    }

    private void ingest(List<Uri> uris, String text, String targetId, String intentMime) throws Exception {
        long receivedAt = System.currentTimeMillis();
        String batchId = UUID.randomUUID().toString();
        File batchDirectory = new File(inboxRoot(), batchId);
        if (!batchDirectory.mkdirs()) throw new IOException("Cannot create " + batchDirectory);
        JSONArray items = new JSONArray();
        int index = 0;
        if (text != null) {
            File target = new File(batchDirectory, TEXT_FILE_NAME);
            byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
            try (OutputStream output = new FileOutputStream(target)) {
                output.write(bytes);
            }
            items.put(itemJson(batchId, index++, TEXT_FILE_NAME, TEXT_MIME, bytes.length, target, text, receivedAt));
        }
        for (Uri uri : uris) {
            try {
                JSONObject item = copyUri(uri, batchId, batchDirectory, index, intentMime, receivedAt);
                if (item != null) items.put(item);
                index++;
            } catch (Exception error) {
                Logger.warn(getLogTag(), "Skipped unreadable shared Uri " + uri + ": " + error.getMessage());
            }
        }
        if (items.length() == 0) {
            deleteRecursively(batchDirectory);
            return;
        }
        JSONObject batch = new JSONObject();
        batch.put("batchId", batchId);
        batch.put("items", items);
        if (targetId != null && !targetId.isEmpty()) batch.put("targetId", targetId);
        synchronized (queueLock) {
            loadQueue().put(batch);
            saveQueue();
        }
        notifyListeners(EVENT_SHARE_RECEIVED, new JSObject(batch.toString()), true);
    }

    private JSONObject copyUri(Uri uri, String batchId, File batchDirectory, int index, String intentMime, long receivedAt) throws Exception {
        if (isOwnPrivateFile(uri)) {
            Logger.warn(getLogTag(), "Skipped shared Uri inside the app's private storage: " + uri);
            return null;
        }
        ContentResolver resolver = getContext().getContentResolver();
        String displayName = null;
        long declaredSize = -1;
        try (Cursor cursor = resolver.query(uri, new String[] { OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE }, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int nameColumn = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                int sizeColumn = cursor.getColumnIndex(OpenableColumns.SIZE);
                if (nameColumn >= 0 && !cursor.isNull(nameColumn)) displayName = cursor.getString(nameColumn);
                if (sizeColumn >= 0 && !cursor.isNull(sizeColumn)) declaredSize = cursor.getLong(sizeColumn);
            }
        } catch (Exception ignored) {
        }
        if (declaredSize > MAX_FILE_BYTES) {
            Logger.warn(getLogTag(), "Skipped shared Uri over the size cap (" + declaredSize + " bytes): " + uri);
            return null;
        }
        String mime = resolver.getType(uri);
        if (mime == null || mime.isEmpty() || mime.contains("*")) {
            mime = intentMime != null && !intentMime.contains("*") ? intentMime : null;
        }
        if (displayName == null || displayName.trim().isEmpty()) displayName = uri.getLastPathSegment();
        String name = uniqueName(batchDirectory, sanitizeName(displayName, mime, index));
        if (mime == null) mime = mimeFromName(name);
        File target = new File(batchDirectory, name);
        long written = 0;
        try (InputStream input = resolver.openInputStream(uri)) {
            if (input == null) throw new IOException("No stream");
            try (OutputStream output = new FileOutputStream(target)) {
                byte[] buffer = new byte[COPY_BUFFER_BYTES];
                int read;
                while ((read = input.read(buffer)) != -1) {
                    written += read;
                    if (written > MAX_FILE_BYTES) {
                        output.close();
                        target.delete();
                        Logger.warn(getLogTag(), "Skipped shared Uri over the size cap: " + uri);
                        return null;
                    }
                    output.write(buffer, 0, read);
                }
            }
        } catch (Exception error) {
            target.delete();
            throw error;
        }
        return itemJson(batchId, index, name, mime, written, target, null, receivedAt);
    }

    private JSONObject itemJson(String batchId, int index, String name, String mime, long size, File file, String text, long receivedAt) throws JSONException {
        JSONObject item = new JSONObject();
        item.put("id", batchId + "-" + index);
        item.put("name", name);
        item.put("mimeType", mime == null ? DEFAULT_MIME : mime);
        item.put("size", size);
        item.put("path", file.getAbsolutePath());
        if (text != null) item.put("text", text);
        item.put("receivedAt", receivedAt);
        return item;
    }

    private boolean isOwnPrivateFile(Uri uri) {
        if (!"file".equals(uri.getScheme()) || uri.getPath() == null) return false;
        try {
            String path = new File(uri.getPath()).getCanonicalPath();
            String dataRoot = getContext().getDataDir().getCanonicalPath();
            return path.equals(dataRoot) || path.startsWith(dataRoot + File.separator);
        } catch (IOException error) {
            return true;
        }
    }

    private String sanitizeName(String raw, String mime, int index) {
        String name = raw == null ? "" : raw;
        int slash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
        if (slash >= 0) name = name.substring(slash + 1);
        name = name.replaceAll("[\\p{Cntrl}:*?\"<>|]", "_").trim();
        while (name.startsWith(".")) name = name.substring(1);
        if (name.length() > MAX_NAME_LENGTH) {
            int dot = name.lastIndexOf('.');
            String extension = dot > 0 && name.length() - dot <= 12 ? name.substring(dot) : "";
            name = name.substring(0, MAX_NAME_LENGTH - extension.length()) + extension;
        }
        if (name.isEmpty()) name = FALLBACK_NAME + "-" + (index + 1);
        if (name.lastIndexOf('.') < 0 && mime != null) {
            String extension = MimeTypeMap.getSingleton().getExtensionFromMimeType(mime);
            if (extension != null) name = name + "." + extension;
        }
        return name;
    }

    private String uniqueName(File directory, String name) {
        if (!new File(directory, name).exists()) return name;
        int dot = name.lastIndexOf('.');
        String stem = dot > 0 ? name.substring(0, dot) : name;
        String extension = dot > 0 ? name.substring(dot) : "";
        for (int counter = 2; ; counter++) {
            String candidate = stem + "-" + counter + extension;
            if (!new File(directory, candidate).exists()) return candidate;
        }
    }

    private String mimeFromName(String name) {
        int dot = name.lastIndexOf('.');
        if (dot >= 0) {
            String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(name.substring(dot + 1).toLowerCase(Locale.ROOT));
            if (mime != null) return mime;
        }
        return DEFAULT_MIME;
    }

    private File inboxRoot() {
        return new File(getContext().getCacheDir(), INBOX_DIRECTORY);
    }

    private int removeItems(JSArray ids) {
        int removed = 0;
        synchronized (queueLock) {
            JSONArray current = loadQueue();
            if (ids == null) {
                for (int index = 0; index < current.length(); index++) {
                    JSONArray items = current.optJSONObject(index).optJSONArray("items");
                    removed += items == null ? 0 : items.length();
                }
                queue = new JSONArray();
                saveQueue();
                deleteRecursively(inboxRoot());
                return removed;
            }
            Set<String> wanted = new LinkedHashSet<>();
            for (int index = 0; index < ids.length(); index++) {
                String id = ids.optString(index, "");
                if (!id.isEmpty()) wanted.add(id);
            }
            JSONArray kept = new JSONArray();
            for (int index = 0; index < current.length(); index++) {
                JSONObject batch = current.optJSONObject(index);
                if (batch == null) continue;
                JSONArray items = batch.optJSONArray("items");
                JSONArray keptItems = new JSONArray();
                for (int itemIndex = 0; items != null && itemIndex < items.length(); itemIndex++) {
                    JSONObject item = items.optJSONObject(itemIndex);
                    if (item == null) continue;
                    if (wanted.contains(item.optString("id"))) {
                        new File(item.optString("path")).delete();
                        removed++;
                    } else {
                        keptItems.put(item);
                    }
                }
                if (keptItems.length() > 0) {
                    try {
                        batch.put("items", keptItems);
                        kept.put(batch);
                    } catch (JSONException ignored) {
                    }
                } else {
                    deleteRecursively(new File(inboxRoot(), batch.optString("batchId")));
                }
            }
            queue = kept;
            saveQueue();
        }
        return removed;
    }

    private JSONArray loadQueue() {
        if (queue != null) return queue;
        File file = new File(getContext().getFilesDir(), QUEUE_FILE);
        JSONArray loaded = new JSONArray();
        if (file.isFile()) {
            try (InputStream input = new java.io.FileInputStream(file)) {
                java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
                byte[] buffer = new byte[COPY_BUFFER_BYTES];
                int read;
                while ((read = input.read(buffer)) != -1) bytes.write(buffer, 0, read);
                JSONArray stored = new JSONArray(new String(bytes.toByteArray(), StandardCharsets.UTF_8));
                for (int index = 0; index < stored.length(); index++) {
                    JSONObject batch = stored.optJSONObject(index);
                    if (batch != null && batchFilesExist(batch)) loaded.put(batch);
                }
            } catch (Exception error) {
                Logger.warn(getLogTag(), "Share queue unreadable, starting empty: " + error.getMessage());
            }
        }
        queue = loaded;
        return queue;
    }

    private boolean batchFilesExist(JSONObject batch) {
        JSONArray items = batch.optJSONArray("items");
        if (items == null || items.length() == 0) return false;
        for (int index = 0; index < items.length(); index++) {
            JSONObject item = items.optJSONObject(index);
            if (item == null || !new File(item.optString("path")).isFile()) return false;
        }
        return true;
    }

    private void saveQueue() {
        File directory = getContext().getFilesDir();
        File temp = new File(directory, QUEUE_TEMP_FILE);
        File target = new File(directory, QUEUE_FILE);
        try (OutputStream output = new FileOutputStream(temp)) {
            output.write(loadQueue().toString().getBytes(StandardCharsets.UTF_8));
        } catch (IOException error) {
            Logger.error(getLogTag(), "Cannot persist the share queue", error);
            return;
        }
        if (!temp.renameTo(target)) {
            target.delete();
            temp.renameTo(target);
        }
    }

    private void removeOrphanDirectories() {
        File[] directories = inboxRoot().listFiles();
        if (directories == null) return;
        Set<String> known = new LinkedHashSet<>();
        synchronized (queueLock) {
            JSONArray current = loadQueue();
            for (int index = 0; index < current.length(); index++) {
                known.add(current.optJSONObject(index).optString("batchId"));
            }
        }
        for (File directory : directories) {
            if (!known.contains(directory.getName())) deleteRecursively(directory);
        }
    }

    private static void deleteRecursively(File file) {
        File[] children = file.listFiles();
        if (children != null) {
            for (File child : children) deleteRecursively(child);
        }
        file.delete();
    }
}
