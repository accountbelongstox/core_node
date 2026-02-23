# -*- coding: utf-8 -*-
"""
Waterfall flow: scrollable grid of image cards for multi-image annotation.
Each card shows one image with overlaid shapes; annotations stored in a central cache.
Tkinter implementation (no PySide6).
"""

import copy
import os
import tkinter as tk
from tkinter import ttk
from typing import Any, Callable, Dict, List, Optional, Tuple, Union

from .canvas import AnnotatorCanvas, DRAW_MODE_RECTANGLE

CARD_WIDTH = 320
CARD_HEIGHT_MIN = 120
CARD_HEIGHT_MAX = 600
BREAKPOINT_TWO_COLS = 640
CARD_MARGIN = 12
UNDO_HISTORY_MAX = 50

# For class_colors: RGB tuple or hex string (same as canvas.ColorSpec)
ColorSpec = Union[Tuple[int, int, int], str]

def _scale_to_fit(img_w: int, img_h: int, card_w: int, card_h: int) -> float:
    if img_w <= 0 or img_h <= 0:
        return 1.0
    return min(card_w / img_w, card_h / img_h, 4.0)


def _canvas_height_for_aspect(card_w: int, img_w: int, img_h: int) -> int:
    if img_w <= 0 or img_h <= 0:
        return CARD_HEIGHT_MIN
    h = round(card_w * img_h / img_w)
    return max(CARD_HEIGHT_MIN, min(CARD_HEIGHT_MAX, h))


class ImageCardWidget:
    """One image card: canvas + filename + Undo button. Resizes with layout."""

    def __init__(
        self,
        image_path: str,
        initial_shapes: List[Dict[str, Any]],
        on_shapes_changed: Callable[[str, List[Dict[str, Any]]], None],
        on_undo: Callable[[], None],
        parent: Optional[tk.Widget] = None,
    ):
        self._image_path = image_path
        self._on_shapes_changed = on_shapes_changed
        self._on_undo = on_undo
        self._img_w, self._img_h = 0, 0
        self._aspect_ratio = 1.0
        self._frame = tk.Frame(parent, bg="#ffffff", relief="solid", bd=1)
        self._canvas = AnnotatorCanvas(self._frame)
        self._canvas.set_shapes(initial_shapes)
        self._canvas.set_shapes_changed_callback(lambda: self._emit_shapes())
        self._canvas.load_image(image_path)
        if self._canvas.image_size() != (0, 0):
            self._img_w, self._img_h = self._canvas.image_size()
            self._aspect_ratio = self._img_h / self._img_w if self._img_w else 1.0
            ch = _canvas_height_for_aspect(CARD_WIDTH, self._img_w, self._img_h)
            self._canvas.widget().configure(width=CARD_WIDTH, height=ch)
            scale = CARD_WIDTH / self._img_w
            self._canvas.set_scale(min(4.0, max(0.25, scale)))
        else:
            self._canvas.widget().configure(width=CARD_WIDTH, height=CARD_HEIGHT_MIN)
        self._canvas.widget().pack(fill="both", expand=True, padx=6, pady=6)
        self._label = tk.Label(self._frame, text=os.path.basename(image_path), font=("", 11), fg="#5f6368")
        self._label.pack(pady=2)
        undo_btn = ttk.Button(self._frame, text="Undo (撤销)", command=on_undo)
        undo_btn.pack(pady=4)
        self._frame.bind("<Configure>", self._on_configure)
        self._on_card_context_menu: Optional[Callable[[str, int, int], None]] = None

    def _on_configure(self, event) -> None:
        if self._img_w <= 0:
            return
        w = event.width - CARD_MARGIN
        if w <= 0:
            return
        canvas_h = max(CARD_HEIGHT_MIN, min(CARD_HEIGHT_MAX, round(w * self._aspect_ratio)))
        self._canvas.widget().configure(width=w, height=canvas_h)
        scale = w / self._img_w
        self._canvas.set_scale(min(4.0, max(0.25, scale)))

    def _emit_shapes(self) -> None:
        self._on_shapes_changed(self._image_path, self._canvas.get_shapes())

    def image_path(self) -> str:
        return self._image_path

    def canvas(self) -> AnnotatorCanvas:
        return self._canvas

    def current_canvas_width(self) -> int:
        return self._canvas.widget().winfo_width() if self._canvas else 0

    def widget(self) -> tk.Frame:
        return self._frame

    def set_context_menu_callback(self, cb: Optional[Callable[[str, int, int], None]]) -> None:
        self._on_card_context_menu = cb
        if cb is not None:
            self._frame.bind("<Button-3>", self._on_right_click)
        else:
            self._frame.unbind("<Button-3>")

    def _on_right_click(self, event: tk.Event) -> None:
        if self._on_card_context_menu:
            self._on_card_context_menu(self._image_path, event.x_root, event.y_root)


class WaterfallFlowWidget:
    """Scrollable grid of ImageCardWidgets. Manages annotation cache and forwards class/color/mode to all cards."""

    def __init__(self, parent: Optional[tk.Widget] = None):
        self._parent = parent
        self._frame = tk.Frame(parent)
        self._annotation_cache: Dict[str, List[Dict[str, Any]]] = {}
        self._annotation_history: Dict[str, List[List[Dict[str, Any]]]] = {}
        self._undo_in_progress = False
        self._image_paths: List[str] = []
        self._cards: List[ImageCardWidget] = []
        self._on_current_canvas_changed: Optional[Callable[[Any], None]] = None
        self._on_cache_changed: Optional[Callable[[], None]] = None
        self._on_card_context_menu: Optional[Callable[[str, int, int], None]] = None

        self._canvas = tk.Canvas(self._frame, highlightthickness=0)
        self._vbar = ttk.Scrollbar(self._frame, orient="vertical", command=self._canvas.yview)
        self._hbar = ttk.Scrollbar(self._frame, orient="horizontal", command=self._canvas.xview)
        self._flow_container = tk.Frame(self._canvas)
        self._flow_container_id = self._canvas.create_window(0, 0, window=self._flow_container, anchor="nw")
        self._canvas.configure(yscrollcommand=self._vbar.set, xscrollcommand=self._hbar.set)
        self._vbar.pack(side="right", fill="y")
        self._hbar.pack(side="bottom", fill="x")
        self._canvas.pack(side="left", fill="both", expand=True)
        self._canvas.bind("<Configure>", self._on_canvas_configure)
        self._flow_container.bind("<Configure>", self._on_flow_configure)
        self._canvas.bind("<MouseWheel>", self._on_mousewheel)
        self._canvas.bind("<Button-4>", self._on_mousewheel)
        self._canvas.bind("<Button-5>", self._on_mousewheel)
        self._flow_container.bind("<MouseWheel>", self._on_mousewheel)
        self._flow_container.bind("<Button-4>", self._on_mousewheel)
        self._flow_container.bind("<Button-5>", self._on_mousewheel)
        self._ncols = 1

    def _on_canvas_configure(self, event) -> None:
        w = event.width
        self._on_flow_resized(w if w > 0 else BREAKPOINT_TWO_COLS)
        self._canvas.itemconfig(self._flow_container_id, width=event.width)

    def _on_flow_configure(self, event) -> None:
        self._canvas.configure(scrollregion=(0, 0, max(event.width, self._canvas.winfo_width()), max(event.height, self._canvas.winfo_height())))

    def _on_mousewheel(self, event) -> None:
        delta = getattr(event, "delta", 0)
        num = getattr(event, "num", 0)
        if num == 5 or delta == -120 or delta < 0:
            self._canvas.yview_scroll(1, "units")
        elif num == 4 or delta == 120 or delta > 0:
            self._canvas.yview_scroll(-1, "units")

    def widget(self) -> tk.Frame:
        return self._frame

    def set_annotation_cache(self, cache: Dict[str, List[Dict[str, Any]]]) -> None:
        self._annotation_cache = cache

    def get_annotation_cache(self) -> Dict[str, List[Dict[str, Any]]]:
        return self._annotation_cache

    def set_current_canvas_changed_callback(self, cb: Optional[Callable[[Any], None]]) -> None:
        self._on_current_canvas_changed = cb

    def set_cache_changed_callback(self, cb: Optional[Callable[[], None]]) -> None:
        self._on_cache_changed = cb

    def set_card_context_menu_callback(self, cb: Optional[Callable[[str, int, int], None]]) -> None:
        self._on_card_context_menu = cb

    def _on_flow_resized(self, width: int) -> None:
        if not self._cards:
            return
        ncols = 2 if width >= BREAKPOINT_TWO_COLS else 1
        if ncols == self._ncols and self._ncols != 0:
            return
        self._ncols = ncols
        for c in self._cards:
            c.widget().grid_forget()
        for i, card in enumerate(self._cards):
            card.widget().grid(row=i // ncols, column=i % ncols, sticky="nsew", padx=4, pady=4)
        for col in range(max(1, ncols)):
            self._flow_container.grid_columnconfigure(col, weight=1)
        if self._on_cache_changed:
            self._on_cache_changed()

    def set_images(
        self,
        image_paths: List[str],
        load_annotations_fn: Callable[[str], List[Dict[str, Any]]],
    ) -> None:
        for c in self._cards:
            c.canvas().set_shapes_changed_callback(None)
            c.widget().destroy()
        self._cards.clear()
        self._image_paths = list(image_paths)
        self._annotation_cache = {}
        self._annotation_history = {p: [] for p in self._image_paths}
        ncols = 2
        for i, path in enumerate(self._image_paths):
            shapes = load_annotations_fn(path)
            self._annotation_cache[path] = list(shapes)

            def _make_undo(img_path: str) -> Callable[[], None]:
                return lambda: self._undo_for_image(img_path)

            card = ImageCardWidget(
                path,
                shapes,
                self._on_card_shapes_changed,
                _make_undo(path),
                self._flow_container,
            )
            card.set_context_menu_callback(self._on_card_context_menu)
            card.widget().grid(row=i // ncols, column=i % ncols, sticky="nsew", padx=4, pady=4)
            card.canvas().widget().bind("<FocusIn>", lambda e, can=card.canvas(): self._focus_in(can))
            self._cards.append(card)
        for col in range(max(1, ncols)):
            self._flow_container.grid_columnconfigure(col, weight=1)
        self._ncols = ncols
        if self._on_cache_changed:
            self._on_cache_changed()
        self._frame.update_idletasks()
        w = self._canvas.winfo_width()
        if w > 0:
            self._on_flow_resized(w)

    def _focus_in(self, canvas: AnnotatorCanvas) -> None:
        if self._on_current_canvas_changed:
            self._on_current_canvas_changed(canvas)

    def _on_card_shapes_changed(self, image_path: str, shapes: List[Dict[str, Any]]) -> None:
        if self._undo_in_progress:
            self._annotation_cache[image_path] = list(shapes)
            return
        history = self._annotation_history.get(image_path)
        if history is not None:
            old_state = copy.deepcopy(self._annotation_cache.get(image_path, []))
            history.append(old_state)
            if len(history) > UNDO_HISTORY_MAX:
                history.pop(0)
        self._annotation_cache[image_path] = list(shapes)
        if self._on_cache_changed:
            self._on_cache_changed()

    def _undo_for_image(self, image_path: str) -> bool:
        history = self._annotation_history.get(image_path)
        if not history:
            return False
        self._undo_in_progress = True
        try:
            prev = history.pop()
            self._annotation_cache[image_path] = copy.deepcopy(prev)
            for c in self._cards:
                if c.image_path() == image_path:
                    c.canvas().set_shapes(prev)
                    break
            if self._on_cache_changed:
                self._on_cache_changed()
            return True
        finally:
            self._undo_in_progress = False

    def set_draw_mode(self, mode: str) -> None:
        for c in self._cards:
            c.canvas().set_draw_mode(mode)

    def set_default_class(self, class_name: str) -> None:
        for c in self._cards:
            c.canvas().set_default_class(class_name)

    def set_class_colors(self, color_map: Dict[str, ColorSpec]) -> None:
        for c in self._cards:
            c.canvas().set_class_colors(color_map)

    def set_card_scale(self, scale: float) -> None:
        for c in self._cards:
            if c.canvas().image_size() != (0, 0):
                img_w, _ = c.canvas().image_size()
                card_w = c.current_canvas_width() or CARD_WIDTH
                base = card_w / img_w
                s = base * scale
                c.canvas().set_scale(min(4.0, max(0.25, s)))

    def get_image_path_for_canvas(self, canvas: AnnotatorCanvas) -> Optional[str]:
        for c in self._cards:
            if c.canvas() is canvas:
                return c.image_path()
        return None

    def focus_card_for_image(self, image_path: str) -> None:
        for c in self._cards:
            if c.image_path() == image_path:
                c.canvas().widget().focus_set()
                self._scroll_to_card(c.widget())
                break

    def _scroll_to_card(self, card_widget: tk.Widget) -> None:
        self._flow_container.update_idletasks()
        try:
            cy = card_widget.winfo_y()
            ch = card_widget.winfo_height()
            fh = self._flow_container.winfo_reqheight()
            if fh <= 0:
                return
            frac = max(0.0, min(1.0, (cy - 80) / fh))
            self._canvas.yview_moveto(frac)
        except (tk.TclError, ZeroDivisionError):
            pass
