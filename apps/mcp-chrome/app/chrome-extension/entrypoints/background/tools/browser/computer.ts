/**
 * Computer Tool - Unified mouse/keyboard interaction tool
 * Simplified implementation that delegates to existing tools
 */

import { createErrorResponse, createJsonResponse, toErrorMessage, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';
import { TOOL_MESSAGE_TYPES } from '@/common/message-types';
import { delay as waitForDelay } from '@/utils/async';
import { clickTool, fillTool } from './interaction';
import { keyboardTool } from './keyboard';
import { screenshotTool } from './screenshot';

interface ComputerParams {
  action:
    | 'left_click'
    | 'right_click'
    | 'double_click'
    | 'triple_click'
    | 'left_click_drag'
    | 'scroll'
    | 'type'
    | 'key'
    | 'hover'
    | 'wait'
    | 'fill'
    | 'fill_form'
    | 'resize_page'
    | 'scroll_to'
    | 'zoom'
    | 'screenshot';
  coordinates?: { x: number; y: number };
  startCoordinates?: { x: number; y: number };
  ref?: string;
  startRef?: string;
  scrollDirection?: 'up' | 'down' | 'left' | 'right';
  scrollAmount?: number;
  text?: string;
  repeat?: number;
  modifiers?: {
    altKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
  };
  selector?: string;
  value?: string | boolean | number;
  elements?: Array<{ ref: string; value: string }>;
  tabId?: number;
  windowId?: number;
  background?: boolean;
  duration?: number;
  timeout?: number;
  appear?: boolean;
}


class ComputerTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.COMPUTER;

  /**
   * Resolve a read_page ref to on-page coordinates + selector by asking the
   * accessibility-tree helper, which owns the ref registry. Returns null when the
   * ref can't be resolved (e.g. it expired because the page navigated away).
   */
  private async resolveRef(
    tabId: number,
    ref: string,
  ): Promise<{ center?: { x: number; y: number }; selector?: string } | null> {
    await this.injectContentScript(tabId, ['inject-scripts/accessibility-tree-helper.js']);
    const resolved = await this.sendMessageToTab(tabId, {
      action: TOOL_MESSAGE_TYPES.RESOLVE_REF,
      ref,
    });
    if (resolved && resolved.success) {
      return { center: resolved.center, selector: resolved.selector };
    }
    return null;
  }

  /**
   * Resolve coordinates from either explicit coordinates or a ref. Returns null
   * when neither source provides usable coordinates.
   */
  private async resolveCoordinates(
    tabId: number,
    coordinates?: { x: number; y: number },
    ref?: string,
  ): Promise<{ x: number; y: number } | null> {
    if (coordinates) return coordinates;
    if (ref) {
      try {
        const resolved = await this.resolveRef(tabId, ref);
        if (resolved?.center) return resolved.center;
      } catch (e) {
        console.warn('Failed to resolve ref:', e);
      }
    }
    return null;
  }

  /**
   * Dispatch mouse events inline via chrome.scripting.executeScript. Used for
   * right_click, double_click, triple_click, and hover which the click-helper
   * content script does not support.
   */
  private async dispatchMouseEvents(
    tabId: number,
    options: {
      eventType: string;
      coordinates?: { x: number; y: number };
      selector?: string;
      clickCount?: number;
      modifiers?: ComputerParams['modifiers'];
    },
  ): Promise<ToolResult> {
    const { eventType, coordinates, selector, clickCount, modifiers } = options;

    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'ISOLATED',
      func: (
        evType: string,
        coords: { x: number; y: number } | undefined,
        sel: string | undefined,
        count: number | undefined,
        mods: Record<string, boolean> | undefined,
      ) => {
        try {
          let el: Element | null = null;
          let x = 0;
          let y = 0;

          if (coords && typeof coords.x === 'number' && typeof coords.y === 'number') {
            x = coords.x;
            y = coords.y;
            el = document.elementFromPoint(x, y);
          } else if (sel) {
            el = document.querySelector(sel);
            if (el) {
              const rect = el.getBoundingClientRect();
              x = rect.left + rect.width / 2;
              y = rect.top + rect.height / 2;
            }
          }

          if (!el) {
            return {
              success: false,
              error: coords
                ? `No element found at coordinates (${coords.x}, ${coords.y})`
                : `Element with selector "${sel}" not found`,
            };
          }

          const eventInit: MouseEventInit = {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
            button: evType === 'contextmenu' ? 2 : 0,
            detail: count || 1,
            altKey: mods?.altKey || false,
            ctrlKey: mods?.ctrlKey || false,
            metaKey: mods?.metaKey || false,
            shiftKey: mods?.shiftKey || false,
          };

          // Dispatch the primary event
          el.dispatchEvent(new MouseEvent(evType, eventInit));

          // For dblclick, also fire the preceding mousedown/mouseup/click
          // sequence that browsers normally emit before the dblclick event.
          if (evType === 'dblclick') {
            el.dispatchEvent(new MouseEvent('mousedown', eventInit));
            el.dispatchEvent(new MouseEvent('mouseup', eventInit));
            el.dispatchEvent(new MouseEvent('click', eventInit));
            el.dispatchEvent(new MouseEvent('mousedown', eventInit));
            el.dispatchEvent(new MouseEvent('mouseup', eventInit));
            el.dispatchEvent(new MouseEvent('click', eventInit));
          }

          return {
            success: true,
            message: `${evType} event dispatched on <${el.tagName.toLowerCase()}>`,
            element: { tagName: el.tagName, id: el.id || null },
          };
        } catch (err: any) {
          return { success: false, error: err?.message || String(err) };
        }
      },
      args: [
        eventType,
        coordinates || undefined,
        selector || undefined,
        clickCount || undefined,
        modifiers || undefined,
      ],
    } as any);

    const result = results?.[0]?.result;
    if (!result || typeof result !== 'object') {
      return createErrorResponse('No result from inline mouse event dispatch');
    }
    if (!result.success) {
      return createErrorResponse(result.error || 'Mouse event dispatch failed');
    }

    return createJsonResponse({
      success: true,
      action: eventType,
      message: result.message,
      element: result.element,
    });
  }

  /**
   * Dispatch scroll/wheel events inline.
   */
  private async dispatchScroll(
    tabId: number,
    options: {
      direction: string;
      amount: number;
      coordinates?: { x: number; y: number };
      selector?: string;
    },
  ): Promise<ToolResult> {
    const { direction, amount, coordinates, selector } = options;
    const ticks = Math.max(1, Math.min(amount || 3, 10));

    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'ISOLATED',
      func: (dir: string, scrollTicks: number, coords: { x: number; y: number } | undefined, sel: string | undefined) => {
        try {
          let el: Element | Window = window;
          if (coords && typeof coords.x === 'number' && typeof coords.y === 'number') {
            el = document.elementFromPoint(coords.x, coords.y) || window;
          } else if (sel) {
            el = document.querySelector(sel) || window;
          }

          const deltaMap: Record<string, { dx: number; dy: number }> = {
            up: { dx: 0, dy: -120 },
            down: { dx: 0, dy: 120 },
            left: { dx: -120, dy: 0 },
            right: { dx: 120, dy: 0 },
          };
          const delta = deltaMap[dir] || deltaMap.down;
          const deltaX = delta.dx * scrollTicks;
          const deltaY = delta.dy * scrollTicks;

          // Dispatch wheel event (works on both Element and Window)
          const wheelEvt = new WheelEvent('wheel', {
            bubbles: true,
            cancelable: true,
            deltaX,
            deltaY,
            deltaMode: 0, // DOM_DELTA_PIXEL
          });
          (el as any).dispatchEvent(wheelEvt);

          // Fallback: also scroll directly if the element is scrollable
          if (el instanceof Element && el !== document.documentElement) {
            el.scrollLeft += deltaX;
            el.scrollTop += deltaY;
          } else {
            window.scrollBy(deltaX, deltaY);
          }

          return { success: true, direction: dir, ticks: scrollTicks };
        } catch (err: any) {
          return { success: false, error: err?.message || String(err) };
        }
      },
      args: [direction, ticks, coordinates || undefined, selector || undefined],
    } as any);

    const result = results?.[0]?.result;
    if (!result?.success) {
      return createErrorResponse(result?.error || 'Scroll failed');
    }

    return createJsonResponse({
      success: true,
      action: 'scroll',
      direction: result.direction,
      ticks: result.ticks,
    });
  }

  /**
   * Scroll element into view via scrollIntoView.
   */
  private async dispatchScrollTo(
    tabId: number,
    options: { ref?: string; selector?: string; coordinates?: { x: number; y: number } },
  ): Promise<ToolResult> {
    const { ref, selector, coordinates } = options;

    // If ref is given, resolve to selector first
    let resolvedSelector = selector;
    if (ref && !resolvedSelector) {
      const resolved = await this.resolveRef(tabId, ref);
      resolvedSelector = resolved?.selector;
    }

    if (!resolvedSelector && !coordinates) {
      return createErrorResponse('selector, ref, or coordinates required for scroll_to action');
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'ISOLATED',
      func: (sel: string | undefined, coords: { x: number; y: number } | undefined) => {
        try {
          let el: Element | null = null;
          if (sel) {
            el = document.querySelector(sel);
          } else if (coords) {
            el = document.elementFromPoint(coords.x, coords.y);
          }
          if (!el) {
            return { success: false, error: 'Element not found for scroll_to' };
          }
          el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
          return { success: true, tagName: el.tagName };
        } catch (err: any) {
          return { success: false, error: err?.message || String(err) };
        }
      },
      args: [resolvedSelector || undefined, coordinates || undefined],
    } as any);

    const result = results?.[0]?.result;
    if (!result?.success) {
      return createErrorResponse(result?.error || 'scroll_to failed');
    }

    return createJsonResponse({ success: true, action: 'scroll_to', tagName: result.tagName });
  }

  async execute(args: ComputerParams): Promise<ToolResult> {
    const { action } = args || {};

    if (!action) {
      return createErrorResponse('Action parameter is required');
    }

    try {
      // Resolve target tab: explicit tabId wins, then windowId, then current window
      let finalTab: chrome.tabs.Tab | null = null;
      if (typeof args.tabId === 'number') {
        finalTab = await this.tryGetTab(args.tabId);
      } else if (typeof args.windowId === 'number') {
        finalTab = await this.getActiveTabOrThrowInWindow(args.windowId);
      } else {
        finalTab = await this.resolveTargetTab();
      }

      if (!finalTab?.id) {
        return createErrorResponse('No active tab found');
      }
      const targetTabId = finalTab.id;

      // Delegate to existing tools based on action
      switch (action) {
        case 'left_click': {
          const coordinates = await this.resolveCoordinates(targetTabId, args.coordinates, args.ref);
          return await clickTool.execute({
            selector: args.selector,
            coordinates,
            waitForNavigation: false,
            tabId: targetTabId,
          });
        }

        case 'right_click': {
          const coordinates = await this.resolveCoordinates(targetTabId, args.coordinates, args.ref);
          return await this.dispatchMouseEvents(targetTabId, {
            eventType: 'contextmenu',
            coordinates,
            selector: args.selector,
            modifiers: args.modifiers,
          });
        }

        case 'double_click': {
          const coordinates = await this.resolveCoordinates(targetTabId, args.coordinates, args.ref);
          return await this.dispatchMouseEvents(targetTabId, {
            eventType: 'dblclick',
            coordinates,
            selector: args.selector,
            clickCount: 2,
            modifiers: args.modifiers,
          });
        }

        case 'triple_click': {
          // Triple-click selects the line/paragraph. Dispatch three rapid clicks
          // with detail=3 to trigger the browser's triple-click selection behavior.
          const coordinates = await this.resolveCoordinates(targetTabId, args.coordinates, args.ref);
          return await this.dispatchMouseEvents(targetTabId, {
            eventType: 'click',
            coordinates,
            selector: args.selector,
            clickCount: 3,
            modifiers: args.modifiers,
          });
        }

        case 'hover': {
          const coordinates = await this.resolveCoordinates(targetTabId, args.coordinates, args.ref);
          return await this.dispatchMouseEvents(targetTabId, {
            eventType: 'mouseover',
            coordinates,
            selector: args.selector,
            modifiers: args.modifiers,
          });
        }

        case 'scroll': {
          const direction = args.scrollDirection || 'down';
          const amount = args.scrollAmount || 3;
          const coordinates = await this.resolveCoordinates(targetTabId, args.coordinates, args.ref);
          return await this.dispatchScroll(targetTabId, {
            direction,
            amount,
            coordinates,
            selector: args.selector,
          });
        }

        case 'scroll_to': {
          return await this.dispatchScrollTo(targetTabId, {
            ref: args.ref,
            selector: args.selector,
            coordinates: args.coordinates,
          });
        }

        case 'fill': {
          // Resolve ref to selector if provided
          let selector = args.selector;
          if (args.ref && !selector) {
            try {
              const resolved = await this.resolveRef(targetTabId, args.ref);
              if (resolved?.selector) {
                selector = resolved.selector;
              } else {
                return createErrorResponse(`Failed to resolve ref: ${args.ref}`);
              }
            } catch (e) {
              return createErrorResponse(
                `Failed to resolve ref: ${toErrorMessage(e)}`,
              );
            }
          }
          if (!selector) {
            return createErrorResponse('selector or ref is required for fill action');
          }
          return await fillTool.execute({
            selector,
            value: String(args.value ?? ''),
            tabId: targetTabId,
          });
        }

        case 'fill_form': {
          const elements = args.elements;
          if (!Array.isArray(elements) || elements.length === 0) {
            return createErrorResponse('elements array is required for fill_form action');
          }
          const results: Array<{ ref: string; success: boolean; error?: string }> = [];
          for (const item of elements) {
            if (!item.ref || item.value === undefined) {
              results.push({ ref: item.ref || '', success: false, error: 'Missing ref or value' });
              continue;
            }
            try {
              const resolved = await this.resolveRef(targetTabId, item.ref);
              if (!resolved?.selector) {
                results.push({ ref: item.ref, success: false, error: 'Could not resolve ref to selector' });
                continue;
              }
              const fillResult = await fillTool.execute({
                selector: resolved.selector,
                value: item.value,
                tabId: targetTabId,
              });
              results.push({ ref: item.ref, success: !fillResult.isError });
            } catch (e) {
              results.push({
                ref: item.ref,
                success: false,
                error: toErrorMessage(e),
              });
            }
          }
          const allOk = results.every((r) => r.success);
          return createJsonResponse(
            { success: allOk, action: 'fill_form', results },
            { isError: !allOk },
          );
        }

        case 'type':
        case 'key': {
          const keys = args.text;
          if (!keys) {
            return createErrorResponse('text parameter is required for type/key action');
          }
          return await keyboardTool.execute({
            keys,
            selector: args.selector,
            repeat: args.repeat,
            tabId: targetTabId,
          });
        }

        case 'resize_page': {
          const width = typeof args.coordinates?.x === 'number' ? args.coordinates.x : undefined;
          const height = typeof args.coordinates?.y === 'number' ? args.coordinates.y : undefined;
          if (!width && !height) {
            return createErrorResponse('coordinates (x=width, y=height) required for resize_page action');
          }
          const updateOpts: chrome.windows.UpdateInfo = {};
          if (width) updateOpts.width = Math.round(width);
          if (height) updateOpts.height = Math.round(height);
          const winId = finalTab.windowId;
          if (typeof winId === 'number') {
            await chrome.windows.update(winId, updateOpts);
          }
          return createJsonResponse({
            success: true,
            action: 'resize_page',
            width: updateOpts.width,
            height: updateOpts.height,
          });
        }

        case 'screenshot': {
          // screenshotTool re-queries the active tab of the current window and
          // cannot accept a tabId (lives outside this area), so activate the
          // resolved tab + its window first so its active-tab query resolves to
          // targetTab. Best-effort: focus may be unavailable in headless contexts.
          try {
            await this.ensureFocus(finalTab, { activate: true, focusWindow: true });
          } catch (e) {
            console.warn('Failed to focus target tab for screenshot:', e);
          }
          return await screenshotTool.execute({
            name: 'computer_screenshot',
            selector: args.selector,
          });
        }

        case 'wait': {
          const waitDuration = args.duration ? Math.min(args.duration * 1000, 30000) : 1000;
          await waitForDelay(waitDuration);
          return createJsonResponse({ success: true, action: 'wait', duration: waitDuration });
        }

        case 'left_click_drag': {
          // Drag requires start and end coordinates; resolve both from refs if needed
          const startCoords = await this.resolveCoordinates(targetTabId, args.startCoordinates, args.startRef);
          const endCoords = await this.resolveCoordinates(targetTabId, args.coordinates, args.ref);
          if (!startCoords || !endCoords) {
            return createErrorResponse(
              'startCoordinates/startRef and coordinates/ref are both required for left_click_drag',
            );
          }

          const dragResults = await chrome.scripting.executeScript({
            target: { tabId: targetTabId },
            world: 'ISOLATED',
            func: (sx: number, sy: number, ex: number, ey: number) => {
              try {
                const startEl = document.elementFromPoint(sx, sy);
                const endEl = document.elementFromPoint(ex, ey);
                if (!startEl) return { success: false, error: 'No element at start coordinates' };

                const commonInit: MouseEventInit = {
                  view: window,
                  bubbles: true,
                  cancelable: true,
                  button: 0,
                };

                startEl.dispatchEvent(
                  new MouseEvent('mousedown', { ...commonInit, clientX: sx, clientY: sy }),
                );
                // Dispatch drag events on the document for broad compatibility
                document.dispatchEvent(
                  new MouseEvent('mousemove', { ...commonInit, clientX: (sx + ex) / 2, clientY: (sy + ey) / 2 }),
                );
                document.dispatchEvent(
                  new MouseEvent('mousemove', { ...commonInit, clientX: ex, clientY: ey }),
                );

                // Try HTML5 drag events if the element supports them
                try {
                  const dt = new DataTransfer();
                  startEl.dispatchEvent(new DragEvent('dragstart', { ...commonInit, clientX: sx, clientY: sy, dataTransfer: dt }));
                  (endEl || document).dispatchEvent(new DragEvent('dragover', { ...commonInit, clientX: ex, clientY: ey, dataTransfer: dt }));
                  (endEl || document).dispatchEvent(new DragEvent('drop', { ...commonInit, clientX: ex, clientY: ey, dataTransfer: dt }));
                  startEl.dispatchEvent(new DragEvent('dragend', { ...commonInit, clientX: ex, clientY: ey, dataTransfer: dt }));
                } catch {
                  // DragEvent may not be available in all contexts
                }

                startEl.dispatchEvent(
                  new MouseEvent('mouseup', { ...commonInit, clientX: ex, clientY: ey }),
                );

                return { success: true };
              } catch (err: any) {
                return { success: false, error: err?.message || String(err) };
              }
            },
            args: [startCoords.x, startCoords.y, endCoords.x, endCoords.y],
          } as any);

          const dragResult = dragResults?.[0]?.result;
          if (!dragResult?.success) {
            return createErrorResponse(dragResult?.error || 'Drag operation failed');
          }

          return createJsonResponse({
            success: true,
            action: 'left_click_drag',
            from: startCoords,
            to: endCoords,
          });
        }

        case 'zoom': {
          const region = args.coordinates
            ? { x0: 0, y0: 0, x1: args.coordinates.x, y1: args.coordinates.y }
            : null;
          // Zoom is essentially a page zoom level change; use chrome.tabs.setZoom
          const zoomFactor = args.scrollAmount || 1;
          await chrome.tabs.setZoom(targetTabId, zoomFactor);
          return createJsonResponse({
            success: true,
            action: 'zoom',
            zoomFactor,
            region,
          });
        }

        default:
          return createErrorResponse(
            `Action "${action}" is not supported. Supported actions: left_click, right_click, double_click, triple_click, left_click_drag, scroll, scroll_to, type, key, hover, wait, fill, fill_form, resize_page, zoom, screenshot.`,
          );
      }
    } catch (error) {
      console.error('Error in computer tool:', error);
      return createErrorResponse(
        `Failed to execute action: ${toErrorMessage(error)}`,
      );
    }
  }
}

export const computerTool = new ComputerTool();
