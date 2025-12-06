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
    return length.resolve((float) bounds.width()).toPixelFromDIP().getHorizontal();
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
