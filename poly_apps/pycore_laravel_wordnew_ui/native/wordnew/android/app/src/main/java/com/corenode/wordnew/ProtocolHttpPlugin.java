package com.corenode.wordnew;

import android.content.Context;
import android.util.Base64;
import android.webkit.CookieManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.net.CronetProviderInstaller;
import com.google.android.gms.tasks.Task;
import com.google.android.gms.tasks.Tasks;

import org.chromium.net.CronetEngine;
import org.chromium.net.CronetException;
import org.chromium.net.UploadDataProvider;
import org.chromium.net.UploadDataSink;
import org.chromium.net.UrlRequest;
import org.chromium.net.UrlResponseInfo;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;


@CapacitorPlugin(name = "ProtocolHttp")
public class ProtocolHttpPlugin extends Plugin {
    private static final String ERROR_ABORTED = "ABORTED";
    private static final String ERROR_CRONET_UNAVAILABLE = "CRONET_UNAVAILABLE";
    private static final String ERROR_INVALID_REQUEST = "INVALID_REQUEST";
    private static final int READ_BUFFER_BYTES = 32 * 1024;
    private static final int MAX_REDIRECTS = 10;
    private static final ExecutorService NETWORK_EXECUTOR = Executors.newFixedThreadPool(4);
    private static final Object ENGINE_LOCK = new Object();
    private static volatile CronetEngine sharedEngine;
    private static volatile Task<CronetEngine> sharedEngineTask;

    private final ConcurrentHashMap<String, UrlRequest> activeRequests = new ConcurrentHashMap<>();
    private final Set<String> pendingRequestIds = ConcurrentHashMap.newKeySet();
    private final Set<String> canceledBeforeStart = ConcurrentHashMap.newKeySet();

    /** Plain http is carried only to RFC 1918 LAN hosts (e.g. pycore :59000, which has no TLS). */
    private static final java.util.regex.Pattern PRIVATE_LAN_HTTP = java.util.regex.Pattern.compile(
        "^http://(10\\.\\d{1,3}|172\\.(1[6-9]|2\\d|3[01])|192\\.168)\\.\\d{1,3}\\.\\d{1,3}(:\\d+)?/.*",
        java.util.regex.Pattern.CASE_INSENSITIVE
    );

    private static boolean isPrivateLanHttp(String url) {
        return PRIVATE_LAN_HTTP.matcher(url).matches();
    }

    @Override
    public void load() {
        ensureEngine();
    }

    @Override
    protected void handleOnDestroy() {
        for (UrlRequest request : activeRequests.values()) {
            request.cancel();
        }
        activeRequests.clear();
        pendingRequestIds.clear();
        canceledBeforeStart.clear();
    }

    @PluginMethod
    public void request(PluginCall call) {
        String url = call.getString("url", "").trim();
        String requestId = call.getString("requestId", "").trim();
        if (!(url.startsWith("https://") || isPrivateLanHttp(url)) || requestId.isEmpty()) {
            call.reject("ProtocolHttp requires an HTTPS (or LAN http) URL and requestId", ERROR_INVALID_REQUEST);
            return;
        }
        if (activeRequests.containsKey(requestId) || !pendingRequestIds.add(requestId)) {
            call.reject("ProtocolHttp requestId is already active", ERROR_INVALID_REQUEST);
            return;
        }
        ensureEngine()
            .addOnSuccessListener(
                NETWORK_EXECUTOR,
                activeEngine -> {
                    try {
                        executeRequest(activeEngine, call, url, requestId);
                    } catch (Exception error) {
                        pendingRequestIds.remove(requestId);
                        canceledBeforeStart.remove(requestId);
                        activeRequests.remove(requestId);
                        call.reject("Cronet request setup failed", ERROR_INVALID_REQUEST, error);
                    }
                }
            )
            .addOnFailureListener(
                NETWORK_EXECUTOR,
                error -> {
                    synchronized (ENGINE_LOCK) {
                        if (sharedEngine == null) {
                            sharedEngineTask = null;
                        }
                    }
                    pendingRequestIds.remove(requestId);
                    canceledBeforeStart.remove(requestId);
                    call.reject("Cronet provider is unavailable", ERROR_CRONET_UNAVAILABLE, error);
                }
            );
    }

    /**
     * Clip bundle download (config/audio_orchestration_contract.json transfer):
     * the response frames are parsed while they stream in and every sent clip
     * is written straight to {@code folder/names[index]} (temp file + rename),
     * so no clip byte crosses the WebView bridge. Resolves with the status and
     * the frame headers (each with {@code written}); a non-200 answer resolves
     * with its status and no entries.
     */
    @PluginMethod
    public void bundle(PluginCall call) {
        String url = call.getString("url", "").trim();
        String requestId = call.getString("requestId", "").trim();
        String folder = call.getString("folder", "").trim();
        JSArray names = call.getArray("names", new JSArray());
        if (!(url.startsWith("https://") || isPrivateLanHttp(url)) || requestId.isEmpty() || folder.isEmpty()) {
            call.reject("ProtocolHttp bundle requires an HTTPS (or LAN http) URL, requestId and folder", ERROR_INVALID_REQUEST);
            return;
        }
        File target = new File(folder);
        if (!target.isDirectory() && !target.mkdirs()) {
            call.reject("ProtocolHttp bundle folder cannot be created: " + folder, ERROR_INVALID_REQUEST);
            return;
        }
        if (activeRequests.containsKey(requestId) || !pendingRequestIds.add(requestId)) {
            call.reject("ProtocolHttp requestId is already active", ERROR_INVALID_REQUEST);
            return;
        }
        ensureEngine()
            .addOnSuccessListener(
                NETWORK_EXECUTOR,
                activeEngine -> {
                    try {
                        startRequest(activeEngine, call, url, requestId, new BundleCallback(call, requestId, url, target, names));
                    } catch (Exception error) {
                        pendingRequestIds.remove(requestId);
                        canceledBeforeStart.remove(requestId);
                        activeRequests.remove(requestId);
                        call.reject("Cronet bundle setup failed", ERROR_INVALID_REQUEST, error);
                    }
                }
            )
            .addOnFailureListener(
                NETWORK_EXECUTOR,
                error -> {
                    pendingRequestIds.remove(requestId);
                    canceledBeforeStart.remove(requestId);
                    call.reject("Cronet provider is unavailable", ERROR_CRONET_UNAVAILABLE, error);
                }
            );
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        String requestId = call.getString("requestId", "").trim();
        UrlRequest request = activeRequests.remove(requestId);
        if (request != null) {
            request.cancel();
        } else if (!requestId.isEmpty() && pendingRequestIds.contains(requestId)) {
            canceledBeforeStart.add(requestId);
        }
        call.resolve();
    }

    private Task<CronetEngine> ensureEngine() {
        CronetEngine activeEngine = sharedEngine;
        Task<CronetEngine> pendingTask = sharedEngineTask;
        if (activeEngine != null) {
            return Tasks.forResult(activeEngine);
        }
        if (pendingTask != null) {
            return pendingTask;
        }
        synchronized (ENGINE_LOCK) {
            activeEngine = sharedEngine;
            pendingTask = sharedEngineTask;
            if (activeEngine != null) {
                return Tasks.forResult(activeEngine);
            }
            if (pendingTask != null) {
                return pendingTask;
            }
            Context applicationContext = getContext().getApplicationContext();
            sharedEngineTask = CronetProviderInstaller.installProvider(applicationContext).continueWith(NETWORK_EXECUTOR, task -> {
                task.getResult();
                CronetEngine createdEngine = new CronetEngine.Builder(applicationContext)
                    .enableQuic(true)
                    .enableHttp2(true)
                    .enableBrotli(true)
                    .build();
                sharedEngine = createdEngine;
                return createdEngine;
            });
            return sharedEngineTask;
        }
    }

    private void executeRequest(
        CronetEngine activeEngine,
        PluginCall call,
        String url,
        String requestId
    ) {
        startRequest(activeEngine, call, url, requestId, new ResponseCallback(call, requestId, url));
    }

    private void startRequest(
        CronetEngine activeEngine,
        PluginCall call,
        String url,
        String requestId,
        UrlRequest.Callback callback
    ) {
        String method = call.getString("method", "GET").trim().toUpperCase();
        String bodyBase64 = call.getString("bodyBase64", "");
        Boolean sendCookiesValue = call.getBoolean("sendCookies", false);
        boolean sendCookies = Boolean.TRUE.equals(sendCookiesValue);
        JSObject headers = call.getObject("headers", new JSObject());
        byte[] body = bodyBase64.isEmpty() ? new byte[0] : Base64.decode(bodyBase64, Base64.DEFAULT);
        pendingRequestIds.remove(requestId);
        if (canceledBeforeStart.remove(requestId)) {
            call.reject("Cronet request was aborted", ERROR_ABORTED);
            return;
        }
        UrlRequest.Builder builder = activeEngine.newUrlRequestBuilder(url, callback, NETWORK_EXECUTOR)
            .setHttpMethod(method);
        boolean hasContentType = false;
        boolean hasCookie = false;
        Iterator<String> headerNames = headers.keys();
        while (headerNames.hasNext()) {
            String name = headerNames.next();
            String value = headers.optString(name, "");
            if (name.equalsIgnoreCase("content-length") || name.equalsIgnoreCase("host")) {
                continue;
            }
            if (name.equalsIgnoreCase("content-type")) {
                hasContentType = true;
            }
            if (name.equalsIgnoreCase("cookie")) {
                hasCookie = true;
            }
            builder.addHeader(name, value);
        }
        if (sendCookies && !hasCookie) {
            String cookie = CookieManager.getInstance().getCookie(url);
            if (cookie != null && !cookie.isEmpty()) {
                builder.addHeader("Cookie", cookie);
            }
        }
        if (body.length > 0) {
            if (!hasContentType) {
                builder.addHeader("Content-Type", "application/octet-stream");
            }
            builder.setUploadDataProvider(new ByteArrayUploadDataProvider(body), NETWORK_EXECUTOR);
        }
        UrlRequest request = builder.build();
        activeRequests.put(requestId, request);
        request.start();
    }

    private void storeResponseCookies(String url, UrlResponseInfo info) {
        CookieManager cookieManager = CookieManager.getInstance();
        for (Map.Entry<String, List<String>> entry : info.getAllHeaders().entrySet()) {
            if (!entry.getKey().equalsIgnoreCase("set-cookie")) {
                continue;
            }
            for (String cookie : entry.getValue()) {
                cookieManager.setCookie(url, cookie);
            }
        }
        cookieManager.flush();
    }

    private final class ResponseCallback extends UrlRequest.Callback {
        private final PluginCall call;
        private final String requestId;
        private final String originalUrl;
        private final ByteArrayOutputStream responseBody = new ByteArrayOutputStream();
        private final ByteBuffer readBuffer = ByteBuffer.allocateDirect(READ_BUFFER_BYTES);
        private final AtomicBoolean finished = new AtomicBoolean(false);
        private int redirectCount;

        private ResponseCallback(PluginCall call, String requestId, String originalUrl) {
            this.call = call;
            this.requestId = requestId;
            this.originalUrl = originalUrl;
        }

        @Override
        public void onRedirectReceived(UrlRequest currentRequest, UrlResponseInfo info, String newLocationUrl) {
            redirectCount += 1;
            storeResponseCookies(info.getUrl(), info);
            if (redirectCount > MAX_REDIRECTS) {
                activeRequests.remove(requestId);
                if (finished.compareAndSet(false, true)) {
                    call.reject("Too many HTTP redirects", ERROR_INVALID_REQUEST);
                    currentRequest.cancel();
                }
                return;
            }
            currentRequest.followRedirect();
        }

        @Override
        public void onResponseStarted(UrlRequest currentRequest, UrlResponseInfo info) {
            storeResponseCookies(info.getUrl(), info);
            currentRequest.read(readBuffer);
        }

        @Override
        public void onReadCompleted(
            UrlRequest currentRequest,
            UrlResponseInfo info,
            ByteBuffer completedBuffer
        ) {
            byte[] bytes;
            completedBuffer.flip();
            bytes = new byte[completedBuffer.remaining()];
            completedBuffer.get(bytes);
            responseBody.write(bytes, 0, bytes.length);
            completedBuffer.clear();
            currentRequest.read(completedBuffer);
        }

        @Override
        public void onSucceeded(UrlRequest currentRequest, UrlResponseInfo info) {
            JSObject result = new JSObject();
            JSObject responseHeaders = new JSObject();
            activeRequests.remove(requestId);
            if (!finished.compareAndSet(false, true)) {
                return;
            }
            for (Map.Entry<String, List<String>> entry : info.getAllHeaders().entrySet()) {
                responseHeaders.put(entry.getKey(), String.join(", ", entry.getValue()));
            }
            result.put("status", info.getHttpStatusCode());
            result.put("statusText", info.getHttpStatusText());
            result.put("url", info.getUrl());
            result.put("headers", responseHeaders);
            result.put("bodyBase64", Base64.encodeToString(responseBody.toByteArray(), Base64.NO_WRAP));
            result.put("protocol", info.getNegotiatedProtocol());
            result.put("wasCached", info.wasCached());
            result.put("redirects", Math.max(0, info.getUrlChain().size() - 1));
            call.resolve(result);
        }

        @Override
        public void onFailed(UrlRequest currentRequest, UrlResponseInfo info, CronetException error) {
            JSObject data = new JSObject();
            activeRequests.remove(requestId);
            if (!finished.compareAndSet(false, true)) {
                return;
            }
            data.put("url", info == null ? originalUrl : info.getUrl());
            data.put("protocol", info == null ? "" : info.getNegotiatedProtocol());
            call.reject("Cronet request failed", "NETWORK_ERROR", error, data);
        }

        @Override
        public void onCanceled(UrlRequest currentRequest, UrlResponseInfo info) {
            activeRequests.remove(requestId);
            if (finished.compareAndSet(false, true)) {
                call.reject("Cronet request was aborted", ERROR_ABORTED);
            }
        }
    }

    /** Streams bundle frames to files; see {@link #bundle(PluginCall)}. */
    private final class BundleCallback extends UrlRequest.Callback {
        private static final int FRAME_LENGTH_BYTES = 4;
        private static final String PART_SUFFIX = ".part";
        private final PluginCall call;
        private final String requestId;
        private final String originalUrl;
        private final File folder;
        private final JSArray names;
        private final ByteBuffer readBuffer = ByteBuffer.allocateDirect(READ_BUFFER_BYTES);
        private final AtomicBoolean finished = new AtomicBoolean(false);
        private final JSArray entries = new JSArray();
        private final ByteArrayOutputStream pending = new ByteArrayOutputStream();
        private final ByteArrayOutputStream errorBody = new ByteArrayOutputStream();
        private int status;
        private int headerLength = -1;
        private JSObject header;
        private long payloadLeft;
        private FileOutputStream output;
        private File partFile;
        private File finalFile;
        private int redirectCount;

        private BundleCallback(PluginCall call, String requestId, String originalUrl, File folder, JSArray names) {
            this.call = call;
            this.requestId = requestId;
            this.originalUrl = originalUrl;
            this.folder = folder;
            this.names = names;
        }

        @Override
        public void onRedirectReceived(UrlRequest currentRequest, UrlResponseInfo info, String newLocationUrl) {
            redirectCount += 1;
            if (redirectCount > MAX_REDIRECTS) {
                fail(currentRequest, "Too many HTTP redirects", null);
                return;
            }
            currentRequest.followRedirect();
        }

        @Override
        public void onResponseStarted(UrlRequest currentRequest, UrlResponseInfo info) {
            status = info.getHttpStatusCode();
            currentRequest.read(readBuffer);
        }

        @Override
        public void onReadCompleted(UrlRequest currentRequest, UrlResponseInfo info, ByteBuffer completedBuffer) {
            completedBuffer.flip();
            byte[] bytes = new byte[completedBuffer.remaining()];
            completedBuffer.get(bytes);
            completedBuffer.clear();
            try {
                if (status == 200) {
                    consume(bytes, 0);
                } else {
                    errorBody.write(bytes, 0, bytes.length);
                }
            } catch (Exception error) {
                fail(currentRequest, "Clip bundle could not be written", error);
                return;
            }
            currentRequest.read(completedBuffer);
        }

        /** Advance the frame parser over {@code bytes} starting at {@code offset}. */
        private void consume(byte[] bytes, int offset) throws IOException, org.json.JSONException {
            int position = offset;
            while (position < bytes.length) {
                if (payloadLeft > 0) {
                    int count = (int) Math.min(payloadLeft, bytes.length - position);
                    if (output != null) {
                        output.write(bytes, position, count);
                    }
                    payloadLeft -= count;
                    position += count;
                    if (payloadLeft == 0) {
                        finishPayload();
                    }
                    continue;
                }
                int wanted = (headerLength < 0 ? FRAME_LENGTH_BYTES : headerLength) - pending.size();
                int count = Math.min(wanted, bytes.length - position);
                pending.write(bytes, position, count);
                position += count;
                if (pending.size() < (headerLength < 0 ? FRAME_LENGTH_BYTES : headerLength)) {
                    continue;
                }
                byte[] chunk = pending.toByteArray();
                pending.reset();
                if (headerLength < 0) {
                    headerLength = ByteBuffer.wrap(chunk).getInt();
                    continue;
                }
                header = new JSObject(new String(chunk, StandardCharsets.UTF_8));
                headerLength = -1;
                startPayload();
            }
        }

        private void startPayload() throws IOException {
            boolean sent = header.optBoolean("sent", false);
            long size = header.optLong("bytes", 0);
            int index = header.optInt("index", -1);
            String name = index >= 0 && index < names.length() ? names.optString(index, "") : "";
            if (!sent || size <= 0) {
                header.put("written", false);
                entries.put(header);
                return;
            }
            payloadLeft = size;
            if (name.isEmpty() || name.contains("/") || name.contains("\\")) {
                output = null;
                header.put("written", false);
                return;
            }
            finalFile = new File(folder, name);
            partFile = new File(folder, name + PART_SUFFIX);
            output = new FileOutputStream(partFile);
        }

        private void finishPayload() throws IOException {
            if (output == null) {
                entries.put(header);
                return;
            }
            output.close();
            output = null;
            if (finalFile.exists() && !finalFile.delete()) {
                throw new IOException("Cannot replace " + finalFile);
            }
            if (!partFile.renameTo(finalFile)) {
                throw new IOException("Cannot move " + partFile + " to " + finalFile);
            }
            header.put("written", true);
            entries.put(header);
        }

        private void dropPartial() {
            if (output != null) {
                try {
                    output.close();
                } catch (IOException ignored) {
                    // The partial file is removed below either way.
                }
                output = null;
            }
            // A finished payload was renamed away; a temp file still here is an interrupted one.
            if (partFile != null && partFile.exists()) {
                partFile.delete();
            }
        }

        private void fail(UrlRequest currentRequest, String message, Exception error) {
            activeRequests.remove(requestId);
            dropPartial();
            if (finished.compareAndSet(false, true)) {
                call.reject(message, ERROR_INVALID_REQUEST, error);
                currentRequest.cancel();
            }
        }

        @Override
        public void onSucceeded(UrlRequest currentRequest, UrlResponseInfo info) {
            activeRequests.remove(requestId);
            if (!finished.compareAndSet(false, true)) {
                return;
            }
            dropPartial();
            JSObject result = new JSObject();
            result.put("status", info.getHttpStatusCode());
            result.put("protocol", info.getNegotiatedProtocol());
            result.put("entries", entries);
            if (status != 200) {
                result.put("bodyBase64", Base64.encodeToString(errorBody.toByteArray(), Base64.NO_WRAP));
            }
            call.resolve(result);
        }

        @Override
        public void onFailed(UrlRequest currentRequest, UrlResponseInfo info, CronetException error) {
            activeRequests.remove(requestId);
            dropPartial();
            if (!finished.compareAndSet(false, true)) {
                return;
            }
            JSObject data = new JSObject();
            data.put("url", info == null ? originalUrl : info.getUrl());
            call.reject("Cronet bundle request failed", "NETWORK_ERROR", error, data);
        }

        @Override
        public void onCanceled(UrlRequest currentRequest, UrlResponseInfo info) {
            activeRequests.remove(requestId);
            dropPartial();
            if (finished.compareAndSet(false, true)) {
                call.reject("Cronet request was aborted", ERROR_ABORTED);
            }
        }
    }

    private static final class ByteArrayUploadDataProvider extends UploadDataProvider {
        private final byte[] data;
        private int offset;

        private ByteArrayUploadDataProvider(byte[] data) {
            this.data = data;
        }

        @Override
        public long getLength() {
            return data.length;
        }

        @Override
        public void read(UploadDataSink sink, ByteBuffer destination) {
            int remaining = data.length - offset;
            int length = Math.min(remaining, destination.remaining());
            destination.put(data, offset, length);
            offset += length;
            sink.onReadSucceeded(false);
        }

        @Override
        public void rewind(UploadDataSink sink) {
            offset = 0;
            sink.onRewindSucceeded();
        }
    }
}
