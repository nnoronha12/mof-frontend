const isResizeObserverLoop = (value: unknown) =>
  typeof value === "string" &&
  /ResizeObserver loop/i.test(value);

let installed = false;

/**
 * Chrome reports a benign ResizeObserver warning when amCharts resizes.
 * webpack-dev-server treats that as a runtime overlay error.
 */
export const ignoreResizeObserverLoopError = () => {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const NativeObserver = window.ResizeObserver;
  if (typeof NativeObserver === "function") {
    window.ResizeObserver = class ResizeObserver extends NativeObserver {
      constructor(callback: ResizeObserverCallback) {
        super((entries, observer) => {
          window.requestAnimationFrame(() => {
            callback(entries, observer);
          });
        });
      }
    };
  }

  const suppress = (event: Event) => {
    const eventMessage = (event as Event & { message?: unknown }).message;
    const message = event instanceof ErrorEvent
      ? event.message
      : typeof eventMessage === "string" ? eventMessage : "";
    if (!isResizeObserverLoop(message)) return;
    event.stopImmediatePropagation();
    event.preventDefault();
  };

  window.addEventListener("error", suppress, true);

  const previousOnError = window.onerror;
  window.onerror = (message, source, line, column, error) => {
    if (isResizeObserverLoop(String(message)) || isResizeObserverLoop(error?.message)) {
      return true;
    }
    if (typeof previousOnError === "function") {
      return previousOnError(message, source, line, column, error);
    }
    return false;
  };
};
