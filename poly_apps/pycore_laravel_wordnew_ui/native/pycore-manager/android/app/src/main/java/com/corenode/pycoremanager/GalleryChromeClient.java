package com.corenode.pycoremanager;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.provider.MediaStore;
import android.webkit.ValueCallback;
import android.webkit.WebView;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.PickVisualMediaRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebChromeClient;
import java.util.List;

/**
 * Image-only file inputs open the system photo picker (or the gallery app), which lists the media store live;
 * the default document picker shows a cached "recent" list that misses the newest photos and screenshots.
 */
public class GalleryChromeClient extends BridgeWebChromeClient {
    private static final String IMAGE_PREFIX = "image/";

    private final Bridge bridge;
    private final ActivityResultLauncher<PickVisualMediaRequest> photoPickerMultiple;
    private final ActivityResultLauncher<PickVisualMediaRequest> photoPickerSingle;
    private final ActivityResultLauncher<Intent> galleryLauncher;
    private ValueCallback<Uri[]> pendingCallback;

    public GalleryChromeClient(Bridge bridge) {
        super(bridge);
        this.bridge = bridge;
        photoPickerMultiple = bridge.registerForActivityResult(
            new ActivityResultContracts.PickMultipleVisualMedia(),
            (List<Uri> uris) -> deliver(uris == null || uris.isEmpty() ? null : uris.toArray(new Uri[0]))
        );
        photoPickerSingle = bridge.registerForActivityResult(
            new ActivityResultContracts.PickVisualMedia(),
            (Uri uri) -> deliver(uri == null ? null : new Uri[] { uri })
        );
        galleryLauncher = bridge.registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            (ActivityResult result) -> deliver(galleryResult(result))
        );
    }

    @Override
    public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
        if (fileChooserParams.isCaptureEnabled() || !imagesOnly(fileChooserParams.getAcceptTypes())) {
            return super.onShowFileChooser(webView, filePathCallback, fileChooserParams);
        }
        deliver(null);
        pendingCallback = filePathCallback;
        boolean multiple = fileChooserParams.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE;
        if (ActivityResultContracts.PickVisualMedia.isPhotoPickerAvailable(bridge.getContext())) {
            PickVisualMediaRequest request = new PickVisualMediaRequest.Builder()
                .setMediaType(ActivityResultContracts.PickVisualMedia.ImageOnly.INSTANCE)
                .build();
            (multiple ? photoPickerMultiple : photoPickerSingle).launch(request);
            return true;
        }
        Intent intent = new Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI);
        intent.setType("image/*");
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, multiple);
        try {
            galleryLauncher.launch(intent);
            return true;
        } catch (ActivityNotFoundException e) {
            pendingCallback = null;
            return super.onShowFileChooser(webView, filePathCallback, fileChooserParams);
        }
    }

    private static boolean imagesOnly(String[] acceptTypes) {
        if (acceptTypes == null || acceptTypes.length == 0) return false;
        for (String type : acceptTypes) {
            if (type == null || !type.trim().toLowerCase().startsWith(IMAGE_PREFIX)) return false;
        }
        return true;
    }

    private static Uri[] galleryResult(ActivityResult result) {
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null) return null;
        if (data.getClipData() != null) {
            int count = data.getClipData().getItemCount();
            Uri[] uris = new Uri[count];
            for (int i = 0; i < count; i++) uris[i] = data.getClipData().getItemAt(i).getUri();
            return uris;
        }
        return data.getData() == null ? null : new Uri[] { data.getData() };
    }

    private void deliver(Uri[] uris) {
        ValueCallback<Uri[]> callback = pendingCallback;
        pendingCallback = null;
        if (callback != null) callback.onReceiveValue(uris);
    }
}
