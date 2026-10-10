package com.corenode.wordnew;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.common.MlKitException;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions;

/**
 * On-device text recognition: Google ML Kit text recognition v2 with the Chinese recognizer (it reads Latin
 * too). The model comes from Google Play services (unbundled), so it adds almost nothing to the APK. The
 * page sends an already upright JPEG as base64; ML Kit runs the recognition off the main thread.
 */
@CapacitorPlugin(name = "TextRecognition")
public class TextRecognitionPlugin extends Plugin {
    private final Object recognizerLock = new Object();
    private TextRecognizer recognizer;

    private TextRecognizer recognizer() {
        synchronized (recognizerLock) {
            if (recognizer == null) {
                recognizer = TextRecognition.getClient(new ChineseTextRecognizerOptions.Builder().build());
            }
            return recognizer;
        }
    }

    @PluginMethod
    public void recognize(PluginCall call) {
        String base64 = call.getString("base64");
        if (base64 == null || base64.isEmpty()) {
            call.reject("base64 is required", "INVALID_REQUEST");
            return;
        }
        int comma = base64.indexOf(',');
        Bitmap bitmap;
        try {
            byte[] bytes = Base64.decode(comma >= 0 ? base64.substring(comma + 1) : base64, Base64.DEFAULT);
            bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        } catch (IllegalArgumentException | OutOfMemoryError error) {
            call.reject("The image could not be decoded", "DECODE_FAILED", error instanceof Exception ? (Exception) error : null);
            return;
        }
        if (bitmap == null) {
            call.reject("The image could not be decoded", "DECODE_FAILED");
            return;
        }
        final Bitmap image = bitmap;
        try {
            recognizer().process(InputImage.fromBitmap(image, 0))
                .addOnSuccessListener(result -> {
                    image.recycle();
                    call.resolve(toResult(result));
                })
                .addOnFailureListener(error -> {
                    image.recycle();
                    rejectRecognition(call, error);
                });
        } catch (RuntimeException error) {
            image.recycle();
            rejectRecognition(call, error);
        }
    }

    private static JSObject toResult(Text result) {
        JSArray blocks = new JSArray();
        for (Text.TextBlock block : result.getTextBlocks()) {
            JSObject item = new JSObject();
            item.put("text", block.getText());
            blocks.put(item);
        }
        JSObject response = new JSObject();
        response.put("text", result.getText());
        response.put("blocks", blocks);
        return response;
    }

    private static void rejectRecognition(PluginCall call, Exception error) {
        boolean unavailable = error instanceof MlKitException
            && ((MlKitException) error).getErrorCode() == MlKitException.UNAVAILABLE;
        call.reject(
            error.getMessage() != null ? error.getMessage() : "Text recognition failed",
            unavailable ? "MODEL_UNAVAILABLE" : "RECOGNITION_FAILED",
            error
        );
    }

    @Override
    protected void handleOnDestroy() {
        synchronized (recognizerLock) {
            if (recognizer != null) {
                recognizer.close();
                recognizer = null;
            }
        }
        super.handleOnDestroy();
    }
}
