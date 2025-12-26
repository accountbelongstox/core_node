package com.swmansion.reanimated;

import android.graphics.Rect;
import android.view.View;
import com.facebook.react.uimanager.BackgroundStyleApplicator;
import com.facebook.react.uimanager.LengthPercentage;
import com.facebook.react.uimanager.style.BorderRadiusProp;

public class BorderRadiiDrawableUtils {
  private static float getRadiusForCorner(View view, BorderRadiusProp corner, float defaultValue) {
    LengthPercentage length = BackgroundStyleApplicator.getBorderRadius(view, corner);
    if (length == null) {
      return defaultValue;
    }
    Rect bounds = view.getBackground().getBounds();
<<<<<<< HEAD
    return length.resolve((float) bounds.width()).toPixelFromDIP().getHorizontal();
=======
    return length.resolve((float) bounds.width());
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
  }

  public static ReactNativeUtils.BorderRadii getBorderRadii(View view) {
    return new ReactNativeUtils.BorderRadii(
        getRadiusForCorner(view, BorderRadiusProp.BORDER_RADIUS, 0),
        getRadiusForCorner(view, BorderRadiusProp.BORDER_TOP_LEFT_RADIUS, Float.NaN),
        getRadiusForCorner(view, BorderRadiusProp.BORDER_TOP_RIGHT_RADIUS, Float.NaN),
        getRadiusForCorner(view, BorderRadiusProp.BORDER_BOTTOM_LEFT_RADIUS, Float.NaN),
        getRadiusForCorner(view, BorderRadiusProp.BORDER_BOTTOM_RIGHT_RADIUS, Float.NaN));
  }
}
